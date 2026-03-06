import { createServer, type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import helmet from "helmet";

import { registerRoutes } from "./routes";
import { createOpsMonitoringMiddleware } from "./ops-monitoring";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://*.daily.co"],
      frameSrc: ["https://js.stripe.com", "https://*.stripe.com", "https://*.daily.co"],
      imgSrc: ["'self'", "data:", "https://*.stripe.com"],
      connectSrc: ["'self'", "https://*.stripe.com", "https://*.daily.co", "https://api.supabase.co"],
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  noSniff: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// NOTE: Body parsing middleware is applied PER-ROUTE in server/routes.ts
// - Stripe webhook uses express.raw() for Buffer payload
// - All other routes use express.json() for JSON parsing
// This prevents the webhook signature verification from breaking

app.use(createOpsMonitoringMiddleware());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  // Create the HTTP server ONCE here
  const server = createServer(app);
  
  // Pass the server to registerRoutes to attach Socket.IO
  await registerRoutes(app, server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Graceful shutdown — release the port cleanly on SIGTERM/SIGINT so rapid
  // restarts (e.g. during development hot-reload) don't cause EADDRINUSE.
  const shutdown = (signal: string) => {
    log(`${signal} received — closing HTTP server`);
    server.close(() => {
      log('HTTP server closed');
      process.exit(0);
    });
    // Force-exit after 5 s if connections are still open
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  // Retry listen on EADDRINUSE — deployments can take longer than a few
  // seconds to fully release the previous process and socket.
  const MAX_RETRIES = 30;
  const RETRY_DELAY_MS = 1000;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const tryListenOnce = () =>
    new Promise<boolean>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        cleanup();
        if (err.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }
        reject(err);
      };

      const onListening = () => {
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        server.off('error', onError);
        server.off('listening', onListening);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen({ port, host: '0.0.0.0' });
    });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isListening = await tryListenOnce();
    if (isListening) {
      log(`serving on port ${port}`);
      return;
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(
        `Port ${port} remained in use after ${MAX_RETRIES + 1} attempts`,
      );
    }

    log(
      `Port ${port} in use — retry ${attempt + 1}/${MAX_RETRIES + 1} in ${RETRY_DELAY_MS}ms`,
    );
    await wait(RETRY_DELAY_MS);
  }
}
