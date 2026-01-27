/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // === Core identifiers ===
    await knex.schema.createTable('permissions', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('module_id').unsigned().notNullable().references('id').inTable('modules').onDelete('CASCADE');
        table.straing('action').notNullable().checkIn(['create', 'read', 'update', 'delete', 'export']);
        table.text('description').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.index(['module_id']);
        table.index(['action']);
        table.unique(['module_id', 'action']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('permissions');
}