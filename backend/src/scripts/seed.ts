/**
 * Database Seeding Script
 * 
 * Populates the database with initial data for RBAC.
 * Usage: npm run seed
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not found in .env, falling back to defaults (which may fail)...');
}

async function seed() {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting seed...');

        // 1. Clean existing data
        console.log('🧹 Cleaning tables...');
        await client.query(`
      TRUNCATE TABLE 
        users, roles, profiles, groups, modules, permissions, organizations,
        user_roles, role_profiles, profile_permissions, user_groups, group_roles,
        auth_sessions, audit_logs
      RESTART IDENTITY CASCADE;
    `);

        // 2. Create Organization
        console.log('🏢 Creating Organization...');
        const orgRes = await client.query(`
      INSERT INTO organizations (company_name, company_logo, address, city, state, postal_code, country, country_code, gstin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `, ['Acme Corp', 'https://example.com/logo.png', '123 Tech Park', 'Tech City', 'TC', '123456', 'Techland', 'TL', '22AAAAA0000A1Z5']);
        const orgId = orgRes.rows[0].id;

        // 3. Create Modules
        console.log('📦 Creating Modules...');
        // We'll create a single "SETTINGS" module as requested, 
        // plus maybe a generic "DASHBOARD" for basic access if needed.
        const modulesRes = await client.query(`
      INSERT INTO modules (name, code, description, sort_order)
      VALUES 
        ('Settings', 'SETTINGS', 'System Administration and RBAC', 1),
        ('Dashboard', 'DASHBOARD', 'Main Dashboard', 0)
      RETURNING id, code;
    `);

        const settingsModule = modulesRes.rows.find(m => m.code === 'SETTINGS');
        const dashboardModule = modulesRes.rows.find(m => m.code === 'DASHBOARD');

        // 4. Create Permissions
        console.log('🔐 Creating Permissions...');
        const permissionActions = ['create', 'read', 'update', 'delete', 'export'];

        // Settings Permissions
        for (const action of permissionActions) {
            await client.query(`
        INSERT INTO permissions (module_id, action, description)
        VALUES ($1, $2, $3)
      `, [settingsModule.id, action, `Allow ${action} on Settings`]);
        }

        // Dashboard Permissions (Read only)
        await client.query(`
        INSERT INTO permissions (module_id, action, description)
        VALUES ($1, $2, $3)
      `, [dashboardModule.id, 'read', 'Allow read on Dashboard']);


        // 5. Create Profiles
        console.log('🎭 Creating Profiles...');
        const profilesRes = await client.query(`
      INSERT INTO profiles (name, code, description)
      VALUES 
        ('Super Admin', 'SUPER_ADMIN', 'Full system access'),
        ('Standard User', 'STANDARD', 'Basic access')
      RETURNING id, code;
    `);

        const adminProfile = profilesRes.rows.find(p => p.code === 'SUPER_ADMIN');
        const userProfile = profilesRes.rows.find(p => p.code === 'STANDARD');

        // 6. Assign Permissions to Profiles
        console.log('🔗 Assigning Permissions to Profiles...');

        // Get all permissions
        const allPermsRes = await client.query('SELECT id, module_id, action FROM permissions');

        // Super Admin: ALL permissions
        for (const perm of allPermsRes.rows) {
            await client.query(`
        INSERT INTO profile_permissions (profile_id, permission_id, effect)
        VALUES ($1, $2, 'allow')
      `, [adminProfile.id, perm.id]);
        }

        // Standard User: Dashboard Read Only
        const dashRead = allPermsRes.rows.find(p => p.module_id === dashboardModule.id && p.action === 'read');
        if (dashRead) {
            await client.query(`
            INSERT INTO profile_permissions (profile_id, permission_id, effect)
            VALUES ($1, $2, 'allow')
        `, [userProfile.id, dashRead.id]);
        }

        // 7. Create Roles
        console.log('👑 Creating Roles...');
        const rolesRes = await client.query(`
      INSERT INTO roles (name, code, description)
      VALUES 
        ('Administrator', 'ADMIN', 'System Administrator'),
        ('Employee', 'EMPLOYEE', 'Standard Employee')
      RETURNING id, code;
    `);

        const adminRole = rolesRes.rows.find(r => r.code === 'ADMIN');
        const employeeRole = rolesRes.rows.find(r => r.code === 'EMPLOYEE');

        // 8. Assign Profiles to Roles
        console.log('🔗 Assigning Profiles to Roles...');

        // Admin -> Super Admin Profile
        await client.query(`
      INSERT INTO role_profiles (role_id, profile_id)
      VALUES ($1, $2)
    `, [adminRole.id, adminProfile.id]);

        // Employee -> Standard Profile
        await client.query(`
        INSERT INTO role_profiles (role_id, profile_id)
        VALUES ($1, $2)
      `, [employeeRole.id, userProfile.id]);

        // 9. Create Users
        console.log('👤 Creating Users...');

        // Admin User
        const adminUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', NULL)
      RETURNING id;
    `, ['admin', 'admin123', 'System', 'Admin', 'admin@example.com']);
        const adminUserId = adminUserRes.rows[0].id;

        // Standard User
        const standardUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id;
    `, ['user', 'user123', 'John', 'Doe', 'john@example.com', adminUserId]);
        const standardUserId = standardUserRes.rows[0].id;

        // 10. Assign Roles to Users
        console.log('🔗 Assigning Roles to Users...');

        // Admin -> Admin Role
        await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
    `, [adminUserId, adminRole.id]);

        // User -> Employee Role
        await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
      `, [standardUserId, employeeRole.id]);

        console.log('✅ Seeding completed successfully!');
        console.log('-----------------------------------');
        console.log('Credentials:');
        console.log('Admin: admin / admin123');
        console.log('User:  user / user123');
        console.log('-----------------------------------');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
