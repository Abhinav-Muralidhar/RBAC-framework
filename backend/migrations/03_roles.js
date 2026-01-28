/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex){
 await knex.schema.createTable('roles',(table)=>{
    table.bigIncrements('id').primary();
    table.string('name').notNullable();
    table.string('code').notNullable();
    table.text('description');
    table.bigInteger('parent_role_id').unsigned().nullable().references('id').inTable('roles');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.bigInteger('created_by').unsigned().nullable().references('id').inTable('users');
    table.unique('code');
    table.index('parent_role_id');
    table.check(
      '?? IS NULL OR ?? <> ??',
      ['parent_role_id', 'parent_role_id', 'id']
    );

 })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('roles');
};