import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { setSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { provisionCredits } from '@/lib/payments/credits';
import { getPlanTierFromMetadata } from '@/lib/payments/plans';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (!session.customer || typeof session.customer === 'string') {
      throw new Error('Invalid customer data from Stripe.');
    }

    const customerId = session.customer.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      throw new Error('No subscription found for this session.');
    }

    const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    }) as Stripe.Subscription;

    const plan = subscriptionData.items.data[0]?.price;

    if (!plan) {
      throw new Error('No plan found for this subscription.');
    }

    const productId = (plan.product as Stripe.Product).id;

    if (!productId) {
      throw new Error('No product ID found for this subscription.');
    }

    const userId = session.client_reference_id;
    if (!userId) {
      throw new Error("No user ID found in session's client_reference_id.");
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found in database.');
    }

    const userTeam = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user[0].id))
      .limit(1);

    if (userTeam.length === 0) {
      throw new Error('User is not associated with any team.');
    }

    // Get plan tier from product metadata
    const product = plan.product as Stripe.Product;
    const tier = getPlanTierFromMetadata(product.metadata || {});

    await db
      .update(teams)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeProductId: productId,
        planName: product.name,
        subscriptionStatus: subscriptionData.status,
        planTier: tier,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, userTeam[0].teamId));

    // Provision credits for the new subscription
    if (tier) {
      // Handle period dates - use trial end if in trial, otherwise use current period
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      // Type assertion to access subscription period properties
      const subData = subscriptionData as unknown as {
        current_period_start?: number;
        current_period_end?: number;
        trial_end?: number | null;
        status: string;
      };

      if (subData.current_period_start && subData.current_period_end) {
        periodStart = new Date(subData.current_period_start * 1000);
        periodEnd = new Date(subData.current_period_end * 1000);
      } else if (subData.trial_end) {
        // For trial subscriptions, use trial period
        periodStart = now;
        periodEnd = new Date(subData.trial_end * 1000);
      } else {
        // Fallback: 30 days from now
        periodStart = now;
        periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      console.log('Subscription period:', { 
        start: periodStart.toISOString(), 
        end: periodEnd.toISOString(),
        status: subData.status,
        trialEnd: subData.trial_end
      });
      
      await provisionCredits(
        userTeam[0].teamId,
        tier,
        periodStart,
        periodEnd,
        subscriptionId
      );
      
      console.log(`Provisioned ${tier} credits for team ${userTeam[0].teamId} via checkout`);
    }

    await setSession(user[0]);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
