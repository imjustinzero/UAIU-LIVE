import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('🎮 Creating UAIU Arcade credit products...');

  // Check if products already exist
  const existingProducts = await stripe.products.search({
    query: "metadata['type']:'arcade_credits'"
  });

  if (existingProducts.data.length > 0) {
    console.log('⚠️  Credit products already exist. Skipping creation.');
    console.log('Products found:', existingProducts.data.map(p => p.name));
    return;
  }

  // Create $5 credit pack
  const pack50 = await stripe.products.create({
    name: '50 Credits',
    description: 'Play 50 matches in UAIU Arcade',
    images: [],
    metadata: {
      type: 'arcade_credits',
      credits: '50'
    }
  });

  const price50 = await stripe.prices.create({
    product: pack50.id,
    unit_amount: 500, // $5.00 in cents
    currency: 'usd',
  });

  console.log('✅ Created $5 = 50 Credits');
  console.log('   Product ID:', pack50.id);
  console.log('   Price ID:', price50.id);

  // Create $10 credit pack
  const pack100 = await stripe.products.create({
    name: '100 Credits',
    description: 'Play 100 matches in UAIU Arcade',
    images: [],
    metadata: {
      type: 'arcade_credits',
      credits: '100'
    }
  });

  const price100 = await stripe.prices.create({
    product: pack100.id,
    unit_amount: 1000, // $10.00 in cents
    currency: 'usd',
  });

  console.log('✅ Created $10 = 100 Credits');
  console.log('   Product ID:', pack100.id);
  console.log('   Price ID:', price100.id);

  console.log('\n🎉 All products created successfully!');
  console.log('💡 Webhooks will automatically sync these to your database.');
}

createProducts()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating products:', error);
    process.exit(1);
  });
