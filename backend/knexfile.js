const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let connection = process.env.DATABASE_URL;

if (process.env.DB_SSL === 'true' && connection) {
  // Strip query parameters to prevent pg from overriding our custom ssl config object
  const cleanConnectionString = connection.includes('?') 
    ? connection.split('?')[0] 
    : connection;

  connection = {
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false }
  };
}

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations'
    }
  },
  production: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations'
    }
  }
}
