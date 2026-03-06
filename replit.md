# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU is an online multiplayer gaming platform featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players purchase credits via Stripe, compete in server-authoritative matches, and request payouts. The platform includes a referral system, social feed, and instant onboarding with a free credit. Games run until natural completion, with AI bot fallback if no opponent is found, ensuring economic balance. The platform aims to provide an engaging and secure environment for competitive gaming.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The frontend uses React and TypeScript, styled with Tailwind CSS in a vibrant gaming color scheme (emerald green primary, cyan accent). It features responsive design, high-contrast elements, clear typography, and utilizes Shadcn UI Components. The platform underwent a premium visual overhaul for the `/x` exchange page, adopting a dark ink and gold color scheme with specific fonts (Playfair Display, Syne, JetBrains Mono). Accessibility settings are integrated, allowing users to adjust font size and contrast.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Socket.IO Client, TanStack Query, Shadcn UI Components.
- **Backend**: Express server with REST API, Socket.IO for real-time communication, PostgreSQL with Drizzle ORM, Bcrypt for password hashing, session-based authentication.
- **Game Mechanics**: Server-side physics, collision detection, and scoring for multiple games (Pong, Snake, Tetris, Breakout, Flappy Bird, Connect 4). Features real-time multiplayer with sub-50ms latency and intelligent AI Bot matchmaking (96%+ win rate).
- **Credit Economy**: Matches cost 1 credit. Winners receive 1.6 credits, losers lose 1, with 0.4 credits burned as a platform fee. Includes a free credit upon signup and an affiliate program.
- **Security**: Session-based authentication, server-authoritative game logic, Socket.IO handshake validation, secure payout requests. All seller and AI/Exchange endpoints require `requireAuth`. IDOR on seller endpoints fixed (session-based email lookup). Non-atomic credit deductions replaced with SQL-level atomic `deductCredits` (`WHERE credits >= amount`). DB-level constraints: `credits >= 0` check + unique friendship pairs enforced.
- **Data Models**: `User`, `Match`, `ActionLog`, `PayoutRequest`, `ReferralPayout`, and `LiveMatchSession`.
- **Social Features**: Posts (text + optional YouTube URL), likes and comments (cost 1 credit), and a friend system.
- **Exchange Features**: Includes AI-powered tools such as a Compliance CoPilot, Due Diligence Report generator, Price Prediction Engine, and Carbon Budget Tracker. It also features Terminal Mode, Voice RFQ, Video Trade Room, AI Trade Negotiator, and Real-time Listing Chat. Escrow settlement for high-value trades is supported.
- **Accessibility**: Implemented `SettingsProvider` for font size and high contrast mode persistence, `SkipLink` for keyboard navigation, and `aria-label` attributes for improved accessibility.

### System Design Choices
The system uses a client-server architecture where the server manages critical game logic, credit transactions, user authentication, and live video session management. Data is stored in PostgreSQL. Socket.IO facilitates low-latency real-time game state synchronization and matchmaking for live video chat. Live video functionality is powered by Daily.co, with server-side room creation and token generation. Credit operations for social features use atomic updates with manual rollback due to database driver limitations. Session tokens are stored in `sessionStorage` for enhanced security.

## External Dependencies
- **Stripe**: For credit purchases, webhooks, and escrow settlements.
- **Resend**: For admin signup notifications.
- **Socket.IO**: For real-time bidirectional communication.
- **PostgreSQL**: Relational database for persistent storage (via Drizzle ORM).
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For client-side API data fetching and caching.
- **Shadcn UI**: For UI components.
- **Daily.co**: For private video chat rooms and client-side video/audio management.
- **Supabase**: Optional persistence layer for various platform data (trades, accounts, RFQs, listings) with graceful fallback.