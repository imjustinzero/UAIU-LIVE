/**
 * Stripe Configuration for UAIU Pong
 * 
 * This file contains placeholders for Stripe webhook integration.
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Install Stripe SDK:
 *    npm install stripe
 * 
 * 2. Get your Stripe keys from: https://dashboard.stripe.com/apikeys
 *    Set environment variables:
 *    - STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
 *    - STRIPE_WEBHOOK_SECRET=whsec_... (from webhook configuration)
 * 
 * 3. Configure webhook endpoint in Stripe Dashboard:
 *    - URL: https://your-domain.com/api/stripe/webhook
 *    - Events: checkout.session.completed
 * 
 * 4. Your checkout link (already created):
 *    https://buy.stripe.com/8x26oIa5OacYb46eVCcMM02
 *    This should be configured to:
 *    - Price: $1.00 USD
 *    - Collect customer email
 *    - Redirect to your app after payment
 * 
 * 5. Uncomment the code below and add the webhook route to server/routes.ts
 */

/*
import Stripe from 'stripe';
import type { Express } from 'express';
import express from 'express';
import { storage } from './storage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export function registerStripeWebhook(app: Express) {
  // IMPORTANT: This route must use express.raw() middleware, not express.json()
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !endpointSecret) {
        console.error('Missing Stripe signature or webhook secret');
        return res.status(400).send('Webhook Error: Missing configuration');
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email;

        if (!customerEmail) {
          console.error('No customer email in checkout session');
          return res.status(400).send('No customer email found');
        }

        console.log(`Processing payment for ${customerEmail}`);

        // Find user by email and add 10 credits
        const user = await storage.getUserByEmail(customerEmail);
        
        if (user) {
          const newCredits = user.credits + 10;
          await storage.updateUserCredits(user.id, newCredits);
          
          // Log the credit purchase
          await storage.addActionLog({
            type: 'credit',
            message: `${user.name} purchased 10 credits for $1.00`
          });

          console.log(`✅ Added 10 credits to ${user.name}. New balance: ${newCredits}`);
        } else {
          console.error(`❌ User not found for email: ${customerEmail}`);
        }
      }

      res.json({ received: true });
    }
  );

  console.log('✅ Stripe webhook endpoint registered at /api/stripe/webhook');
}
*/

// Placeholder function when Stripe is not configured
export function registerStripeWebhook(app: any) {
  console.log('⚠️  Stripe webhook NOT configured');
  console.log('   To enable automatic credit fulfillment:');
  console.log('   1. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables');
  console.log('   2. Uncomment code in server/stripe-config.ts');
  console.log('   3. Call registerStripeWebhook(app) in server/routes.ts');
  console.log('   4. Configure webhook in Stripe Dashboard');
  console.log('   See server/stripe-config.ts for detailed instructions');
}
