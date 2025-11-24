# UAIU Pong - Multiplayer Pay-to-Play Platform

## Overview
UAIU Pong is a production-ready online multiplayer Pong platform featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players can purchase credits via Stripe, compete in server-authoritative matches, and request payouts. The platform prioritizes security, real-time performance, and a vibrant gaming experience, optimized for both mobile and desktop.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The frontend is built with React and TypeScript, styled using Tailwind CSS with a custom vibrant gaming color scheme (emerald green primary, cyan accent). It features responsive design for mobile and desktop, high-contrast elements, and clear typography. Key UI components include `GameCanvas`, `AuthModal`, `Leaderboard`, `ActionLog`, `PayoutModal`, and `RadioPlayer`.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Socket.IO Client, TanStack Query, Shadcn UI Components.
- **Backend**: Express server with REST API, Socket.IO for real-time communication, PostgreSQL with Drizzle ORM for data persistence, Bcrypt for password hashing, session-based authentication.
- **Game Mechanics**: Server-side physics for ball movement, collision detection, and scoring; vertical Pong layout; touch controls; real-time multiplayer with sub-50ms latency; AI Bot matchmaking with intelligent bot AI.
- **Credit Economy**: Users receive 1 free credit upon signup. Matches cost 1 credit to join. Winners receive 1.6 credits, losers lose 1 credit, with 0.4 credits burned as a platform fee.
- **Security**: Session-based authentication with token validation, server-authoritative game logic and credit mutations, Socket.IO handshake validation, secure payout requests.
- **Data Models**: `User`, `Match`, `ActionLog`, and `PayoutRequest` are defined with clear schemas.

### Feature Specifications
- **Real-Time Multiplayer**: Sub-50ms latency for responsive gameplay.
- **Credit Economy**: Purchase via Stripe, win/lose credits in matches, request payouts.
- **Leaderboard**: Real-time rankings by total credits.
- **Action Log**: Live feed of platform activities.
- **Authentication**: Secure session-based authentication.
- **AI Matchmaking**: Automatic match with AI bot if no opponent found in 10 seconds.

### System Design Choices
The system employs a client-server architecture. The server manages all critical game logic, credit transactions, and user authentication to ensure fairness and prevent cheating. Data is persisted in a PostgreSQL database, ensuring state consistency across server restarts. Socket.IO is used for low-latency real-time game state synchronization.

## External Dependencies
- **Stripe**: For credit purchases and webhook-based automatic credit fulfillment.
- **Socket.IO**: For real-time bidirectional communication between client and server.
- **PostgreSQL**: Relational database for persistent storage, managed with Drizzle ORM.
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For API data fetching and caching on the client-side.
- **Shadcn UI**: For UI components.
- **360 Radio**: Embedded radio player (URL: `https://ssl.sonicpanel.com/8172/stream`).