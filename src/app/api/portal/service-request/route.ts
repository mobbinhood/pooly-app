import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { customer_id, title, description, priority } = body;

  if (!customer_id || !title) {
    return NextResponse.json({ error: 'customer_id and title are required' }, { status: 400 });
  }

  const supabase = await getSupabase();

  // Get customer's org
  const { data: customer } = await supabase
    .from('customers')
    .select('organization_id')
    .eq('id', customer_id)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      organization_id: customer.organization_id,
      customer_id,
      title,
      description: description || null,
      priority: priority || 'normal',
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, message: 'Service request submitted' });
}
