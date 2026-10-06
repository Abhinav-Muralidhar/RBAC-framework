/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('groups', (table) => {
        table.bigIncrements('id').primary();
        table.string('name').notNullable();
        table.string('code').notNullable().unique();
        table.text('description').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
        table.bigInteger('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('updated_at').nullable();
        table.bigInteger('updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.integer('version').notNullable().defaultTo(1);
        table.index(['is_active']);
    })
}

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('groups');
}
