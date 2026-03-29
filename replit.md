# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU is an online multiplayer gaming platform with a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players purchase credits, compete in server-authoritative matches, and can request payouts. Key features include a referral system, social feed, and instant onboarding with a free credit. The platform ensures continuous gameplay with AI bot fallback if no opponent is found, maintaining economic balance and providing an engaging, secure competitive gaming environment.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The frontend uses React and TypeScript with Tailwind CSS, featuring a vibrant gaming color scheme (emerald green primary, cyan accent) and Shadcn UI Components. It includes responsive design, high-contrast elements, and clear typography. A premium visual overhaul for the `/x` exchange page uses a dark ink and gold scheme with specific fonts (Playfair Display, Syne, JetBrains Mono). Accessibility settings allow users to adjust font size and contrast.

### Technical Implementations
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Socket.IO Client, TanStack Query, Shadcn UI Components.
- **Backend**: Express server with REST API, Socket.IO for real-time communication, PostgreSQL with Drizzle ORM, Bcrypt for password hashing, session-based authentication.
- **Game Mechanics**: Server-side physics, collision detection, and scoring for games like Pong, Snake, and Tetris. Features real-time multiplayer with low latency and intelligent AI Bot matchmaking.
- **Credit Economy**: Matches cost 1 credit; winners receive 1.6 credits, losers lose 1, with 0.4 credits burned as a platform fee. Includes a free credit upon signup and an affiliate program.
- **Security**: Session-based authentication, server-authoritative game logic, Socket.IO handshake validation, secure payout requests, and robust rate limiting on authentication and account creation endpoints. Database-level constraints ensure credit integrity and unique data relationships.
- **Data Models**: Core models include `User`, `Match`, `ActionLog`, `PayoutRequest`, and `ReferralPayout`. Exchange features autonomous marketplace tables for sellers, inventory, listings, RFQ matches, settlements, and payouts.
- **Social Features**: Posts (text + optional YouTube URL), likes and comments (cost 1 credit), and a friend system.
- **Exchange Features**: AI-powered tools (Compliance CoPilot, Due Diligence Report, Price Prediction, Carbon Budget Tracker), Terminal Mode, Voice RFQ, Video Trade Room, AI Trade Negotiator, Real-time Listing Chat, and escrow settlement. Includes institutional-grade features like bcrypt password auth, T&C gates, Stripe Checkout for spot trades, persistent trade history, carbon credit retirement certificates, and a portfolio summary dashboard. Registry/Retirement extension adds specific fields and processes for carbon credit management. E-Signature system provides legally compliant digital signing with cryptographic hashes and retention policies.
- **Autonomous Marketplace Layer**: Automates seller onboarding, KYB/KYC workflows, inventory verification, listing approval, RFQ auto-matching, settlement orchestration, and payout release. Includes an exception queue for admin triage.
- **Stripe Settlement Model**: Utilizes Stripe Connect destination charges for primary settlement, with platform fees collected via application fees. Funds flow directly from buyer to seller's Connect account, bypassing UAIU's balance.
- **Ops & Trust Layer**: Provides in-process telemetry, admin-controlled maintenance mode, public status page, off-site S3-compatible backup with daily pg_dump, and email alerts for backup failures. Includes institutional DR policy and documentation. Employs graceful server shutdown for reliability.
- **Regulatory Compliance Export**: Per-regime compliance fields (EU ETS, CORSIA, IMO MRV) on trades, with dedicated export endpoints generating tamper-detectable data.
- **Accessibility**: Implemented `SettingsProvider` for font size and high contrast mode, `SkipLink` for keyboard navigation, and `aria-label` attributes.

### System Design Choices
The system employs a client-server architecture. The server manages critical game logic, credit transactions, user authentication, and live video session management using Daily.co for server-side room creation and token generation. PostgreSQL stores persistent data. Socket.IO facilitates low-latency, real-time game state synchronization and matchmaking. Credit operations for social features use atomic updates with manual rollback. Session tokens are stored in `sessionStorage`.

## External Dependencies
- **Stripe**: For credit purchases, webhooks, escrow settlements, and Connect destination charges.
- **Resend**: For admin signup notifications.
- **Socket.IO**: For real-time bidirectional communication.
- **PostgreSQL**: Relational database (via Drizzle ORM).
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For client-side API data fetching and caching.
- **Shadcn UI**: For UI components.
- **Daily.co**: For private video chat rooms and client-side video/audio management.
- **Supabase**: Optional persistence layer for various platform data.
- **MQTT**: For IoT bridge real-time sensor data ingestion.