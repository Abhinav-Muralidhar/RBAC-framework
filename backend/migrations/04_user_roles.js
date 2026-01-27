/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.table('user_roles', (table) => {
        table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('SET NULL');
        table.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('SET NULL');
        table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table.bigInteger('assigned_by')
      .unsigned()
      .nullable().references('id').inTable('users');
        table.primary(['user_id', 'role_id']);
        table.index('user_id');
    })
}
exports.down = async function (knex) {
 await knex.schema.dropTableIfExists('user_roles');
}