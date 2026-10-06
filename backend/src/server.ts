import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { config } from './config';
import { createRBACRouter, createPublicAuthRouter } from './rbac/routes';
import { createAuthRouter } from './rbac/routes/auth.routes';
import { errorHandler, notFoundHandler } from './rbac/middleware/errorHandler.middleware';
import { standardLimiter } from './rbac/middleware/rateLimit.middleware';

const app = express();
const apiRouter = express.Router();
const PORT = config.port;

app.set('trust proxy', 1);

app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const inboundRequestId = req.headers['x-request-id'];
  const requestId = typeof inboundRequestId === 'string' && inboundRequestId.trim()
    ? inboundRequestId
    : randomUUID();

  req.requestId = requestId;

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-permitted-cross-domain-policies', 'none');

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const log = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    };
    console.info(JSON.stringify(log));
  });

  next();
});

app.use(cookieParser(config.cookieSecret));
app.use(standardLimiter);

app.use('/uploads', express.static(config.uploads.root));

apiRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.one<{ ok: number }>('SELECT 1 AS ok');
    res.status(200).json({
      status: 'ready',
      service: 'rbac-backend',
      environment: config.env,
      version: config.appVersion
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      service: 'rbac-backend',
      environment: config.env,
      version: config.appVersion
    });
  }
});

apiRouter.use('/auth', createAuthRouter(db));
apiRouter.use('/rbac', createRBACRouter(db));
apiRouter.use('/public', createPublicAuthRouter(db));

app.use('/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('-----------------------------------------');
  console.log(`Server is listening on: http://localhost:${PORT}`);
  console.log(`Environment: ${config.env}`);
  console.log('RBAC routes mounted at: /v1/rbac/*');
  console.log('Signed cookies enabled');
  console.log('Rate limiting middleware active');
  console.log('-----------------------------------------');
  console.log(`SERVER PID: ${process.pid}`);
});
