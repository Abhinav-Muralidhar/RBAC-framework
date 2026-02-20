/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('smtp_config', (table) => {
        table.bigIncrements('id').primary();
        table.string('name').notNullable();
        table.string('host').notNullable();
        table.integer('port').notNullable();
        table.string('username').notNullable();
        table.string('password').notNullable();
        table.string('encryption').notNullable().checkIn(['none', 'ssl', 'tls']);
        table.boolean('is_active').notNullable().defaultTo(false);
        table.string('from_email').notNullable();
        table.string('from_name').notNullable();
        table.string('reply_to_email').nullable();
        table.timestamp('updated_at').nullable();
        table.integer('version').notNullable().defaultTo(1);
        table.index('name');
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('smtp_config');
}
