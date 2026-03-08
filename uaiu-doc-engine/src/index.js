require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const {
  documentQueue,
  auditPackQueue,
  documentWorker,
  auditPackWorker,
} = require('./queues/documentQueue');

const prisma = new PrismaClient();
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", ...allowedOrigins],
      },
    },
  })
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS origin denied'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info({ event: 'http_request', message: message.trim() }),
    },
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const triggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use('/api/trigger', triggerLimiter);

const triggersRouter = require('./routes/triggers');
const tradesRouter = require('./routes/trades');
const documentsRouter = require('./routes/documents');
const verificationRouter = require('./routes/verification');
const signingRouter = require('./routes/signing');

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/trigger', triggersRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/verification', verificationRouter);
app.use('/', signingRouter);
app.get('/verify/:tradeId', (req, res) => res.redirect(302, `/api/verification/${req.params.tradeId}`));

app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  logger.info({ event: 'server_started', port, env: process.env.NODE_ENV || 'development' });
  logger.info({ event: 'workers_started', queues: ['document-generation', 'audit-pack-assembly'] });
});

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: 'shutdown_started', signal });

  try {
    await Promise.allSettled([
      documentWorker.close(),
      auditPackWorker.close(),
      documentQueue.close(),
      auditPackQueue.close(),
      prisma.$disconnect(),
    ]);

    server.close(() => {
      logger.info({ event: 'shutdown_complete' });
      process.exit(0);
    });
  } catch (error) {
    logger.error({ event: 'shutdown_error', message: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
