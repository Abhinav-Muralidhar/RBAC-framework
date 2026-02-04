/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('audit_logs', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.bigInteger('role_id').nullable().references('id').inTable('roles').onDelete('SET NULL');
        table.string('action').notNullable().checkIn(['create', 'update', 'delete', 'export']);
        table.bigInteger('module_id').notNullable().references('id').inTable('modules');
        table.string('entity_type').notNullable();
        table.bigInteger('entity_id').notNullable();
        table.json('old_values').nullable();
        table.json('new_values').nullable();
        table.string('ip_address').notNullable();
        table.string('user_agent').notNullable();
        table.string('status').notNullable().checkIn(['success', 'failure']);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.index(['created_at']);
        table.index(['user_id']);
        table.index(['role_id']);
        table.index(['action']);
        table.index(['module_id']);
        table.index(['status']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('audit_logs');
}
