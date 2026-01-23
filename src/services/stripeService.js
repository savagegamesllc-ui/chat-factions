// src/services/stripeService.js
'use strict';

const Stripe = require('stripe');
const { prisma } = require('../db/prisma');
const { config } = require('../config/env');

function getStripe() {
  if (!config.stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
  return new Stripe(config.stripeSecretKey, {
    apiVersion: '2024-06-20' // stable enough; OK if Stripe upgrades later
  });
}

function hasProAccess(streamer) {
  return streamer && (streamer.planTier === 'PRO' || streamer.proOverride === true);
}

async function getBillingStatus(streamerId) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      planTier: true,
      proOverride: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true
    }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  return {
    planTier: streamer.planTier,
    proOverride: streamer.proOverride,
    proEffective: hasProAccess(streamer),
    stripeCustomerId: streamer.stripeCustomerId,
    stripeSubscriptionId: streamer.stripeSubscriptionId
  };
}

/**
 * Ensure the streamer has a Stripe Customer.
 */
async function ensureStripeCustomer(streamerId) {
  const stripe = getStripe();

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: {
      id: true,
      displayName: true,
      login: true,
      email: true,
      stripeCustomerId: true
    }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  if (streamer.stripeCustomerId) return streamer.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: streamer.displayName || streamer.login || 'Streamer',
    email: streamer.email || undefined,
    metadata: {
      streamerId: streamer.id
    }
  });

  await prisma.streamer.update({
    where: { id: streamer.id },
    data: { stripeCustomerId: customer.id }
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for PRO subscription.
 */
async function createProCheckoutSession(streamerId) {
  const stripe = getStripe();

  if (!config.stripeProPriceId) throw new Error('Missing STRIPE_PRO_PRICE_ID');
  if (!config.publicBaseUrl) throw new Error('Missing PUBLIC_BASE_URL');

  const customerId = await ensureStripeCustomer(streamerId);

  // Stripe handles duplicates safely; webhook will be source of truth.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: config.stripeProPriceId, quantity: 1 }],
    success_url: `${config.publicBaseUrl}/admin/billing?success=1`,
    cancel_url: `${config.publicBaseUrl}/admin/billing?canceled=1`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        streamerId
      }
    },
    metadata: {
      streamerId
    }
  });

  return session.url;
}

/**
 * Create a Stripe Customer Portal session so streamers can manage/cancel.
 */
async function createCustomerPortalUrl(streamerId) {
  const stripe = getStripe();

  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { stripeCustomerId: true }
  });
  if (!streamer) throw Object.assign(new Error('Streamer not found.'), { statusCode: 404 });

  if (!streamer.stripeCustomerId) {
    // If no customer yet, they haven't started billing; send them to checkout.
    return null;
  }

  const returnUrl = config.stripeCustomerPortalReturnUrl || `${config.publicBaseUrl}/admin/billing`;

  const portal = await stripe.billingPortal.sessions.create({
    customer: streamer.stripeCustomerId,
    return_url: returnUrl
  });

  return portal.url;
}

async function setPlanTierFromStripe(streamerId, nextTier, stripeSubscriptionId) {
  // Webhook is authoritative, but NEVER downgrade if proOverride is set.
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { proOverride: true }
  });
  if (!streamer) return;

  if (streamer.proOverride === true && nextTier === 'FREE') {
    // keep PRO if manually overridden
    return;
  }

  await prisma.streamer.update({
    where: { id: streamerId },
    data: {
      planTier: nextTier,
      stripeSubscriptionId: stripeSubscriptionId || undefined,
      proGrantedAt: nextTier === 'PRO' ? new Date() : undefined
    }
  });
}

/**
 * Verify Stripe webhook signature and return event.
 * NOTE: must use raw body (Buffer).
 */
function constructStripeEvent(rawBody, signatureHeader) {
  const stripe = getStripe();

  if (!config.stripeWebhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  if (!signatureHeader) throw new Error('Missing Stripe signature header');

  return stripe.webhooks.constructEvent(rawBody, signatureHeader, config.stripeWebhookSecret);
}

module.exports = {
  getBillingStatus,
  createProCheckoutSession,
  createCustomerPortalUrl,
  constructStripeEvent,
  setPlanTierFromStripe
};
