# Design Guidelines: UAIU Pong Platform

## Design Approach

**Reference-Based Gaming Platform Design**

Drawing inspiration from modern competitive gaming platforms (Kahoot, Chess.com, Twitch) combined with fintech clarity (Stripe, Robinhood). The design must convey excitement, competition, and trust simultaneously—a challenging balance for a pay-to-play platform.

Key principles:
- **High-energy gaming aesthetic** with professional credibility
- **Real-time data prominence** (leaderboards, action logs, credit balance)
- **Mobile-first touch controls** that feel responsive and satisfying
- **Clear hierarchy** between game state, account info, and actions

---

## Typography

**Font Stack:**
- Primary: Inter (Google Fonts) - for UI, stats, credits
- Display: Space Grotesk (Google Fonts) - for headings, CTAs, game titles
- Monospace: JetBrains Mono - for credit amounts, scores

**Scale:**
- Game title/hero: text-6xl to text-8xl, font-bold
- Section headers: text-3xl to text-4xl, font-bold
- Stats/credits: text-2xl to text-3xl, font-semibold
- Leaderboard entries: text-lg, font-medium
- Action log: text-sm to text-base
- Body/forms: text-base
- Metadata: text-xs to text-sm, uppercase tracking-wide

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 8, 12, 16 (p-2, h-8, gap-4, mb-12, py-16)

**Container Strategy:**
- Game canvas: Fixed aspect ratio container, max-w-2xl centered
- Dashboard sections: max-w-7xl with grid layouts
- Modals: max-w-md for forms, max-w-lg for confirmations

**Grid System:**
- Desktop: 3-column layout (Leaderboard | Game Canvas | Action Log)
- Tablet: 2-column stacked (Game full-width, then Leaderboard/Log side-by-side)
- Mobile: Single column stack

---

## Component Library

### Navigation/Header
- Fixed top bar with logo, credit balance (prominent, pulsing on update), and account menu
- Credit balance displayed as large pill with icon: "💎 127.4 Credits"
- Login/Signup triggers modal overlay
- Mobile: Hamburger menu for account options

### Game Canvas Section
- Centered rectangular canvas (16:9 or custom Pong aspect)
- Canvas surrounded by glowing border that pulses during gameplay
- Below canvas: Large touch-friendly control buttons (← LEFT | RIGHT →)
- Control buttons: min-h-16, w-full on mobile, spread with gap-4
- Match status overlay (connecting, in-game, victory/defeat)
- "Play" button when idle: Oversized (h-16 to h-20), full-width on mobile

### Leaderboard Panel
- Top 10 players displayed
- Each entry: Rank badge, username, credit amount, win/loss ratio
- Current user highlighted with distinct treatment (border, subtle background)
- Sticky header with "🏆 Top Players" title
- Compact card design with gap-2 between entries

### Action Log Panel
- Real-time scrolling feed (max-h-96, overflow-y-auto)
- Each log entry: timestamp, player names, outcome, credits exchanged
- Latest entries appear at top with brief fade-in animation
- Color-coded by event type (victory, defeat, payout, credit purchase)

### Modals
**Login/Signup:**
- Center overlay with backdrop blur
- Form fields: email (required), name (required), password
- Large CTAs for "Create Account" and "Login"
- Toggle between login/signup views

**Payment Modal:**
- Triggered by "Add Credits" button
- Shows "$1 = 10 Credits" prominently
- Stripe checkout button (branded, full-width)
- Credit purchase history (last 3 transactions)

**Payout Request:**
- Warning message about credit reset
- Input for payment method selection (dropdown: CashApp, Venmo, PayPal, Other)
- Text input for payment handle/email
- Confirmation checkbox: "I understand all credits will be reset to zero"
- Submit button with loading state

### Embedded Radio Player
- Fixed bottom bar or collapsible side widget
- Minimal controls: play/pause, volume, station name
- Semi-transparent background with backdrop blur
- Doesn't interfere with game controls

### Share Buttons
- Floating action button or header icon
- Opens modal with social links (Twitter, Facebook, copy link)
- Pre-populated share text: "I'm playing Pong on UAIU.live! 🎮"

### Forms & Inputs
- Input fields: h-12, rounded-lg, px-4
- Labels: text-sm, font-medium, mb-2
- Error states: red border, helper text below
- Success states: green border, checkmark icon

### Buttons
**Primary (Play, Pay, Submit):**
- h-12 to h-16, px-8, rounded-lg to rounded-xl
- font-semibold, text-lg
- Glow effect on hover (shadow-lg to shadow-2xl transition)

**Secondary (Cancel, Back):**
- h-10 to h-12, px-6, rounded-lg
- font-medium, text-base

**Touch Controls:**
- Paddle buttons: h-16, w-full on mobile, w-48 on desktop
- Active state with scale transform (scale-95)

---

## Images

**Hero Section:** No traditional hero image. The game canvas IS the hero—center it prominently with animated glow effects and dynamic match states.

**Background Treatment:** Subtle gradient mesh or geometric pattern as page background (non-distracting, low opacity).

**Avatar Placeholders:** Generic user icons for leaderboard entries (can be replaced with user uploads later).

**Decorative Elements:** Trophy icons, credit gem icons, victory/defeat badges—use icon libraries (Heroicons or Font Awesome).

---

## Animations

**Essential Only:**
- Credit balance pulse on change (scale + glow)
- Button press feedback (scale-95 active state)
- Victory/defeat modal entrance (fade + scale)
- Action log new entry fade-in
- Ball movement is handled by canvas, not CSS

**Avoid:** Excessive page transitions, scroll effects, autoplay animations

---

## Responsive Breakpoints

- Mobile (base to md): Single column, full-width game, stacked panels
- Tablet (md to lg): 2-column hybrid, game spans full width
- Desktop (lg+): 3-column dashboard layout