/**
 * Database Seeding Script
 * 
 * Populates the database with initial data for RBAC.
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
  console.warn('âš ï¸  DATABASE_URL not found in .env, falling back to defaults (which may fail)...');
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('ðŸŒ± Starting seed...');

    // 1. Clean existing data
    console.log('ðŸ§¹ Cleaning tables...');
    await client.query(`
      TRUNCATE TABLE 
        users, roles, profiles, groups, modules, permissions, organizations, files,
        user_roles, role_profiles, profile_permissions, user_groups, group_roles,
        auth_sessions, audit_logs,
        location, department, sub_department, business_segment, level, grade, designation,
        cost_centre, payroll_type, employment_status, gender, position_code,
        product_role_master, mpp, product_logs
      RESTART IDENTITY CASCADE;
    `);

    // 2. Create Organization
    console.log('ðŸ¢ Creating Organization...');
    const fileRes = await client.query(`
      INSERT INTO files (storage_path, original_name)
      VALUES ($1, $2)
      RETURNING id;
    `, ['https://example.com/logo.png', 'logo.png']);
    const logoFileId = fileRes.rows[0].id;

    const orgRes = await client.query(`
      INSERT INTO organizations (company_name, company_logo_file_id, address, city, state, postal_code, country, country_code, gstin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `, ['Acme Corp', logoFileId, '123 Tech Park', 'Tech City', 'TC', '123456', 'Techland', 'TL', '22AAAAA0000A1Z5']);
    const orgId = orgRes.rows[0].id;

    // 3. Create Modules
    console.log('ðŸ“¦ Creating Modules...');
    const modulesToSeed = [
      { name: 'Dashboard', code: 'DASHBOARD', description: 'Main Dashboard', sortOrder: 0 },
      { name: 'MPP', code: 'MPP', description: 'Planning & multi-period budgets', sortOrder: 1 },
      { name: 'Organization Structure', code: 'ORG_STRUCTURE', description: 'Org chart, teams, and hierarchies', sortOrder: 2 },
      { name: 'Reports', code: 'REPORTS', description: 'Dashboards, exports, and insights', sortOrder: 3 },
      { name: 'Master Data', code: 'MASTER_DATA', description: 'Master entity lookups and configuration', sortOrder: 4 },
      { name: 'Settings', code: 'SETTINGS', description: 'System administration and RBAC', sortOrder: 5 },
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

    // 4. Create Permissions
    console.log('ðŸ” Creating Permissions...');
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


    // 5. Create Profiles
    console.log('ðŸŽ­ Creating Profiles...');
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
    console.log('ðŸ”— Assigning Permissions to Profiles...');

    // Get all permissions
    const allPermsRes = await client.query('SELECT id, module_id, action FROM permissions');
    const moduleIdByCode = Object.fromEntries(
      [...modulesMap.entries()].map(([code, moduleEntry]) => [code, moduleEntry.id])
    );

    // Super Admin: ALL permissions
    for (const perm of allPermsRes.rows) {
      await client.query(`
        INSERT INTO profile_permissions (profile_id, permission_id, effect)
        VALUES ($1, $2, 'allow')
      `, [adminProfile.id, perm.id]);
    }

    // Standard User: product access (read-only)
    const standardPermissions = [
      { moduleCode: 'DASHBOARD', action: 'read' },
      { moduleCode: 'MPP', action: 'read' },
      { moduleCode: 'ORG_STRUCTURE', action: 'read' },
      { moduleCode: 'REPORTS', action: 'read' },
      { moduleCode: 'MASTER_DATA', action: 'read' },
    ];

    for (const permCheck of standardPermissions) {
      const moduleId = moduleIdByCode[permCheck.moduleCode];
      if (!moduleId) continue;
      const permission = allPermsRes.rows.find(
        (p) => p.module_id === moduleId && p.action === permCheck.action
      );
      if (!permission) continue;

      await client.query(`
        INSERT INTO profile_permissions (profile_id, permission_id, effect)
        VALUES ($1, $2, 'allow')
      `, [userProfile.id, permission.id]);
    }

    // 7. Create Roles
    console.log('ðŸ‘‘ Creating Roles...');
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
    console.log('ðŸ”— Assigning Profiles to Roles...');

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
    console.log('ðŸ‘¤ Creating Users...');

    const adminPassword = await bcrypt.hash('admin123', 10); // âœ… hash
    const userPassword = await bcrypt.hash('user123', 10);   // âœ… hash

    // Admin User
    const adminUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', NULL)
      RETURNING id;
    `, ['admin', adminPassword, 'System', 'Admin', 'admin@example.com']);
    const adminUserId = adminUserRes.rows[0].id;


    const smtpConfigRes = await client.query(`
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
  RETURNING id;
`, [
      'Primary SMTP',
      'smtp.example.com',
      587,
      'smtp_user',
      'smtp_password',
      'tls',
      true,
      'noreply@example.com',
      'Example App',
      'support@example.com',
      adminUserId
    ]);

    const smtpConfigId = smtpConfigRes.rows[0].id;

    const noUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', NULL)
      RETURNING id;
    `, ['adminno', adminPassword, 'System', 'Admin', 'admi343n@example.com']);

    // Standard User
    const standardUserRes = await client.query(`
      INSERT INTO users (
        username, password, first_name, last_name, primary_email, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id;
    `, ['user', userPassword, 'John', 'Doe', 'john@example.com', adminUserId]);
    const standardUserId = standardUserRes.rows[0].id;

    // 10. Assign Roles to Users
    console.log('ðŸ”— Assigning Roles to Users...');

    // Admin -> Admin Role
    await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
    `, [adminUserId, adminRole.id]);

    // user -> employee role
    await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
      `, [standardUserId, employeeRole.id]);

    // 11. Product Module Seeding (    // Location (19)
    const locRes = await client.query(`
      INSERT INTO location (code, name, initial, address, created_by)
      VALUES 
        ('LOC001', 'Kolkata Head Office', 'KHO', 'Kolkata, WB', $1),
        ('LOC002', 'Delhi Branch', 'DBR', 'New Delhi, DL', $1),
        ('LOC003', 'Mumbai Branch', 'MBR', 'Mumbai, MH', $1)
      RETURNING id, code;
    `, [adminUserId]);
    const locKolkata = locRes.rows.find(r => r.code === 'LOC001').id;
    const locDelhi = locRes.rows.find(r => r.code === 'LOC002').id;
    const locMumbai = locRes.rows.find(r => r.code === 'LOC003').id;

    // Department (20)
    const deptRes = await client.query(`
      INSERT INTO department (code, name, created_by)
      VALUES 
        ('DEPT001', 'Human Resources', $1),
        ('DEPT002', 'Information Technology', $1),
        ('DEPT003', 'Manufacturing', $1)
      RETURNING id, code;
    `, [adminUserId]);
    const deptHR = deptRes.rows.find(r => r.code === 'DEPT001').id;
    const deptIT = deptRes.rows.find(r => r.code === 'DEPT002').id;

    // SubDepartment (21)
    await client.query(`
      INSERT INTO sub_department (code, name, department_id, created_by)
      VALUES ('SUB001', 'Recruitment', $1, $2)
    `, [deptHR, adminUserId]);
    const subDeptITRes = await client.query(`
      INSERT INTO sub_department (code, name, department_id, created_by)
      VALUES ('SUB002', 'Software Development', $1, $2)
      RETURNING id;
    `, [deptIT, adminUserId]);
    const subDeptIT = subDeptITRes.rows[0].id;

    // Business Segment (22)
    const bsRes = await client.query(`
      INSERT INTO business_segment (code, name, created_by)
      VALUES ('BS001', 'Steel Division', $1)
      RETURNING id;
    `, [adminUserId]);
    const bsSteel = bsRes.rows[0].id;

    // Level (23) - add explicit ranks for L1-L4
    const levelRes = await client.query(`
      INSERT INTO level (code, name, rank, created_by)
      VALUES 
        ('L1', 'Level 1', 1, $1),
        ('L2', 'Level 2', 2, $1),
        ('L3', 'Level 3', 3, $1),
        ('L4', 'Level 4', 4, $1)
      RETURNING id, code;
    `, [adminUserId]);
    const levelByCode = Object.fromEntries(levelRes.rows.map((r) => [r.code, r.id]));

    // Grade (24)
    const gradeRes = await client.query(`
      INSERT INTO grade (code, name, created_by)
      VALUES 
        ('G1', 'Grade 1', $1),
        ('G2', 'Grade 2', $1)
      RETURNING id, code;
    `, [adminUserId]);
    const grade1 = gradeRes.rows.find(r => r.code === 'G1').id;
    const grade2 = gradeRes.rows.find(r => r.code === 'G2').id;

    // Designation (25)
    const designationsToSeed = [
      { code: 'DES-CEO', name: 'Chief Executive Officer', levelCode: 'L1', gradeCode: 'G1' },
      { code: 'DES-CFO', name: 'Chief Financial Officer', levelCode: 'L2', gradeCode: 'G1' },
      { code: 'DES-CHRO', name: 'Chief HR Officer', levelCode: 'L2', gradeCode: 'G1' },
      { code: 'DES-COO', name: 'Chief Operating Officer', levelCode: 'L2', gradeCode: 'G1' },
      { code: 'DES-AM', name: 'Accounts Manager', levelCode: 'L3', gradeCode: 'G2' },
      { code: 'DES-HRM', name: 'HR Manager', levelCode: 'L3', gradeCode: 'G2' },
      { code: 'DES-PM', name: 'Plant Manager', levelCode: 'L3', gradeCode: 'G2' },
      { code: 'DES-AE', name: 'Accounts Executive', levelCode: 'L4', gradeCode: 'G2' },
      { code: 'DES-HRE', name: 'HR Executive', levelCode: 'L4', gradeCode: 'G2' },
      { code: 'DES-PS', name: 'Production Supervisor', levelCode: 'L4', gradeCode: 'G2' },
      { code: 'DES-SE', name: 'Software Engineer', levelCode: 'L4', gradeCode: 'G2' },
    ];

    const designationIdByCode = new Map<string, string>();
    for (const d of designationsToSeed) {
      const levelId = levelByCode[d.levelCode];
      const gradeId = d.gradeCode === 'G1' ? grade1 : grade2;
      const res = await client.query(`
        INSERT INTO designation (code, name, level_id, grade_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [d.code, d.name, levelId, gradeId, adminUserId]);
      designationIdByCode.set(d.code, res.rows[0].id);
    }

    // Cost Centre (26)
    const ccRes = await client.query(`
      INSERT INTO cost_centre (code, name, created_by)
      VALUES ('CC001', 'IT Operations', $1)
      RETURNING id;
    `, [adminUserId]);
    const ccIT = ccRes.rows[0].id;

    // Payroll Type (27)
    const ptRes = await client.query(`
      INSERT INTO payroll_type (code, name, category, created_by)
      VALUES ('MONTHLY', 'Monthly Payroll', 'On Role', $1)
      RETURNING id;
    `, [adminUserId]);
    const ptMonthly = ptRes.rows[0].id;

    // Employment Status (28)
    const esRes = await client.query(`
      INSERT INTO employment_status (code, name, created_by)
      VALUES ('PERMANENT', 'Permanent', $1)
      RETURNING id;
    `, [adminUserId]);
    const esPerm = esRes.rows[0].id;

    // Gender (29)
    const genderRes = await client.query(`
      INSERT INTO gender (code, name, created_by)
      VALUES ('M', 'Male', $1), ('F', 'Female', $1)
      RETURNING id, code;
    `, [adminUserId]);
    const genderM = genderRes.rows.find(r => r.code === 'M').id;
    const genderF = genderRes.rows.find(r => r.code === 'F').id;

    // Position Code (30)
    const pcRes = await client.query(`
      INSERT INTO position_code (code, name, created_by)
      VALUES 
        ('PC-CEO', 'Chief Executive Officer', $1),
        ('PC-CFO', 'Chief Financial Officer', $1),
        ('PC-CHRO', 'Chief HR Officer', $1),
        ('PC-COO', 'Chief Operating Officer', $1),
        ('PC-AM', 'Accounts Manager', $1),
        ('PC-HRM', 'HR Manager', $1),
        ('PC-PM', 'Plant Manager', $1),
        ('PC-AE-KOL', 'Accounts Executive Kolkata', $1),
        ('PC-AE-DEL', 'Accounts Executive Delhi', $1),
        ('PC-AE-MUM', 'Accounts Executive Mumbai', $1),
        ('PC-HRE-KOL', 'HR Executive Kolkata', $1),
        ('PC-HRE-DEL', 'HR Executive Delhi', $1),
        ('PC-HRE-MUM', 'HR Executive Mumbai', $1),
        ('PC-PS', 'Production Supervisor', $1),
        ('PC-SE-KOL', 'Software Engineer Kolkata', $1),
        ('PC-SE-DEL', 'Software Engineer Delhi', $1),
        ('PC-SE-MUM', 'Software Engineer Mumbai', $1)
      RETURNING id, code;
    `, [adminUserId]);
    const positionCodeByCode = Object.fromEntries(pcRes.rows.map((r) => [r.code, r.id]));

    await client.query(`
      INSERT INTO shift (code, name, start_time, end_time, created_by)
      VALUES 
        ('SH-GEN', 'General Shift', '09:00:00', '18:00:00', $1),
        ('SH-MOR', 'Morning Shift', '06:00:00', '14:00:00', $1),
        ('SH-EVE', 'Evening Shift', '14:00:00', '22:00:00', $1),
        ('SH-NIG', 'Night Shift', '22:00:00', '06:00:00', $1)
      ON CONFLICT (code) DO NOTHING;
    `, [adminUserId]);

    const shiftRes = await client.query(`SELECT id, code FROM shift`);
    const shiftIdByCode = Object.fromEntries(shiftRes.rows.map(r => [r.code, r.id]));

    await client.query(`
      INSERT INTO employer (code, name, created_by)
      VALUES 
        ('EMP-CS', 'Crescent Solution', $1),
        ('EMP-SUB', 'Subsidiary Corp', $1),
        ('EMP-VEN', 'Vendor Agency', $1)
      ON CONFLICT (code) DO NOTHING;
    `, [adminUserId]);

    const empRes = await client.query(`SELECT id, code FROM employer`);
    const empIdByCode = Object.fromEntries(empRes.rows.map(r => [r.code, r.id]));

    const employeeCategoryByLegacyCode: Record<string, 'onroll' | 'offroll' | 'contractor'> = {
      'EC-FT': 'onroll',
      'EC-PT': 'onroll',
      'EC-INT': 'offroll',
      'EC-CON': 'contractor',
    };

    await client.query(`
      INSERT INTO attrition_type (code, name, created_by)
      VALUES 
        ('AT-VOL', 'Voluntary', $1),
        ('AT-INVOL', 'Involuntary', $1),
        ('AT-RET', 'Retirement', $1)
      ON CONFLICT (code) DO NOTHING;
    `, [adminUserId]);

    const atRes = await client.query(`SELECT id, code FROM attrition_type`);
    const atIdByCode = Object.fromEntries(atRes.rows.map(r => [r.code, r.id]));

    await client.query(`
      INSERT INTO leaving_reason (code, name, created_by)
      VALUES 
        ('LR-BET', 'Better Opportunity', $1),
        ('LR-REL', 'Relocation', $1),
        ('LR-PERF', 'Performance Issue', $1),
        ('LR-TERM', 'Termination', $1),
        ('LR-MED', 'Medical Reasons', $1)
      ON CONFLICT (code) DO NOTHING;
    `, [adminUserId]);

    const lrRes = await client.query(`SELECT id, code FROM leaving_reason`);
    const lrIdByCode = Object.fromEntries(lrRes.rows.map(r => [r.code, r.id]));

    // Product Role Master (31) - seed hierarchy and reporting links
    const seedRoles = [
      { code: 'CEO', name: 'Chief Executive Officer', positionCode: 'PC-CEO', level: 'L1', grade: grade1, department: deptIT, location: locKolkata, functionalParent: null, administrativeParent: null, min: 4000000, max: 6000000 },
      { code: 'CFO', name: 'Chief Financial Officer', positionCode: 'PC-CFO', level: 'L2', grade: grade1, department: deptIT, location: locKolkata, functionalParent: 'CEO', administrativeParent: 'CHRO', min: 1800000, max: 2500000 },
      { code: 'CHRO', name: 'Chief HR Officer', positionCode: 'PC-CHRO', level: 'L2', grade: grade1, department: deptHR, location: locKolkata, functionalParent: 'CEO', administrativeParent: 'CFO', min: 1500000, max: 2000000 },
      { code: 'COO', name: 'Chief Operating Officer', positionCode: 'PC-COO', level: 'L2', grade: grade1, department: deptIT, location: locKolkata, functionalParent: 'CEO', administrativeParent: null, min: 2000000, max: 2500000 },
      { code: 'AM', name: 'Accounts Manager', positionCode: 'PC-AM', level: 'L3', grade: grade2, department: deptIT, location: locKolkata, functionalParent: 'CFO', administrativeParent: 'CHRO', min: 1000000, max: 1300000 },
      { code: 'HRM', name: 'HR Manager', positionCode: 'PC-HRM', level: 'L3', grade: grade2, department: deptHR, location: locKolkata, functionalParent: 'CHRO', administrativeParent: 'CFO', min: 1200000, max: 1500000 },
      { code: 'PM', name: 'Plant Manager', positionCode: 'PC-PM', level: 'L3', grade: grade2, department: deptIT, location: locKolkata, functionalParent: 'COO', administrativeParent: null, min: 1000000, max: 1500000 },
      
      // Accounts Executives in three locations
      { code: 'AE-KOL', name: 'Accounts Executive', positionCode: 'PC-AE-KOL', level: 'L4', grade: grade2, department: deptIT, location: locKolkata, functionalParent: 'AM', administrativeParent: null, min: 500000, max: 700000 },
      { code: 'AE-DEL', name: 'Accounts Executive', positionCode: 'PC-AE-DEL', level: 'L4', grade: grade2, department: deptIT, location: locDelhi, functionalParent: 'AM', administrativeParent: null, min: 500000, max: 700000 },
      { code: 'AE-MUM', name: 'Accounts Executive', positionCode: 'PC-AE-MUM', level: 'L4', grade: grade2, department: deptIT, location: locMumbai, functionalParent: 'AM', administrativeParent: null, min: 500000, max: 700000 },
      
      // HR Executives in three locations
      { code: 'HRE-KOL', name: 'HR Executive', positionCode: 'PC-HRE-KOL', level: 'L4', grade: grade2, department: deptHR, location: locKolkata, functionalParent: 'HRM', administrativeParent: null, min: 400000, max: 600000 },
      { code: 'HRE-DEL', name: 'HR Executive', positionCode: 'PC-HRE-DEL', level: 'L4', grade: grade2, department: deptHR, location: locDelhi, functionalParent: 'HRM', administrativeParent: null, min: 400000, max: 600000 },
      { code: 'HRE-MUM', name: 'HR Executive', positionCode: 'PC-HRE-MUM', level: 'L4', grade: grade2, department: deptHR, location: locMumbai, functionalParent: 'HRM', administrativeParent: null, min: 400000, max: 600000 },

      // Software Engineers in three locations
      { code: 'SE-KOL', name: 'Software Engineer', positionCode: 'PC-SE-KOL', level: 'L4', grade: grade2, department: deptIT, location: locKolkata, functionalParent: 'COO', administrativeParent: null, min: 800000, max: 1100000 },
      { code: 'SE-DEL', name: 'Software Engineer', positionCode: 'PC-SE-DEL', level: 'L4', grade: grade2, department: deptIT, location: locDelhi, functionalParent: 'COO', administrativeParent: null, min: 800000, max: 1100000 },
      { code: 'SE-MUM', name: 'Software Engineer', positionCode: 'PC-SE-MUM', level: 'L4', grade: grade2, department: deptIT, location: locMumbai, functionalParent: 'COO', administrativeParent: null, min: 800000, max: 1100000 },
      
      { code: 'PS', name: 'Production Supervisor', positionCode: 'PC-PS', level: 'L4', grade: grade2, department: deptIT, location: locKolkata, functionalParent: 'PM', administrativeParent: null, min: 800000, max: 1000000 },
    ];

    const roleIdByCode = new Map<string, string>();

    for (const role of seedRoles) {
      const res = await client.query(
        `
          INSERT INTO product_role_master (
            position_code_id, name, location_id, business_segment_id, department_id,
            level_id, grade_id, cost_centre_id, created_by,
            budgeted_min_ctc, budgeted_max_ctc
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id;
        `,
        [
          positionCodeByCode[role.positionCode],
          role.name,
          role.location,
          bsSteel,
          role.department,
          levelByCode[role.level],
          role.grade,
          ccIT,
          adminUserId,
          role.min,
          role.max,
        ]
      );
      roleIdByCode.set(role.code, res.rows[0].id);
    }

    // Backfill reporting relationships now that IDs are known
    for (const role of seedRoles) {
      const functionalId = role.functionalParent ? roleIdByCode.get(role.functionalParent) : null;
      const administrativeId = role.administrativeParent ? roleIdByCode.get(role.administrativeParent) : null;
      if (!functionalId && !administrativeId) continue;

      await client.query(
        `
          UPDATE product_role_master
          SET functional_reporting_role_id = COALESCE($2, functional_reporting_role_id),
              administrative_reporting_role_id = COALESCE($3, administrative_reporting_role_id)
          WHERE id = $1
        `,
        [roleIdByCode.get(role.code), functionalId, administrativeId]
      );
    }

    const hrExecutiveId = roleIdByCode.get('HRE-KOL')!;
    const cfoId = roleIdByCode.get('CFO')!;
    const pmId = roleIdByCode.get('PM')!;
    const ceoId = roleIdByCode.get('CEO')!;
    const aeKolkataId = roleIdByCode.get('AE-KOL')!;
    const aeDelhiId = roleIdByCode.get('AE-DEL')!;
    const aeMumbaiId = roleIdByCode.get('AE-MUM')!;
    const chroId = roleIdByCode.get('CHRO')!;
    const cooId = roleIdByCode.get('COO')!;
    const amId = roleIdByCode.get('AM')!;
    const hrmId = roleIdByCode.get('HRM')!;
    const psId = roleIdByCode.get('PS')!;
    const hreDelhiId = roleIdByCode.get('HRE-DEL')!;
    const hreMumbaiId = roleIdByCode.get('HRE-MUM')!;
    const seKolkataId = roleIdByCode.get('SE-KOL')!;
    const seDelhiId = roleIdByCode.get('SE-DEL')!;
    const seMumbaiId = roleIdByCode.get('SE-MUM')!;

    const mppData = [
      // L1
      { role: ceoId, code: 'EMP001', name: 'John Doe', gender: genderM, ctc: 5000000, vacant: false, doj: '2020-01-01', dol: null, desigCode: 'DES-CEO', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      
      // L2
      { role: cfoId, code: 'EMP002', name: 'Jane Finance', gender: genderF, ctc: 2000000, vacant: false, doj: '2021-03-15', dol: null, desigCode: 'DES-CFO', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: chroId, code: 'EMP007', name: 'Kelly Kapoor', gender: genderF, ctc: 1800000, vacant: false, doj: '2021-06-01', dol: null, desigCode: 'DES-CHRO', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: cooId, code: 'EMP008', name: 'Dwight Schrute', gender: genderM, ctc: 2200000, vacant: false, doj: '2021-02-10', dol: null, desigCode: 'DES-COO', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },

      // L3
      { role: amId, code: 'EMP009', name: 'Angela Martin', gender: genderF, ctc: 1100000, vacant: false, doj: '2022-01-10', dol: null, desigCode: 'DES-AM', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: hrmId, code: 'EMP010', name: 'Holly Flax', gender: genderF, ctc: 1300000, vacant: false, doj: '2022-05-20', dol: null, desigCode: 'DES-HRM', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: pmId, code: 'EMP003', name: 'Michael Scott', gender: genderM, ctc: 1200000, vacant: false, doj: '2022-04-01', dol: null, desigCode: 'DES-PM', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },

      // L4 - Accounts Executives
      { role: aeKolkataId, code: 'EMP005', name: 'Jim Halpert', gender: genderM, ctc: 600000, vacant: false, doj: '2023-01-15', dol: null, desigCode: 'DES-AE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: aeDelhiId, code: 'EMP014', name: 'Pam Beesly', gender: genderF, ctc: 650000, vacant: false, doj: '2023-03-01', dol: null, desigCode: 'DES-AE', shift: 'SH-MOR', category: 'EC-FT', employer: 'EMP-CS' },
      { role: aeMumbaiId, code: 'EMP015', name: 'Oscar Martinez', gender: genderM, ctc: 580000, vacant: false, doj: '2023-02-15', dol: null, desigCode: 'DES-AE', shift: 'SH-EVE', category: 'EC-PT', employer: 'EMP-SUB' },

      // L4 - HR Executives
      { role: hrExecutiveId, code: 'EMP006', name: 'Toby Flenderson', gender: genderM, ctc: 500000, vacant: false, doj: '2023-05-01', dol: null, desigCode: 'DES-HRE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: hreDelhiId, code: 'EMP016', name: 'Gabe Lewis', gender: genderM, ctc: 520000, vacant: false, doj: '2023-06-15', dol: null, desigCode: 'DES-HRE', shift: 'SH-GEN', category: 'EC-CON', employer: 'EMP-VEN' },
      { role: hreMumbaiId, code: 'EMP017', name: 'Nellie Bertram', gender: genderF, ctc: 480000, vacant: false, doj: '2023-08-01', dol: null, desigCode: 'DES-HRE', shift: 'SH-MOR', category: 'EC-FT', employer: 'EMP-CS' },

      // L4 - Software Engineers (Salary Parity Test)
      { role: seKolkataId, code: 'EMP018', name: 'Ryan Howard', gender: genderM, ctc: 900000, vacant: false, doj: '2023-09-01', dol: null, desigCode: 'DES-SE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: seDelhiId, code: 'EMP019', name: 'Erin Hannon', gender: genderF, ctc: 850000, vacant: false, doj: '2023-10-15', dol: null, desigCode: 'DES-SE', shift: 'SH-MOR', category: 'EC-INT', employer: 'EMP-CS' },
      { role: seMumbaiId, code: 'EMP020', name: 'Plop Miller', gender: genderM, ctc: 950000, vacant: false, doj: '2023-11-01', dol: null, desigCode: 'DES-SE', shift: 'SH-NIG', category: 'EC-CON', employer: 'EMP-VEN' },

      // L4 - Production Supervisors
      { role: psId, code: 'EMP011', name: 'Darryl Philbin', gender: genderM, ctc: 900000, vacant: false, doj: '2022-07-01', dol: null, desigCode: 'DES-PS', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },

      // Exited Employees (For Attrition Reports)
      { role: seKolkataId, code: 'EMP012', name: 'Kevin Malone', gender: genderM, ctc: 820000, vacant: false, doj: '2023-01-01', dol: '2025-05-10', desigCode: 'DES-SE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS', attType: 'AT-VOL', reason: 'LR-BET' },
      { role: psId, code: 'EMP013', name: 'Roy Anderson', gender: genderM, ctc: 800000, vacant: false, doj: '2022-09-01', dol: '2025-04-15', desigCode: 'DES-PS', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS', attType: 'AT-INVOL', reason: 'LR-PERF' },
      { role: aeDelhiId, code: 'EMP021', name: 'Stanley Hudson', gender: genderM, ctc: 680000, vacant: false, doj: '2021-05-01', dol: '2025-03-31', desigCode: 'DES-AE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS', attType: 'AT-RET', reason: 'LR-MED' },
      { role: hreMumbaiId, code: 'EMP022', name: 'Andy Bernard', gender: genderM, ctc: 510000, vacant: false, doj: '2023-11-15', dol: '2025-02-28', desigCode: 'DES-HRE', shift: 'SH-EVE', category: 'EC-FT', employer: 'EMP-CS', attType: 'AT-VOL', reason: 'LR-REL' },
      { role: seDelhiId, code: 'EMP023', name: 'Clark Green', gender: genderM, ctc: 830000, doj: '2024-02-01', dol: '2025-01-20', desigCode: 'DES-SE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS', attType: 'AT-INVOL', reason: 'LR-TERM' },

      // Vacant positions
      { role: pmId, code: null, name: null, gender: genderM, ctc: 0, doj: null, dol: null, desigCode: 'DES-PM', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: hrExecutiveId, code: null, name: null, gender: genderF, ctc: 0, doj: null, dol: null, desigCode: 'DES-HRE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' },
      { role: aeKolkataId, code: null, name: null, gender: genderM, ctc: 0, doj: null, dol: null, desigCode: 'DES-AE', shift: 'SH-GEN', category: 'EC-FT', employer: 'EMP-CS' }
    ];

    for (const mpp of mppData) {
      await client.query(
        `
          INSERT INTO mpp (
            product_role_master_id, employee_code, employee_name, designation_id,
            employment_status_id, gender_id, created_by,
            actual_ctc, date_of_leaving,
            employer_id, employee_category, attrition_type_id, leaving_reason_id, shift_id, date_of_joining
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `,
        [
          mpp.role,
          mpp.code,
          mpp.name,
          designationIdByCode.get(mpp.desigCode) || null,
          esPerm,
          mpp.gender,
          adminUserId,
          mpp.ctc,
          mpp.dol,
          mpp.employer ? empIdByCode[mpp.employer] : null,
          mpp.category ? employeeCategoryByLegacyCode[mpp.category] : null,
          mpp.attType ? atIdByCode[mpp.attType] : null,
          mpp.reason ? lrIdByCode[mpp.reason] : null,
          mpp.shift ? shiftIdByCode[mpp.shift] : null,
          mpp.doj,
        ]
      );
    }
    console.log('✅ Seeding completed successfully!');
    console.log('-----------------------------------');
    console.log('Credentials:');
    console.log('Admin: admin / admin123');
    console.log('User:  user / user123');
    console.log('-----------------------------------');

  } catch (error) {
    console.error('âŒ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

