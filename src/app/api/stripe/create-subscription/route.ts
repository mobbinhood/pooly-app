import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { customerName, email, paymentMethodId, priceAmountCents, stripeCouponId } = await request.json();

    if (!customerName || !paymentMethodId || !priceAmountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: customerName,
      email: email || undefined,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create a price for this customer's subscription
    const price = await stripe.prices.create({
      product_data: { name: `Pool Service - ${customerName}` },
      unit_amount: priceAmountCents,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    // Create subscription
    const subscriptionParams: Record<string, unknown> = {
      customer: customer.id,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
    };

    if (stripeCouponId) {
      subscriptionParams.discounts = [{ coupon: stripeCouponId }];
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams as any);

    return NextResponse.json({
      stripeCustomerId: customer.id,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
