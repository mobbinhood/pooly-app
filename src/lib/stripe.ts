import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function createStripeCustomer(email: string, name: string) {
  return await stripe.customers.create({
    email,
    name,
  });
}

export async function createSubscription(
  customerId: string,
  priceId: string,
  couponId?: string
) {
  const params: any = {
    customer: customerId,
    items: [{ price: priceId }],
  };
  if (couponId) {
    params.discounts = [{ coupon: couponId }];
  }
  return await stripe.subscriptions.create(params);
}

export async function createCoupon(params: {
  name: string;
  percentOff?: number;
  amountOff?: number;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  currency?: string;
}) {
  return await stripe.coupons.create({
    name: params.name,
    percent_off: params.percentOff,
    amount_off: params.amountOff,
    duration: params.duration,
    duration_in_months: params.durationInMonths,
    currency: params.currency || 'usd',
  });
}

export async function createPrice(
  productId: string,
  unitAmountCents: number,
  interval: 'month' | 'year' = 'month'
) {
  return await stripe.prices.create({
    product: productId,
    unit_amount: unitAmountCents,
    currency: 'usd',
    recurring: { interval },
  });
}
