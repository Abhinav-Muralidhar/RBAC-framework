import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

const pgp = pgPromise({ capSQL: true });

export const db = pgp(
    process.env.DATABASE_URL ?? {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'rbac_db',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        max: Number(process.env.DB_POOL_SIZE ?? 20),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    }
);
