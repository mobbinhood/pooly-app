import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { code, orgId } = await request.json();

    if (!code || !orgId) {
      return NextResponse.json({ valid: false, error: 'Code and organization required' });
    }

    const { data: discount } = await supabase
      .from('discounts')
      .select('id, name, description, type, value, duration_months, stripe_coupon_id, code, expires_at')
      .eq('organization_id', orgId)
      .eq('active', true)
      .ilike('code', code.trim())
      .single();

    if (!discount) {
      return NextResponse.json({ valid: false, error: 'Invalid discount code' });
    }

    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'This discount code has expired' });
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discount.id,
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        duration_months: discount.duration_months,
        stripe_coupon_id: discount.stripe_coupon_id,
      },
    });
  } catch (error) {
    console.error('Discount validation error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to validate discount' }, { status: 500 });
  }
}
