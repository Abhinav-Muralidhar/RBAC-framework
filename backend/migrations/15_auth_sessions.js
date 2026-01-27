/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.createTable('auth_sessions', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('session_token').notNullable().unique();
        table.timestamp('expires_at').notNullable();
        table.string('ip_address').notNullable();
        table.string('user_agent').notNullable();
        table.timestamp('login_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('logout_at').nullable();
        table.index('user_id');
        table.index('session_token');
    })}
exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('auth_sessions');
}