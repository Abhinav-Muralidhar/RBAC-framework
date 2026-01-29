/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('user_groups', (table) => {
        table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
        table.timestamp('assigned_at').defaultTo(knex.fn.now()).notNullable();
        table.bigInteger('assigned_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.primary(['user_id', 'group_id']);
        table.index(['group_id']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('user_groups');
}