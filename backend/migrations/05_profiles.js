/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('profiles', (table) => {
        table.bigIncrements('id').primary();
        table.string('name').notNullable();
        table.string('code').notNullable();
        table.text('description').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.bigInteger('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.unique(['code']);
        table.index(['is_active']);
    })
}

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('profiles');
}