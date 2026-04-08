import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { buildServiceReportHtml } from '@/lib/email-template';

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = await createClient();
  const body = await request.json();
  const { service_log_id } = body;

  if (!service_log_id) {
    return NextResponse.json({ error: 'service_log_id is required' }, { status: 400 });
  }

  // Fetch the service log with customer and technician info
  const { data: log, error: logError } = await supabase
    .from('service_logs')
    .select('*, customers(name, email, organization_id), users:technician_id(name)')
    .eq('id', service_log_id)
    .single();

  if (logError || !log) {
    return NextResponse.json({ error: 'Service log not found' }, { status: 404 });
  }

  const customer = log.customers as { name: string; email: string | null; organization_id: string } | null;
  const technician = log.users as { name: string } | null;

  if (!customer?.email) {
    return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
  }

  // Get organization name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', customer.organization_id)
    .single();

  const html = buildServiceReportHtml({
    customerName: customer.name,
    serviceDate: log.service_date,
    technicianName: technician?.name ?? 'Your Technician',
    phLevel: log.ph_level,
    chlorineLevel: log.chlorine_level,
    alkalinity: log.alkalinity,
    equipmentStatus: log.equipment_status,
    notes: log.notes,
    photos: log.photos ?? [],
    orgName: org?.name ?? 'Pooly',
  });

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'reports@pooly.app';

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: `${org?.name ?? 'Pooly'} <${fromAddress}>`,
    to: [customer.email],
    subject: `Pool Service Report — ${new Date(log.service_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    html,
  });

  if (emailError) {
    // Record failure
    await supabase
      .from('service_logs')
      .update({ email_status: 'failed' } as Record<string, unknown>)
      .eq('id', service_log_id);

    return NextResponse.json({ error: emailError.message }, { status: 500 });
  }

  // Record success
  await supabase
    .from('service_logs')
    .update({
      email_status: 'sent',
      email_sent_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', service_log_id);

  return NextResponse.json({ success: true, emailId: emailData?.id });
}
