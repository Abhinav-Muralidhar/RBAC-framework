/**
 * Database Seeding Script
 * 
 * Populates the database with initial data for the standalone RBAC framework.
 * Usage: npm run seed
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL not found in .env, falling back to default connection settings...');
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting RBAC database seed...');

    // 1. Clean existing RBAC tables
    console.log('🧹 Cleaning existing tables...');
    await client.query(`
      TRUNCATE TABLE 
        users, roles, profiles, groups, modules, permissions, organizations,
        user_roles, role_profiles, profile_permissions, user_groups, group_roles,
        sharing_rules, smtp_config, auth_sessions, audit_logs, otp_tokens
      RESTART IDENTITY CASCADE;
    `);

    // 2. Create Users first to get admin ID for created_by references
    console.log('👤 Creating initial users...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const adminUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', NULL)
      RETURNING id;
    `, ['admin', adminPassword, 'System', 'Admin', 'admin@example.com']);
    const adminUserId = adminUserRes.rows[0].id;

    const standardUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id;
    `, ['user', userPassword, 'John', 'Doe', 'user@example.com', adminUserId]);
    const standardUserId = standardUserRes.rows[0].id;

    // 3. Create Organization
    console.log('🏢 Creating Organization...');
    await client.query(`
      INSERT INTO organizations (
        company_name, company_logo, address, city, state, postal_code, country, country_code, phone, gstin, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
      RETURNING id;
    `, [
      'RBAC Enterprise',
      'uploads/logos/logos-1771154109555-f7010e2b.png',
      '100 Tech Boulevard',
      'San Francisco',
      'CA',
      '941051',
      'United States',
      'US',
      '4155550199',
      '22AAAAA0000A1Z5',
      adminUserId
    ]);

    // 4. Create Modules
    console.log('📦 Creating Modules...');
    const modulesToSeed = [
      { name: 'Dashboard', code: 'DASHBOARD', description: 'Overview and analytics dashboard', sortOrder: 0 },
      { name: 'Settings', code: 'SETTINGS', description: 'System administration, RBAC, users, and configuration', sortOrder: 1 },
    ];

    const modulesMap = new Map<string, { id: number; code: string }>();
    for (const module of modulesToSeed) {
      const moduleRes = await client.query(`
        INSERT INTO modules (name, code, description, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id, code;
      `, [module.name, module.code, module.description, module.sortOrder]);
      modulesMap.set(moduleRes.rows[0].code, moduleRes.rows[0]);
    }

    // 5. Create Permissions
    console.log('🔑 Creating Permissions...');
    const permissionActions = ['create', 'read', 'update', 'delete', 'export'];
    for (const module of modulesToSeed) {
      const storedModule = modulesMap.get(module.code);
      if (!storedModule) continue;

      for (const action of permissionActions) {
        await client.query(`
          INSERT INTO permissions (module_id, action, description)
          VALUES ($1, $2, $3)
        `, [storedModule.id, action, `Allow ${action} on ${module.name}`]);
      }
    }

    // 6. Create Profiles
    console.log('🎭 Creating Profiles...');
    const profilesRes = await client.query(`
      INSERT INTO profiles (name, code, description)
      VALUES 
        ('Super Admin', 'SUPER_ADMIN', 'Full system access and administration permissions'),
        ('Standard User', 'STANDARD', 'Standard user with view access')
      RETURNING id, code;
    `);

    const adminProfile = profilesRes.rows.find(p => p.code === 'SUPER_ADMIN');
    const standardProfile = profilesRes.rows.find(p => p.code === 'STANDARD');

    // 7. Assign Permissions to Profiles
    console.log('🔗 Assigning Permissions to Profiles...');
    const allPermsRes = await client.query('SELECT id, module_id, action FROM permissions');

    // Super Admin Profile: ALL permissions
    for (const perm of allPermsRes.rows) {
      await client.query(`
        INSERT INTO profile_permissions (profile_id, permission_id, effect)
        VALUES ($1, $2, 'allow')
      `, [adminProfile.id, perm.id]);
    }

    // Standard User Profile: Read permissions
    const readPerms = allPermsRes.rows.filter(p => p.action === 'read');
    for (const perm of readPerms) {
      await client.query(`
        INSERT INTO profile_permissions (profile_id, permission_id, effect)
        VALUES ($1, $2, 'allow')
      `, [standardProfile.id, perm.id]);
    }

    // 8. Create Roles
    console.log('👑 Creating Roles...');
    const rolesRes = await client.query(`
      INSERT INTO roles (name, code, description)
      VALUES 
        ('Administrator', 'ADMIN', 'System Administrator with full access'),
        ('Staff Member', 'EMPLOYEE', 'Standard Staff Member')
      RETURNING id, code;
    `);

    const adminRole = rolesRes.rows.find(r => r.code === 'ADMIN');
    const employeeRole = rolesRes.rows.find(r => r.code === 'EMPLOYEE');

    // 9. Assign Profiles to Roles
    console.log('🔗 Assigning Profiles to Roles...');
    await client.query(`
      INSERT INTO role_profiles (role_id, profile_id)
      VALUES 
        ($1, $2),
        ($3, $4)
    `, [adminRole.id, adminProfile.id, employeeRole.id, standardProfile.id]);

    // 10. Assign Roles to Users
    console.log('🔗 Assigning Roles to Users...');
    await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES 
        ($1, $2),
        ($3, $4)
    `, [adminUserId, adminRole.id, standardUserId, employeeRole.id]);

    // 11. Create Groups & Group Assignments
    console.log('👥 Creating Groups...');
    const groupRes = await client.query(`
      INSERT INTO groups (name, code, description)
      VALUES 
        ('Administrators', 'GRP_ADMIN', 'Administrative group'),
        ('Staff', 'GRP_STAFF', 'General staff group')
      RETURNING id, code;
    `);

    const adminGroup = groupRes.rows.find(g => g.code === 'GRP_ADMIN');
    const staffGroup = groupRes.rows.find(g => g.code === 'GRP_STAFF');

    await client.query(`
      INSERT INTO group_roles (group_id, role_id)
      VALUES 
        ($1, $2),
        ($3, $4)
    `, [adminGroup.id, adminRole.id, staffGroup.id, employeeRole.id]);

    await client.query(`
      INSERT INTO user_groups (user_id, group_id)
      VALUES 
        ($1, $2),
        ($3, $4)
    `, [adminUserId, adminGroup.id, standardUserId, staffGroup.id]);

    // 12. Create default SMTP Configuration
    console.log('📧 Creating default SMTP Configuration...');
    await client.query(`
      INSERT INTO smtp_config (
        name,
        host,
        port,
        username,
        password,
        encryption,
        is_active,
        from_email,
        from_name,
        reply_to_email,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      'Primary SMTP',
      'smtp.example.com',
      587,
      'smtp_user',
      'smtp_password',
      'tls',
      true,
      'noreply@example.com',
      'RBAC Notification',
      'support@example.com',
      adminUserId
    ]);

    console.log('✅ RBAC Seeding completed successfully!');
    console.log('-----------------------------------');
    console.log('Default Credentials:');
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
