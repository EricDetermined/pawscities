import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const PRICE_MAP: Record<string, string> = {
  bronze: process.env.STRIPE_BRONZE_PRICE_ID || '',
  silver: process.env.STRIPE_SILVER_PRICE_ID || '',
  gold: process.env.STRIPE_GOLD_PRICE_ID || '',
};

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, establishmentId } = await request.json();

    if (!plan || !PRICE_MAP[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!establishmentId) {
      return NextResponse.json({ error: 'Establishment ID required' }, { status: 400 });
    }

    // Verify the user owns this establishment (has approved claim)
    const { data: claim } = await supabase
      .from('business_claims')
      .select('id, establishment_id')
      .eq('user_id', user.id)
      .eq('establishment_id', establishmentId)
      .eq('status', 'approved')
      .single();

    if (!claim) {
      return NextResponse.json({ error: 'No approved claim found for this establishment' }, { status: 403 });
    }

    // Check for existing Stripe customer
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
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
        supabase_user_id: user.id,
        establishment_id: establishmentId,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          establishment_id: establishmentId,
          plan: plan,
        },
      },
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
