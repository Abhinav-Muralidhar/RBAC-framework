/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('sharing_rules', (table) => {
        table.bigIncrements('id').primary();
        table.string('rule_type').notNullable().checkIn(['public', 'private']);
        table.bigInteger('module_id').notNullable().references('id').inTable('modules').onDelete('CASCADE');
        table.boolean('is_active').defaultTo(true).notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
        table.bigInteger('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('updated_at').nullable();
        table.integer('version').notNullable().defaultTo(1);
        table.index(['module_id']);
        table.unique(['module_id']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('sharing_rules');
}
