/**
 * Audit Logs Migration (Encrypted at Rest)
 * 
 * All data columns are TEXT to store AES-256-GCM ciphertext.
 * No foreign keys — encrypted values cannot maintain referential integrity.
 * No indexes on encrypted columns — ciphertext is not searchable.
 * Only `id` remains as a plaintext auto-increment primary key.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('audit_logs', (table) => {
        table.bigIncrements('id').primary();
        table.text('user_id').nullable();
        table.text('role_id').nullable();
        table.text('action').notNullable();
        table.text('module_id').nullable();
        table.text('entity_type').notNullable();
        table.text('entity_id').nullable();
        table.text('old_values').nullable();
        table.text('new_values').nullable();
        table.text('ip_address').notNullable();
        table.text('user_agent').notNullable();
        table.text('status').notNullable();
        table.text('created_at').notNullable();
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('audit_logs');
};
