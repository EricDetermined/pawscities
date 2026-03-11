import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const PRICE_MAP: Record<string, string> = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID || '',
  annual: process.env.STRIPE_ANNUAL_PRICE_ID || '',
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, establishmentId } = await request.json();

    if (!plan || !PRICE_MAP[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected. Choose monthly or annual.' }, { status: 400 });
    }

    if (!establishmentId) {
      return NextResponse.json({ error: 'Establishment ID required' }, { status: 400 });
    }

    // Look up user in our User table
    const { data: dbUser } = await supabase
      .from('User')
      .select('id, email')
      .eq('supabaseId', user.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 });
    }

    // Verify the user owns this establishment (has approved claim)
    const { data: claim } = await supabase
      .from('BusinessClaim')
      .select('id, establishmentId')
      .eq('userId', dbUser.id)
      .eq('establishmentId', establishmentId)
      .eq('status', 'APPROVED')
      .single();

    if (!claim) {
      return NextResponse.json({ error: 'No approved claim found for this establishment' }, { status: 403 });
    }

    // Check for existing Stripe customer
    const { data: subscription } = await supabase
      .from('Subscription')
      .select('stripeCustomerId')
      .eq('establishmentId', establishmentId)
      .single();

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email || user.email,
        metadata: {
          supabase_user_id: dbUser.id,
          establishment_id: establishmentId,
        },
      });
      customerId = customer.id;
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_MAP[plan],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/business/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/business/upgrade?canceled=true`,
      metadata: {
        supabase_user_id: dbUser.id,
        establishment_id: establishmentId,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: dbUser.id,
          establishment_id: establishmentId,
          plan: plan,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
