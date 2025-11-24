import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';

export async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL not found, skipping Stripe initialization');
    return null;
  }

  try {
    console.log('🔧 Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl,
      schema: 'stripe'
    });
    console.log('✅ Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('🔧 Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['checkout.session.completed'],
        description: 'UAIU Pong credit fulfillment',
      }
    );
    console.log(`✅ Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    console.log('🔧 Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('✅ Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });

    return { stripeSync, webhookUuid: uuid };
  } catch (error: any) {
    console.error('❌ Failed to initialize Stripe:', error.message);
    console.log('💡 Make sure Stripe connector is properly configured in Replit');
    return null;
  }
}
