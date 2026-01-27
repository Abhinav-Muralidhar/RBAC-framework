/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('modules', (table) => {
        table.bigIncrements('id').primary();
        table.string('name').notNullable().unique();
        table.string('code').notNullable().unique();
        table.text('description').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.integer('order').notNullable();
        table.index(['code']);
        table.index(['id']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('modules');
}