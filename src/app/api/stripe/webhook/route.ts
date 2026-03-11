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

        if (supabase_user_id && establishment_id) {
          // Update establishment tier to PREMIUM
          await supabaseAdmin
            .from('Establishment')
            .update({ tier: 'PREMIUM' })
            .eq('id', establishment_id);

          // Get subscription details from Stripe for accurate period dates
          let periodStart = new Date().toISOString();
          let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          if (session.subscription) {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            periodStart = new Date(stripeSubscription.current_period_start * 1000).toISOString();
            periodEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
          }

          // Create or update subscription record
          await supabaseAdmin
            .from('Subscription')
            .upsert({
              userId: supabase_user_id,
              establishmentId: establishment_id,
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              plan: plan || 'monthly',
              tier: 'PREMIUM',
              status: 'ACTIVE',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            }, {
              onConflict: 'establishmentId',
            });

          console.log(`â Subscription activated for establishment ${establishment_id} (${plan})`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const { establishment_id } = subscription.metadata || {};

        if (establishment_id) {
          const isActive = subscription.status === 'active';
          const status = isActive ? 'ACTIVE' :
                        subscription.status === 'past_due' ? 'PAST_DUE' :
                        subscription.status;
          const tier = isActive ? 'PREMIUM' : 'FREE';

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

          console.log(`ð Subscription updated for establishment ${establishment_id}: ${status}`);
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

        console.log(`â Subscription canceled for establishment ${establishment_id}`);
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

          console.log(`â ï¸ Payment failed for subscription ${subscriptionId}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Handle successful renewal payments
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const { establishment_id } = stripeSubscription.metadata || {};

          await supabaseAdmin
            .from('Subscription')
            .update({
              status: 'ACTIVE',
              tier: 'PREMIUM',
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripeSubscriptionId', subscriptionId);

          if (establishment_id) {
            await supabaseAdmin
              .from('Establishment')
              .update({ tier: 'PREMIUM' })
              .eq('id', establishment_id);
          }

          console.log(`â Renewal payment succeeded for subscription ${subscriptionId}`);
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
