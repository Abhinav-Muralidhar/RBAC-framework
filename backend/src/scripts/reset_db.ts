/**
 * Database Reset Script
 * 
 * DROPS ALL TABLES and migration history to allow a fresh start.
 * USE WITH CAUTION.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function reset() {
    const client = await pool.connect();

    try {
        console.log('🔥 RESETTING DATABASE...');

        // Drop public schema and recreate it to wipe everything
        await client.query('DROP SCHEMA public CASCADE;');
        await client.query('CREATE SCHEMA public;');
        await client.query('GRANT ALL ON SCHEMA public TO public;'); // Optional depending on PG version/setup

        console.log('✅ Database wiped successfully.');
    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

reset();
