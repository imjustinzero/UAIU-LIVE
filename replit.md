# UAIU Arcade - Multi-Game Pay-to-Play Platform

## Overview
UAIU Arcade is a production-ready online multiplayer gaming platform featuring a pay-to-play model, real-time 1v1 matchmaking, and a credit-based economy. Players can purchase credits via Stripe, compete in server-authoritative matches across multiple games, and request payouts. Games run until natural completion based on scoring, with AI bot fallback after 10 seconds if no opponent is found. AI bots appear as real players with creative names and win ~87% of matches. Leaderboard hidden from non-logged-in users. New users receive 1 free credit immediately upon signup (no email verification required).

## Available Games
1. **Pong**: Classic vertical paddle game with real-time physics
2. **Snake**: Multiplayer survival race with collision detection
3. **Tetris**: Battle mode competition with falling blocks
4. **Breakout**: Brick breaking duel with paddle and ball physics
5. **Flappy Bird**: Survival race challenge with obstacle avoidance
6. **Connect 4**: Strategic drop game with turn-based gameplay

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am asked before major changes are made. Do not make changes to the `server/stripe-config.ts` file without explicit instruction. Do not make changes to the `server/email-config.ts` file without explicit instruction.

## Recent Changes (November 25, 2025)

### Latest Updates
- **Combined Profile/Feed Page**: Unified user experience with tabbed interface
  - Profile tab: Personal info, game statistics, credits, win rate, earnings
  - Feed tab: Create posts, view feed, like/comment on posts
  - Friends tab: Manage friend list, add/remove friends
  - Single navigation button (UserCircle icon) instead of separate Feed/Profile buttons
  - Per-post comment state prevents cross-contamination
  - Auth-gated queries prevent unauthorized access

- **Like Credit System Fixes**: Fixed multiple critical bugs in like/comment functionality
  - Auto-generate unique usernames during signup (required for likes/comments)
  - Fixed getFriends SQL error (changed from malformed ANY() to inArray())
  - Removed database transaction dependency for Neon HTTP driver compatibility
  - Sequential operations with atomic credit updates and manual rollback on failure
  - Unique constraints on likes table prevent duplicate payments

- **Admin Public Post Feature**: Admin account (imjustinzero@gmail.com) can now toggle post visibility
  - Visibility toggle appears only for admin user with "Friends Only" (default) and "Public (Everyone)" options
  - Public posts from admin are visible to all users' feeds regardless of friend status
  - Server-side validation ensures only admin can create public posts (403 error for non-admin attempts)
  - Feed query restricts public posts to admin user only for security
  - All other users' posts remain friends-only

- **Social Feed Feature**: Complete social network layer with posts, likes, comments, and friend system
  - Posts support text + optional YouTube URL embedding  
  - Likes/comments cost 1 credit (0.6 to creator, 0.4 burned)
  - Friend system allows adding friends by @username or email
  - Feed shows user's own posts and friends' posts
  - Authorization checks ensure users can only interact with friends' posts
  - Unique constraint on likes prevents duplicate paid likes

- **10-Second Countdown Feature**: Games now start with a 10-second countdown timer
- **Match Now Button**: Players can instantly start a match with an AI bot by clicking "Match Now" during countdown
- **Real-Time Countdown Updates**: Countdown timer updates every second via Socket.IO for smooth UX

## Known Limitations / Accepted Risks

### No Database Transaction Support (Technical Limitation - Nov 25, 2025)
**Issue**: Neon HTTP driver doesn't support database transactions, so like/comment credit operations use sequential atomic updates instead of true ACID transactions.

**Implementation**: processLikeTransaction and processCommentTransaction use:
1. Pre-check for sufficient credits and duplicate prevention
2. Create like/comment record (unique constraint prevents duplicates)
3. Deduct credit from user (atomic UPDATE with balance check in WHERE clause)
4. If deduction fails, delete like/comment record (manual rollback)
5. Add 0.6 credits to creator (atomic UPDATE)
6. Update post like/comment count (atomic UPDATE)

**Edge Cases**: If server crashes or network fails between steps, system may be in inconsistent state (e.g., like exists but credits not transferred). These scenarios are extremely rare and only occur during infrastructure failures.

**Mitigation**:
- Atomic credit updates with balance checks prevent negative balances
- Unique constraints prevent duplicate likes/comments
- Authorization checks ensure only friends can interact
- Manual rollback of like/comment if credit deduction fails

### Comment Rate Limiting Race Condition (Accepted Risk - Nov 25, 2025)
**Issue**: Comment rate limiting has a theoretical race condition under highly concurrent automated attacks. Without transaction support, the rate limit check (getLastCommentTime) and comment insert are separate operations, allowing concurrent requests to bypass the 30-second cooldown.

**Impact**: Coordinated scripted attacks could potentially drain user credits by posting multiple paid comments in rapid succession.

**Business Decision**: User explicitly accepted this limitation (quote: "no worries no one's going to spam"). The risk is acceptable for current usage patterns where organic users are not expected to attempt spam.

**Mitigation**: 
- Rate limiting check provides protection against casual spam
- Unique constraint on likes prevents similar issue for like functionality
- Authorization checks ensure only friends can interact
- Credit deduction has atomic balance check to prevent negative credits

**Future Enhancement** (Backlog):
- Implement partial unique index on `(post_id, user_id, date_trunc('minute', created_at))` for complete protection
- Add monitoring/alerting for unusual comment burst patterns and credit deductions
- Consider throttle table with dedicated lock rows for guaranteed serialization
- Migrate to PostgreSQL driver with transaction support (not HTTP-based)

## Recent Changes (November 24, 2025)
- **Email Verification Removed**: New users now receive 1 credit immediately upon signup - no email verification required
- **Simplified Onboarding**: Users can start playing instantly after registration
- **Profile System**: Users now have profile pages with editable information and detailed statistics
- **Profile Features**: View/edit name, detailed statistics (win rate, earnings, matches)
- **Security Update**: Removed verification endpoints to prevent potential exploits
- **Email System**: Admin signup notifications still work (sent to uaiulive@gmail.com)
- Leaderboard is now hidden from non-logged-in users for exclusivity
- AI bots now appear as real players with creative random names (e.g., "Blue Unicorn", "Zeus the Tetris God", "Cosmic Champion")
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
- **Profile System**: User profiles with editable information and detailed statistics.
- **Instant Onboarding**: New users receive 1 free credit immediately upon signup (no email verification required).
- **Leaderboard**: Real-time rankings by total credits (visible only to logged-in users).
- **Action Log**: Live feed of platform activities.
- **Authentication**: Secure session-based authentication.
- **AI Matchmaking**: 10-second countdown for finding opponents, with instant "Match Now" button to immediately pair with AI bot. Bots appear as real players with creative names.

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
- **Resend**: For admin notifications (signup notifications sent to uaiulive@gmail.com). Currently configured with fallback sender (onboarding@resend.dev). Account in test mode - only sends to uaiulive@gmail.com until domain verified at https://resend.com/domains.
- **Socket.IO**: For real-time bidirectional communication between client and server.
- **PostgreSQL**: Relational database for persistent storage, managed with Drizzle ORM.
- **Bcrypt**: For secure password hashing.
- **TanStack Query**: For API data fetching and caching on the client-side.
- **Shadcn UI**: For UI components.