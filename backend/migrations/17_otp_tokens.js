/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.createTable('otp_tokens', function(table) {
        table.bigIncrements('id').primary();
        table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('otp_hash').notNullable();
        table.dateTime('expires_at').notNullable();
        table.integer('attempt_count').unsigned().notNullable().defaultTo(0);
        table.string('sent_to').notNullable();
        table.string('ip_address').notNullable();
        table.string('user_agent').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
        table.index(['otp_hash']);
        table.index(['sent_to']);
    })}

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('otp_tokens');
}