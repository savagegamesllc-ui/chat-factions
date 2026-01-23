// src/routes/webhookRoutes.js
'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const {
  constructStripeEvent,
  setPlanTierFromStripe
} = require('../services/stripeService');

/**
 * Stripe webhook handler:
 * - Verifies signature
 * - Updates streamer.planTier based on subscription status
 *
 * NOTE: this route uses express.raw({type:'application/json'}) (see server.js mounting order).
 */
function webhookRoutes() {
  const router = express.Router();

  router.post(
    '/webhooks/stripe',
    // IMPORTANT: raw body for Stripe signature verification
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      let event;

      try {
        const sig = req.headers['stripe-signature'];
        event = constructStripeEvent(req.body, sig);
      } catch (err) {
        // Signature failed / malformed
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        switch (event.type) {
          // Fires when Checkout completes. Useful to capture subscription/customer linkage.
          case 'checkout.session.completed': {
            const session = event.data.object;

            // We store streamerId in metadata when creating checkout session
            const streamerId = session?.metadata?.streamerId || null;
            const customerId = session?.customer || null;
            const subscriptionId = session?.subscription || null;

            if (streamerId) {
              await prisma.streamer.update({
                where: { id: streamerId },
                data: {
                  stripeCustomerId: customerId || undefined,
                  stripeSubscriptionId: subscriptionId || undefined
                }
              }).catch(() => {});
            } else if (customerId) {
              // Fallback: find streamer by customer id
              await prisma.streamer.updateMany({
                where: { stripeCustomerId: String(customerId) },
                data: { stripeSubscriptionId: subscriptionId || undefined }
              }).catch(() => {});
            }

            break;
          }

          // Subscription lifecycle events (authoritative for PRO/FREE)
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const sub = event.data.object;

            const status = String(sub.status || '').toLowerCase(); // active | trialing | canceled | unpaid | etc.
            const customerId = sub.customer ? String(sub.customer) : null;
            const subscriptionId = sub.id ? String(sub.id) : null;

            // Determine desired tier
            const shouldBePro = (status === 'active' || status === 'trialing');

            // Best: metadata set on subscription_data.metadata.streamerId
            const streamerIdFromMeta = sub?.metadata?.streamerId ? String(sub.metadata.streamerId) : null;

            let streamerId = streamerIdFromMeta;

            // Fallback: find by stripeCustomerId
            if (!streamerId && customerId) {
              const streamer = await prisma.streamer.findFirst({
                where: { stripeCustomerId: customerId },
                select: { id: true }
              });
              streamerId = streamer ? streamer.id : null;
            }

            if (streamerId) {
              await setPlanTierFromStripe(streamerId, shouldBePro ? 'PRO' : 'FREE', subscriptionId);
            }

            break;
          }

          default:
            // ignore
            break;
        }

        // Stripe expects a 2xx quickly
        return res.json({ received: true });
      } catch (err) {
        // Don’t leak internals to Stripe response; log server-side if you have logging.
        return res.status(500).send('Webhook handler failed');
      }
    }
  );

  return router;
}

module.exports = { webhookRoutes: webhookRoutes() };
