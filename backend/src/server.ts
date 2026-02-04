// backend/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { db } from './db';
import { createRBACRouter } from './rbac/routes';
import { createAuthRouter } from './rbac/routes/auth.routes';
import { errorHandler, notFoundHandler } from './rbac/middleware/errorHandler.middleware';
import { standardLimiter } from './rbac/middleware/rateLimit.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!process.env.COOKIE_SECRET) {
  console.error('FATAL: COOKIE_SECRET environment variable is not set');
  process.exit(1);
}
app.set('trust proxy', 0);

// Standard Middleware
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));
app.use(express.json());

// Cookie parser with secret for signed cookies
app.use(cookieParser(process.env.COOKIE_SECRET));

// Global rate limiting (100 req/min) for all routes
app.use(standardLimiter);

// Basic Health Check Route (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    message: 'RBAC Backend is running',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes (public)
app.use('/auth', createAuthRouter(db));

// RBAC routes (protected)
app.use('/rbac', createRBACRouter(db));


// Error handling middleware (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`-----------------------------------------`);
  console.log(`🚀 Server is breathing at: http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 RBAC routes mounted at: /rbac/*`);
  console.log(`🔒 Signed cookies enabled`);
  console.log(`⚡ Rate limiting active: ${process.env.RATE_LIMIT_API_MAX || 100} req/min`);
  console.log(`-----------------------------------------`);
});
