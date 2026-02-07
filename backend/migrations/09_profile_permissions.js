/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('profile_permissions', (table) => {
        table.bigInteger('profile_id').notNullable().references('id').inTable('profiles').onDelete('CASCADE');
        table.bigInteger('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
        table.string('effect').checkIn(['allow', 'deny']).notNullable().defaultTo('deny');
        table.primary(['profile_id', 'permission_id']);
    })
}

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('profile_permissions');
}