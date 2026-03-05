# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU is an online multiplayer gaming platform (/) featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy.

Players can purchase credits via Stripe, compete in server-authoritative matches across multiple games, and request payouts. The platform includes a referral system, social feed, and an instant onboarding process with a free credit upon signup. Games run until natural completion, with AI bot fallback after 10 seconds if no opponent is found. Bots appear as real players and win ~96% of matches, ensuring platform credit economy balance.

## Recent Changes (March 2026)
- **Wave 2 Exchange Features**: 5 new features integrated into UAIU.LIVE/X (/x route). (1) **Terminal Mode** — press T anywhere on the exchange to toggle a full-screen Bloomberg-style green-on-black terminal overlay showing live listings, trades, and market data. (2) **Voice RFQ** — mic button in the RFQ section uses Web Speech API + Claude to parse spoken orders and auto-fill the RFQ form fields (side, standard, volume, price, notes). (3) **Video Trade Room** — each listing card has a "Request Live Trade Call" button that creates a Daily.co room via existing `/api/daily/create-room` endpoint and opens a meeting link. (4) **AI Trade Negotiator** — appears below the RFQ form after submission; calls `/api/ai/negotiate` (new route) which uses Claude to analyze the RFQ against market conditions and returns a recommendation (action, counter_price, rationale, risk_assessment, confidence). (5) **Real-time Listing Chat** — Socket.io chat panel on each listing card; users join a per-listing room, see history, and exchange messages in real time. Socket handlers: `join-listing-chat`, `listing-chat-message`, `leave-listing-chat`. In-memory Maps: `listingChatHistory`, `listingOnlineUsers`. Component files in `client/src/components/exchange/`: TerminalMode.tsx, VoiceRFQ.tsx, TradeFeatures.tsx, ListingChat.tsx.
- **UAIU.LIVE/X Full Redesign + Supabase Layer**: Complete premium visual overhaul of the /x Exchange page. New dark ink (#060810) + gold (#d4a843) color scheme with Playfair Display / Syne / JetBrains Mono fonts. Custom cursor with spring-lag gold ring, film grain noise overlay, fixed nav + scrolling ticker bar, hero with 4 live metrics, slider-based compliance calculator, 5-nation Citizens Portal grid with waste-to-wealth programs + Karmic Econ section, inline List Credits form, RFQ Desk for institutional bulk offtake, blockchain receipt demo with trade ID verification, 3-card testimonials, 4-column footer. Trade modal with SHA-256 receipt hash chaining stored in session. Account modal: firstName/lastName/company/phone/accountType/annualCo2Exposure. New exchange_rfqs DB table + POST /api/exchange/rfq endpoint emailing info@uaiu.live. Supabase optional persistence layer: `@supabase/supabase-js` installed, `client/src/lib/supabase.ts` provides `dbInsert`/`dbSelect` with graceful demo_mode fallback when VITE_SUPABASE_URL/VITE_SUPABASE_KEY env vars are absent. Non-blocking saves after every form submission: trades→`trades`, accounts→`entities`, RFQs→`rfqs`, listings→`listing_submissions`. Schema file at `SUPABASE-SCHEMA.sql`. Security layer updated: removed devtools blur overlay, right-click blocking, F12/keyboard shortcut blocking entirely; replaced with silent session ID tracking, `_track()` log (capped 200 entries), DOM integrity monitor (8s interval snapshots nav/footer/#marketplace), console watermark.
- **Accessibility Upgrade**: Added accessibility settings system across the app. New `SettingsProvider` context (`client/src/lib/settings.ts`) persists font size (normal/large/x-large) and high contrast mode to sessionStorage and applies them as CSS classes to `document.documentElement`. New `AccessibilitySettings` component (gear icon popover) appears in the LiveVideo header for both logged-out and logged-in states. New `SkipLink` component adds keyboard-navigation "Skip to main content" anchor. App.tsx updated to wrap everything in SettingsProvider and `<main id="main">`. aria-label attributes added to icon buttons throughout LiveVideo.
- **Daily.co Video Chat Migration**: Replaced Metered.ca with Daily.co for live video chat at /live route. Server creates private Daily rooms via REST API, generates per-user meeting tokens. Frontend uses @daily-co/daily-js call object for video/audio tracks. Removed Metered SDK CDN loading. Environment: DAILY_API_KEY (secret), DAILY_ROOM_DOMAIN (env var). Old Metered TURN endpoint cleaned up.
- **Session Storage Fix (iOS iCloud)**: Switched from localStorage to sessionStorage for session tokens (pong-session, pong-user) to prevent iCloud Safari sync between iOS devices sharing the same Apple ID. Session helper utility at `client/src/lib/sessionHelper.ts` centralizes all session read/write operations. Users log in per browser tab/session (more secure for credit-based platform).
- **Home Page Updated**: UAIU Live Games is now the home page (/)
- **Contact Button**: Added to header, links to JustinZaragoza.com
- **Business Landing Page Removed**: Previous acquisition landing page has been removed

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The frontend uses React and TypeScript, styled with Tailwind CSS in a vibrant gaming color scheme (emerald green primary, cyan accent). It features responsive design, high-contrast elements, clear typography, and utilizes Shadcn UI Components. Key UI components include `GameCanvas`, `AuthModal`, `Leaderboard`, `ActionLog`, and `PayoutModal`. The profile and feed functionalities are unified into a tabbed interface.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Socket.IO Client, TanStack Query, Shadcn UI Components.
- **Backend**: Express server with REST API, Socket.IO for real-time communication, PostgreSQL with Drizzle ORM, Bcrypt for password hashing, session-based authentication.
- **Game Mechanics**: Server-side physics, collision detection, and scoring for Pong, Snake, Tetris, Breakout, Flappy Bird, and Connect 4. Features real-time multiplayer with sub-50ms latency and intelligent AI Bot matchmaking. Bots are highly skilled, achieving a 96%+ win rate.
- **Credit Economy**: Matches cost 1 credit. Winners receive 1.6 credits, losers lose 1, with 0.4 credits burned as a platform fee. Users receive 1 free credit upon signup. An affiliate program rewards referrers with 1 credit for every 10 credits purchased by referred users.
- **Security**: Session-based authentication, server-authoritative game logic, Socket.IO handshake validation, and secure payout requests.
- **Data Models**: `User`, `Match`, `ActionLog`, `PayoutRequest`, `ReferralPayout`, and `LiveMatchSession` with clear schemas.
- **Social Features**: Posts (text + optional YouTube URL), likes and comments (cost 1 credit), and a friend system. Likes and comments have atomic credit updates to manage transactions without full database transaction support.

### Feature Specifications
- **Real-Time Multiplayer**: Sub-50ms latency gameplay.
- **Credit Economy**: Stripe purchases, in-game credit management, and payout requests.
- **Profile System**: User profiles with editable info, game statistics (win rate, earnings, matches).
- **Instant Onboarding**: No email verification needed; immediate free credit.
- **Leaderboard**: Real-time rankings by total credits, visible only to logged-in users.
- **Action Log**: Live feed of platform activities.
- **Authentication**: Secure session-based authentication.
- **AI Matchmaking**: 10-second opponent search with "Match Now" option for instant bot play. Bots are named creatively to appear as real players.
- **Referral System**: Unique 8-character affiliate codes, rewards for referrers based on referred user purchases.
- **Social Feed**: Posts, likes, comments, and friend management. Admin users can make posts public.
- **Send Credits**: Users can send credits to friends via the Friends tab. Minimum transfer is 1 credit. Transfers are logged in the action log.
- **Live Video Chat**: Random video/audio/text chat matching at /live route using Daily.co private video rooms. Users pay 1 credit per session (no time limit - sessions run until user clicks Next or Disconnect). Server creates Daily rooms via REST API and generates per-user meeting tokens on match, both users join via @daily-co/daily-js call object. Features include Socket.IO matchmaking queue, video/audio controls, text chat via Socket.IO relay, Next/Disconnect/Cancel buttons, automatic room cleanup on disconnect/leave, and session tracking in database with actual duration recorded.

### System Design Choices
The system utilizes a client-server architecture. The server manages all critical game logic, credit transactions, user authentication, and live video session management to ensure fairness and security. Data is stored in PostgreSQL. Socket.IO provides low-latency real-time game state synchronization and matchmaking for live video chat. Live video uses Daily.co private rooms (created/deleted via REST API server-side) with per-user meeting tokens for authentication. The frontend uses @daily-co/daily-js call object to manage video/audio tracks directly in custom video elements. Live video sessions are tracked in-memory (no time limit) and database records store session history with actual duration. Text chat between matched users is relayed via Socket.IO events. Due to Neon HTTP driver limitations, credit operations for likes/comments use sequential atomic updates instead of full database transactions, with manual rollback on failure.

## External Dependencies
- **Stripe**: For credit purchases and webhook-based credit fulfillment.
- **Resend**: For admin signup notifications (uaiulive@gmail.com).
- **Socket.IO**: For real-time bidirectional communication.
- **PostgreSQL**: Relational database for persistent storage (via Drizzle ORM).
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For client-side API data fetching and caching.
- **Shadcn UI**: For UI components.
- **Daily.co**: For private video chat rooms (REST API for room/token management, @daily-co/daily-js call object for client-side video/audio).