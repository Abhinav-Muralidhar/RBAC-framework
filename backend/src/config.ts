import dotenv from 'dotenv';
import path from 'node:path';
import { getSecretValue } from './utils/secret.utils';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

function asInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for ${name}`);
  }
  return parsed;
}

function asNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

const nodeEnv = asNodeEnv(process.env.NODE_ENV);
const cookieSecret = getSecretValue('COOKIE_SECRET');

if (!cookieSecret) {
  throw new Error('FATAL: COOKIE_SECRET environment variable is not set');
}

if (!process.env.DATABASE_URL && nodeEnv === 'production') {
  throw new Error('FATAL: DATABASE_URL must be set in production');
}

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!corsOrigins.includes('http://localhost:3001')) {
  corsOrigins.push('http://localhost:3001');
}

export const config = {
  env: nodeEnv,
  port: asInt('PORT', 3001),
  appVersion: process.env.APP_VERSION ?? 'dev',
  cookieSecret,
  corsOrigins,
  uploads: {
    root: path.resolve(process.env.UPLOADS_ROOT ?? path.join(process.cwd(), 'uploads'))
  },
  limits: {
    maxConcurrentSessionsPerUser: asInt('MAX_CONCURRENT_SESSIONS_PER_USER', 100)
  },
  db: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: asInt('DB_PORT', 5432),
    database: process.env.DB_NAME ?? 'rbac_db',
    user: process.env.DB_USER ?? 'postgres',
    password: getSecretValue('DB_PASSWORD') ?? 'postgres',
    poolSize: asInt('DB_POOL_SIZE', 20),
    idleTimeoutMs: asInt('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMs: asInt('DB_CONNECTION_TIMEOUT_MS', 2000),
    ssl: process.env.DB_SSL === 'true'
  }
} as const;
