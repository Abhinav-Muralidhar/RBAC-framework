import pgPromise from 'pg-promise';
import { config } from './config';

const pgp = pgPromise({ capSQL: true });

const getDbConfig = () => {
  if (config.db.url) {
    let connectionString = config.db.url;
    if (config.db.ssl && connectionString.includes('?')) {
      // Strip query parameters to prevent pg from overriding our custom ssl config object
      connectionString = connectionString.split('?')[0] || connectionString;
    }

    const connParams: any = {
      connectionString,
      max: config.db.poolSize,
      idleTimeoutMillis: config.db.idleTimeoutMs,
      connectionTimeoutMillis: config.db.connectionTimeoutMs,
    };
    if (config.db.ssl) {
      connParams.ssl = { rejectUnauthorized: false };
    }
    return connParams;
  }

  const connParams: any = {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    max: config.db.poolSize,
    idleTimeoutMillis: config.db.idleTimeoutMs,
    connectionTimeoutMillis: config.db.connectionTimeoutMs,
  };
  if (config.db.ssl) {
    connParams.ssl = { rejectUnauthorized: false };
  }
  return connParams;
};

// pg-promise handles the connection string or object.
export const db = pgp(getDbConfig());


