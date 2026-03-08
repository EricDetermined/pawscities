import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_TO_TIER: Record<string, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { supabase_user_id, establishment_id, plan } = session.metadata || {};

        if (supabase_user_id && establishment_id && plan) {
          const tier = PLAN_TO_TIER[plan] || 'BRONZE';

          // Update establishment tier
          await supabaseAdmin
            .from('Establishment')
            .update({ tier: tier })
            .eq('id', establishment_id);

          // Create or update subscription record
          await supabaseAdmin
            .from('Subscription')
            .upsert({
              userId: supabase_user_id,
              establishmentId: establishment_id,
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              plan: plan,
              tier: tier,
              status: 'ACTIVE',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, {
              onConflict: 'establishmentId',
            });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const { supabase_user_id, establishment_id, plan } = subscription.metadata || {};

        if (establishment_id) {
          const status = subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE';
          const tier = subscription.status === 'active' ? (PLAN_TO_TIER[plan] || 'BRONZE') : 'FREE';

          await supabaseAdmin
            .from('Subscription')
            .update({
              status: status,
              tier: tier,
              currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripeSubscriptionId', subscription.id);

          // Update establishment tier
          await supabaseAdmin
            .from('Establishment')
            .update({ tier: tier })
            .eq('id', establishment_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { establishment_id } = subscription.metadata || {};

        // Downgrade to free
        await supabaseAdmin
          .from('Subscription')
          .update({ status: 'CANCELED', tier: 'FREE' })
          .eq('stripeSubscriptionId', subscription.id);

        if (establishment_id) {
          await supabaseAdmin
            .from('Establishment')
            .update({ tier: 'FREE' })
            .eq('id', establishment_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await supabaseAdmin
            .from('Subscription')
            .update({ status: 'PAST_DUE' })
            .eq('stripeSubscriptionId', subscriptionId);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
