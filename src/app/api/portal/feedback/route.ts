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
  const { customer_id, service_log_id, rating, comment } = body;

  if (!customer_id || !service_log_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'customer_id, service_log_id, and rating (1-5) are required' }, { status: 400 });
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

  const ratingLabels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  const message = `Service feedback: ${rating}/5 (${ratingLabels[rating - 1]})${comment ? ` — "${comment}"` : ''}`;

  const { error } = await supabase
    .from('notification_log')
    .insert({
      organization_id: customer.organization_id,
      customer_id,
      type: 'service_feedback',
      message,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Feedback submitted' });
}
