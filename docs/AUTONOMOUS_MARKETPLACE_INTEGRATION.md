# Autonomous Marketplace Integration

## 1) Apply SQL
Run:

```sql
\i sql/20260306_autonomous_marketplace.sql
```

## 2) Add the route registration
In `server/routes.ts` add:

```ts
import { registerAutonomousMarketplaceRoutes } from "./autonomous-marketplace";
```

Inside `registerRoutes(app, httpServer)` after `app.use(express.json());` add:

```ts
registerAutonomousMarketplaceRoutes(app);
```

## 3) Add the admin UI panel
In `client/src/pages/Admin.tsx` import:

```ts
import { AutonomousMarketplaceAdmin } from "../components/admin/AutonomousMarketplaceAdmin";
```

Then add a new tab, for example `autonomy`, and render the component with the existing admin key:

```tsx
<AutonomousMarketplaceAdmin adminKey={adminKey} />
```

## 4) Add the public status / stop route
In `client/src/App.tsx` import:

```ts
import ZStop from "./pages/ZStop";
```

Then add:

```tsx
<Route path="/x/zstop" component={ZStop} />
```

## 5) Optional Exchange links
Link to:
- `/x/zstop`
- `/status`
- `/legal`

## 6) Replit / environment follow-up
- backup scheduler still needs an external trigger
- legal docs still need your final text
- if you want real seller cash payout, connect a payout provider or bank rails and replace the workflow-only `release` state with the live payout call

## 7) Build checks
Run:

```bash
npx tsc --noEmit
npm run build
```
