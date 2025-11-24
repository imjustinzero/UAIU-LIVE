# UAIU Pong - Multiplayer Pay-to-Play Pong Platform

A production-ready, real-time multiplayer Pong platform with credit-based gameplay and real money payouts.

## Features

- **Real-time Multiplayer**: Server-side physics with Socket.IO for fair, cheat-proof gameplay
- **Pay-to-Play Economy**: $1 = 10 credits, 1 credit per match entry
- **Credit System**: Winner gets 1.6 credits, loser loses 1 credit, 0.4 credits burned per match
- **Matchmaking Queue**: Automatic pairing of players
- **Leaderboard**: Live rankings by credits and stats
- **Payout System**: Request cash out via CashApp, Venmo, PayPal, etc.
- **Mobile-First Design**: Touch controls and responsive layout
- **Embedded 360 Radio Player**: Background music while playing

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory (if not using Replit secrets):

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Stripe Configuration (REQUIRED for payment processing)
# Get these from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email Configuration (REQUIRED for notifications)
# Option 1: Gmail SMTP
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
NOTIFICATION_EMAIL=uaiulive@gmail.com

# Option 2: SendGrid (Alternative)
# SENDGRID_API_KEY=your_sendgrid_api_key

# Session Secret (REQUIRED)
SESSION_SECRET=your-random-session-secret
```

### 3. Stripe Integration

#### Set up Stripe Checkout

The platform uses Stripe for payment processing. You've provided this checkout link:
`https://buy.stripe.com/8x26oIa5OacYb46eVCcMM02`

#### Set up Stripe Webhook (For automatic credit fulfillment)

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Set endpoint URL to: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

#### Webhook Implementation

Add this endpoint in `server/routes.ts` (currently placeholder):

```typescript
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userEmail = session.customer_email;
    
    // Add 10 credits to user account
    const user = await storage.getUserByEmail(userEmail);
    if (user) {
      await storage.updateUserCredits(user.id, user.credits + 10);
      await storage.addActionLog({
        type: 'credit',
        message: `${user.name} purchased 10 credits`
      });
    }
  }

  res.json({received: true});
});
```

### 4. Email Notifications

Email notifications are sent for:
- New user signups → `uaiulive@gmail.com`
- Payout requests → `uaiulive@gmail.com`

#### Using Gmail (Recommended for development)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `EMAIL_PASSWORD` environment variable

#### Using SendGrid (Recommended for production)

1. Sign up at https://sendgrid.com
2. Create an API key
3. Set `SENDGRID_API_KEY` environment variable

#### Email Implementation

Add this helper function in a new file `server/email.ts`:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export async function sendSignupNotification(email: string, name: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'uaiulive@gmail.com',
    subject: 'New UAIU Pong User Signup',
    html: `
      <h2>New User Registration</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    `
  });
}

export async function sendPayoutNotification(user: any, amount: number, paymentMethod: string, paymentInfo: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'uaiulive@gmail.com',
    subject: 'UAIU Pong Payout Request',
    html: `
      <h2>Payout Request</h2>
      <p><strong>User:</strong> ${user.name} (${user.email})</p>
      <p><strong>Amount:</strong> ${amount.toFixed(1)} credits</p>
      <p><strong>Cash Value:</strong> $${((amount / 10) * 0.9).toFixed(2)}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod}</p>
      <p><strong>Payment Info:</strong> ${paymentInfo}</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    `
  });
}
```

Then call these functions in `server/routes.ts`:
- `sendSignupNotification()` in `/api/auth/signup`
- `sendPayoutNotification()` in `/api/payout/request`

### 5. Running the Application

#### Development
```bash
npm run dev
```

#### Production
```bash
npm run build
npm start
```

### 6. Embedding in Website

The entire application can be embedded in `uaiu.live` using an iframe:

```html
<iframe 
  src="https://your-pong-app.replit.app" 
  width="100%" 
  height="100%" 
  frameborder="0"
  allow="autoplay; fullscreen"
></iframe>
```

Or as a full-page embed:

```html
<style>
  body { margin: 0; overflow: hidden; }
  #pong-embed { width: 100vw; height: 100vh; border: none; }
</style>
<iframe id="pong-embed" src="https://your-pong-app.replit.app"></iframe>
```

## Game Rules

1. **Entry**: 1 credit per match (deducted when joining matchmaking)
2. **Victory**: Winner receives 1.6 credits total (net gain of 0.6 credits)
3. **Defeat**: Loser receives nothing (net loss of 1 credit)
4. **Burn Rate**: 0.4 credits burned per match (platform fee)
5. **Win Condition**: First player to score 5 points wins

## Payout System

- Minimum payout: 10 credits recommended
- Payout fee: 10% (credits worth $0.10 each, payout at $0.09 per credit)
- Credits reset to zero after payout request
- Manual processing to prevent fraud

## Architecture

### Frontend
- React with TypeScript
- TanStack Query for data fetching
- Socket.IO client for real-time game updates
- Shadcn UI components
- Tailwind CSS for styling

### Backend
- Node.js with Express
- Socket.IO for WebSocket connections
- In-memory storage (upgrade to PostgreSQL for production)
- Bcrypt for password hashing
- Server-side game physics (60 FPS)

### Game Engine
- Canvas-based rendering
- Server-authoritative physics
- 60 FPS game loop
- Collision detection
- Paddle and ball physics

## Security Features

- Server-side game state (prevents cheating)
- Password hashing with bcrypt
- Credit validation before matchmaking
- Payout confirmation system
- Session management

## Production Deployment Checklist

- [ ] Set up PostgreSQL database
- [ ] Configure Stripe webhook endpoint
- [ ] Set up email service (SendGrid/Gmail)
- [ ] Add SSL/TLS certificate
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Add CORS whitelist for uaiu.live domain
- [ ] Test Stripe payments in live mode
- [ ] Test payout workflow end-to-end
- [ ] Set up backup and recovery
- [ ] Configure auto-scaling if needed

## Support

For questions or issues, contact: uaiulive@gmail.com

## License

Proprietary - All rights reserved
