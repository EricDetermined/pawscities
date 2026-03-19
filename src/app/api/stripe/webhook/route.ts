import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
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
          // Update establishment tier to premium
          await supabaseAdmin
            .from('establishments')
            .update({ tier: 'premium' })
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
            .from('subscriptions')
            .upsert({
              user_id: supabase_user_id,
              establishment_id: establishment_id,
              stripe_subscription_id: session.subscription as string,
              stripe_customer_id: session.customer as string,
              plan: plan || 'monthly',
              status: 'ACTIVE',
              current_period_start: periodStart,
              current_period_end: periodEnd,
            }, {
              onConflict: 'establishment_id',
            });

          console.log(`Subscription activated for establishment ${establishment_id} (${plan})`);
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
          const tier = isActive ? 'premium' : 'free';

          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);

          // Update establishment tier
          await supabaseAdmin
            .from('establishments')
            .update({ tier: tier })
            .eq('id', establishment_id);

          console.log(`Subscription updated for establishment ${establishment_id}: ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { establishment_id } = subscription.metadata || {};

        // Downgrade to free
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'CANCELED' })
          .eq('stripe_subscription_id', subscription.id);

        if (establishment_id) {
          await supabaseAdmin
            .from('establishments')
            .update({ tier: 'free' })
            .eq('id', establishment_id);
        }

        console.log(`Subscription canceled for establishment ${establishment_id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'PAST_DUE' })
            .eq('stripe_subscription_id', subscriptionId);

          console.log(`Payment failed for subscription ${subscriptionId}`);
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
            .from('subscriptions')
            .update({
              status: 'ACTIVE',
              current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);

          if (establishment_id) {
            await supabaseAdmin
              .from('establishments')
              .update({ tier: 'premium' })
              .eq('id', establishment_id);
          }

          console.log(`Renewal payment succeeded for subscription ${subscriptionId}`);
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
