/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up =async function(knex) {
  await knex.schema.table('users',(table)=>{
    table.bigIncrements('id').primary();
    table.string('username').notNullable();
    table.text('password_hash').notNullable();
    table
      .string('status')
      .notNullable()
      .defaultTo('active')
      .checkIn(['active', 'inactive', 'deleted']);
    table.string('first_name');
    table.string('last_name').notNullable();
    table.string('title');
    table.string('department');
    table.bigInteger('reports_to_user_id').unsigned();
    table.string('primary_email').notNullable();
    table.string('secondary_email');
    table.string('other_email');
    table.string('office_phone').notNullable();
    table.string('mobile_phone');
    table.string('home_phone');
    table.string('secondary_phone');
    table.string('fax');
    table.text('street');
    table.string('city');
    table.string('state');
    table.string('country');
    table.string('postal_code');
    table.string('default_landing_page');
    table.string('name_format');
    table.string('phone_country_code');
    table.boolean('full_screen_preview');
    table.string('preferred_currency');
    table.string('digit_grouping_pattern');
    table.string('decimal_separator');
    table.integer('decimal_precision');
    table
      .string('symbol_placement')
      .checkIn(['before', 'after']);

    table
      .string('trailing_zero_handling')
      .checkIn(['show', 'hide']);

    table.string('aggregation_format');
    table.text('signature');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.bigInteger('created_by').unsigned();
    table.timestamp('updated_at');
    table.bigInteger('updated_by').unsigned();
    table.timestamp('last_login_at');
    table.timestamp('password_changed_at');



  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  
};
