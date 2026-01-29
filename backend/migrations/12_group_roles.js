/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('group_roles', (table) => {
        table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
        table.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
        table.timestamp('assigned_at').defaultTo(knex.fn.now()).notNullable();
        table.bigInteger('assigned_by').nullable().references('id').inTable('users').onDelete('SET NULL');
        table.primary(['group_id', 'role_id']);
        table.index(['role_id']);
    })
}
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('group_roles');
}