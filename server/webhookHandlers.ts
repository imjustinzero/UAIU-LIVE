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
        const newCredits = user.credits + 10;
        await storage.updateUserCredits(user.id, newCredits);
        
        await storage.addActionLog({
          userId: user.id,
          userName: user.name,
          type: 'credit',
          message: `${user.name} purchased 10 credits for $1.00`,
        });

        console.log(`✅ Added 10 credits to ${user.name} (${customerEmail}). New balance: ${newCredits}`);
      } else {
        console.error(`❌ User not found for email: ${customerEmail}`);
        console.error('💡 User must sign up in the app before purchasing credits');
      }
    }
  }
}
