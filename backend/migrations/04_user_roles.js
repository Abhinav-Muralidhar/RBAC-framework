/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('user_roles', (table) => {
        table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
        table.timestamp('assigned_at').defaultTo(knex.fn.now());
        table.bigInteger('assigned_by')
            .nullable().references('id').inTable('users').onDelete('SET NULL');
        table.primary(['user_id', 'role_id']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('user_roles');
}