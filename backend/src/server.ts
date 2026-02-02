// backend/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { Pool } from 'pg';
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
app.set('trust proxy', true);

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual params if DATABASE_URL is not set (though .env has it)
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'rbac_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Standard Middleware
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:5173'
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

// Auth routes (public - no auth required)
app.use('/auth', createAuthRouter(pool));

// Mount RBAC routes with /rbac prefix
// All routes under /rbac/* require authentication
app.use('/rbac', createRBACRouter(pool));

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
