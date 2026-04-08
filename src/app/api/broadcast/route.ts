import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();
  const body = await request.json();
  const { organization_id, subject, message, filter_tags, channel } = body as {
    organization_id: string;
    subject: string;
    message: string;
    filter_tags?: string[];
    channel: 'email' | 'sms';
  };

  if (!organization_id || !message) {
    return NextResponse.json({ error: 'organization_id and message are required' }, { status: 400 });
  }

  if (channel === 'email' && !subject) {
    return NextResponse.json({ error: 'subject is required for email broadcasts' }, { status: 400 });
  }

  // Get org name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organization_id)
    .single();

  // Fetch customers, optionally filtered by tags
  let query = supabase
    .from('customers')
    .select('id, name, email, phone, tags')
    .eq('organization_id', organization_id);

  if (filter_tags && filter_tags.length > 0) {
    query = query.overlaps('tags', filter_tags);
  }

  const { data: customers, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'notifications@pooly.app';
  const orgName = org?.name ?? 'Pooly';

  let sent = 0;
  let failed = 0;

  if (channel === 'email') {
    // Filter to customers with email addresses
    const recipients = (customers ?? []).filter(c => c.email);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background:#0066FF;padding:24px 32px;text-align:center;">
    <div style="font-size:20px;font-weight:700;color:#FFFFFF;">${orgName}</div>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <div style="font-size:15px;color:#1A1A2E;line-height:1.7;">${message.replace(/\n/g, '<br />')}</div>
  </td></tr>
  <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #F1F5F9;">
    <div style="font-size:12px;color:#94A3B8;">Sent by ${orgName} · Powered by Pooly</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    for (const customer of recipients) {
      try {
        await resend.emails.send({
          from: `${orgName} <${fromAddress}>`,
          to: [customer.email!],
          subject,
          html,
        });

        await supabase.from('notification_log').insert({
          organization_id,
          customer_id: customer.id,
          type: 'email',
          recipient: customer.email!,
          subject,
          body: message,
          status: 'sent',
        });
        sent++;
      } catch {
        await supabase.from('notification_log').insert({
          organization_id,
          customer_id: customer.id,
          type: 'email',
          recipient: customer.email!,
          subject,
          body: message,
          status: 'failed',
        });
        failed++;
      }
    }
  } else {
    // SMS channel - log as pending (requires Twilio or similar integration)
    const recipients = (customers ?? []).filter(c => c.phone);
    for (const customer of recipients) {
      await supabase.from('notification_log').insert({
        organization_id,
        customer_id: customer.id,
        type: 'sms',
        recipient: customer.phone!,
        body: message,
        status: 'pending',
      });
      sent++;
    }
  }

  return NextResponse.json({ sent, failed, total: (customers ?? []).length });
}
