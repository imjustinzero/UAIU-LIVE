import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import type Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    const event = await sync.processWebhook(payload, signature, uuid);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_email || session.customer_details?.email;

      if (!customerEmail) {
        console.error('No customer email in checkout session');
        return;
      }

      console.log(`💳 Processing payment for ${customerEmail}`);

      const user = await storage.getUserByEmail(customerEmail);
      
      if (user) {
        // Get amount paid in cents, convert to dollars
        const amountPaidCents = session.amount_total || 0;
        const amountPaid = amountPaidCents / 100;
        
        // Calculate credits: $5 = 50 credits, $10 = 100 credits (10 credits per dollar)
        const creditsToAdd = Math.floor(amountPaid * 10);
        
        const newCredits = user.credits + creditsToAdd;
        await storage.updateUserCredits(user.id, newCredits);
        
        await storage.addActionLog({
          userId: user.id,
          userName: user.name,
          type: 'credit',
          message: `${user.name} purchased ${creditsToAdd} credits for $${amountPaid.toFixed(2)}`,
        });

        console.log(`✅ Added ${creditsToAdd} credits to ${user.name} (${customerEmail}). New balance: ${newCredits}`);
      } else {
        console.error(`❌ User not found for email: ${customerEmail}`);
        console.error('💡 User must sign up in the app before purchasing credits');
      }
    }
  }
}
