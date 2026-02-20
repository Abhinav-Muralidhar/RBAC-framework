/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').primary();
    table.string('username').notNullable();
    table.text('password').notNullable();
    table
      .string('status')
      .notNullable()
      .defaultTo('active')
      .checkIn(['active', 'inactive', 'deleted']);
    table.string('first_name');
    table.string('last_name').notNullable();
    table.string('title');
    table.string('department');
    table.bigInteger('reports_to_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('primary_email').notNullable();
    table.string('secondary_email');
    table.string('other_email');
    table.string('office_phone');
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
    table.string('time_zone');
    table.json('business_hours');
    table
      .string('trailing_zero_handling')
      .checkIn(['show', 'hide']);

    table.string('aggregation_format');
    table.text('signature');
    table.integer('version').notNullable().defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.bigInteger('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at');
    table.timestamp('last_login_at');
    table.timestamp('password_changed_at');
    table.unique('username');
    table.index('primary_email');
  })
  await knex.raw(`
    ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL;`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropForeign('created_by', 'fk_organizations_created_by');
  });
  await knex.schema.dropTableIfExists('users');
};
