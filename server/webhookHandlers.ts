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
      
      // Only process successful, paid sessions
      if (session.payment_status !== 'paid') {
        console.log(`⏭️ Skipping session ${session.id} - payment status: ${session.payment_status}`);
        return;
      }

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

        // Credit the referrer if this user was referred
        // Referrer earns 1 credit per 10 credits purchased by the referred user
        // Use dedicated referral_payouts ledger with unique constraint on session ID for idempotency
        // Also prevent self-referral
        if (user.referredBy && user.referredBy !== user.id) {
          const sessionId = session.id;
          
          const referrer = await storage.getUser(user.referredBy);
          if (referrer) {
            // Calculate referral credits: 1 credit per 10 credits purchased
            const referralCredits = Math.floor(creditsToAdd / 10);
            
            if (referralCredits > 0) {
              // Attempt to create referral payout record (atomic idempotency check)
              const payoutRecord = await storage.createReferralPayout({
                stripeSessionId: sessionId,
                referrerId: referrer.id,
                referrerName: referrer.name,
                refereeId: user.id,
                refereeName: user.name,
                creditsAwarded: referralCredits,
                purchaseAmount: amountPaid,
                creditsPurchased: creditsToAdd,
              });

              if (payoutRecord) {
                // First payout for this session - credit the referrer
                const referrerNewCredits = referrer.credits + referralCredits;
                await storage.updateUserCredits(referrer.id, referrerNewCredits);
                
                await storage.addActionLog({
                  userId: referrer.id,
                  userName: referrer.name,
                  type: 'referral',
                  message: `${referrer.name} earned ${referralCredits} credit(s) from ${user.name}'s purchase of ${creditsToAdd} credits`,
                });

                console.log(`🎁 Credited referrer ${referrer.name} with ${referralCredits} credit(s). New balance: ${referrerNewCredits}`);
              } else {
                console.log(`ℹ️ Skipping duplicate referral credit for session ${sessionId} (already processed)`);
              }
            }
          }
        }
      } else {
        console.error(`❌ User not found for email: ${customerEmail}`);
        console.error('💡 User must sign up in the app before purchasing credits');
      }
    }
  }
}
