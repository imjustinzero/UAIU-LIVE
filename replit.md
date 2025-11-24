# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU Arcade is a production-ready online multiplayer gaming platform featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players can purchase credits via Stripe, compete in server-authoritative matches across multiple games, and request payouts. Games run until natural completion based on scoring, with AI bot fallback after 1 second if no opponent is found. AI bots appear as real players with creative names. The platform prioritizes security, real-time performance, and a vibrant gaming experience, optimized for both mobile and desktop.

## Available Games
1. **Pong**: Classic vertical paddle game with real-time physics
2. **Snake**: Multiplayer survival race with collision detection
3. **Tetris**: Battle mode competition with falling blocks
4. **Breakout**: Brick breaking duel with paddle and ball physics
5. **Flappy Bird**: Survival race challenge with obstacle avoidance
6. **Connect 4**: Strategic drop game with turn-based gameplay

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## Recent Changes (November 24, 2025)
- **Email System Fixed**: Resend integration configured with fallback to default domain when custom domain unavailable
- **Resend Limitation**: Account currently in test mode - verification emails only deliver to uaiulive@gmail.com until domain verified
- **Profile System**: Users now have profile pages with editable information, stats display, and email verification
- **Email Verification Required**: New users start with 0 credits and must verify email to receive their first free credit
- **Profile Features**: View/edit name, resend verification emails, detailed statistics (win rate, earnings, matches)
- Leaderboard is now hidden from non-logged-in users for exclusivity
- AI bots now appear as real players with creative random names (e.g., "Blue Unicorn", "Zeus the Tetris God", "Cosmic Champion")
- Bot matchmaking delay reduced from 10 seconds to 1 second for instant-feeling matches
- Breakout paddle controls fixed to use continuous velocity movement like Pong

## System Architecture

### UI/UX Decisions
The frontend is built with React and TypeScript, styled using Tailwind CSS with a custom vibrant gaming color scheme (emerald green primary, cyan accent). It features responsive design for mobile and desktop, high-contrast elements, and clear typography. Key UI components include `GameCanvas`, `AuthModal`, `Leaderboard`, `ActionLog`, and `PayoutModal`.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Socket.IO Client, TanStack Query, Shadcn UI Components.
- **Backend**: Express server with REST API, Socket.IO for real-time communication, PostgreSQL with Drizzle ORM for data persistence, Bcrypt for password hashing, session-based authentication.
- **Game Mechanics**: Server-side physics for movement, collision detection, and scoring across multiple game types; touch controls; real-time multiplayer with sub-50ms latency; AI Bot matchmaking with intelligent bot AI.
  - **Pong**: Vertical layout, paddle collision, wall bounces, continuous action
  - **Snake**: Direction-based movement, food collection, collision detection
  - **Tetris**: Piece rotation, line clearing, competitive scoring
  - **Breakout**: Paddle and ball physics, brick collision and destruction
  - **Flappy Bird**: Gravity physics, pipe obstacle navigation
  - **Connect 4**: Turn-based token dropping, win condition detection
- **Credit Economy**: Users receive 1 free credit upon signup. Matches cost 1 credit to join. Winners receive 1.6 credits, losers lose 1 credit, with 0.4 credits burned as a platform fee.
- **Security**: Session-based authentication with token validation, server-authoritative game logic and credit mutations, Socket.IO handshake validation, secure payout requests.
- **Data Models**: `User`, `Match`, `ActionLog`, and `PayoutRequest` are defined with clear schemas.

### Feature Specifications
- **Real-Time Multiplayer**: Sub-50ms latency for responsive gameplay.
- **Credit Economy**: Purchase via Stripe, win/lose credits in matches, request payouts.
- **Profile System**: User profiles with editable information, verification status, and detailed statistics.
- **Email Verification**: Required for new users to receive their first free credit (1 credit awarded upon verification).
- **Leaderboard**: Real-time rankings by total credits (visible only to logged-in users).
- **Action Log**: Live feed of platform activities.
- **Authentication**: Secure session-based authentication with email verification.
- **AI Matchmaking**: Automatic match with AI bot if no opponent found in 1 second. Bots appear as real players with creative names.

### System Design Choices
The system employs a client-server architecture. The server manages all critical game logic, credit transactions, and user authentication to ensure fairness and prevent cheating. Data is persisted in a PostgreSQL database, ensuring state consistency across server restarts. Socket.IO is used for low-latency real-time game state synchronization.

### Game-Specific Implementation Details

All games feature server-authoritative logic to prevent cheating. Game state is synchronized at 60 FPS via Socket.IO. Bot AI provides single-player experience when matchmaking queue is empty after 1 second, with bots appearing as real players using creative random names.

#### Snake Bot AI Balancing
The Snake bot AI has been carefully balanced to provide challenging but beatable gameplay:
- Bot makes decisions every 30 frames (reduced reaction speed)
- Bot skips decisions 30% of the time (simulates mistakes)
- Bot picks random safe directions 40% of the time instead of optimal moves
- Matches typically last 15-30 seconds, giving players time to strategize and compete

## External Dependencies
- **Stripe**: For credit purchases and webhook-based automatic credit fulfillment.
- **Resend**: For transactional emails (verification, welcome, admin notifications). Currently configured with fallback sender (onboarding@resend.dev). Account in test mode - only sends to uaiulive@gmail.com until domain verified at https://resend.com/domains.
- **Socket.IO**: For real-time bidirectional communication between client and server.
- **PostgreSQL**: Relational database for persistent storage, managed with Drizzle ORM.
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For API data fetching and caching on the client-side.
- **Shadcn UI**: For UI components.