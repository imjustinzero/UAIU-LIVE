# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU Arcade is a production-ready online multiplayer gaming platform featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players can purchase credits via Stripe, compete in server-authoritative matches across multiple games, and request payouts. The platform includes a referral system, social feed, and an instant onboarding process with a free credit upon signup. Games run until natural completion, with AI bot fallback after 10 seconds if no opponent is found. Bots appear as real players and win ~96% of matches, ensuring platform credit economy balance.

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
- **Live Video Chat**: Standalone random video chat matching at /live route. Users pay 1 credit per session for 1-minute peer-to-peer video calls via WebRTC. Features include matchmaking queue, server-enforced 60-second time limit, video/audio controls, Next/Disconnect buttons, and session tracking in database.

### System Design Choices
The system utilizes a client-server architecture. The server manages all critical game logic, credit transactions, user authentication, and live video session management to ensure fairness and security. Data is stored in PostgreSQL. Socket.IO provides low-latency real-time game state synchronization and WebRTC signaling for peer-to-peer video connections. All signaling messages are validated to ensure they originate from and target matched partners only. Live video sessions are tracked in-memory with automatic 60-second timeouts and database records for session history. Due to Neon HTTP driver limitations, credit operations for likes/comments use sequential atomic updates instead of full database transactions, with manual rollback on failure.

## External Dependencies
- **Stripe**: For credit purchases and webhook-based credit fulfillment.
- **Resend**: For admin signup notifications (uaiulive@gmail.com).
- **Socket.IO**: For real-time bidirectional communication.
- **PostgreSQL**: Relational database for persistent storage (via Drizzle ORM).
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For client-side API data fetching and caching.
- **Shadcn UI**: For UI components.