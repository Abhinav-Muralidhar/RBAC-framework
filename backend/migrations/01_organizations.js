/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.table('organizations', (table) => {
    table.bigIncrements('id').primary();
    table.varchar('company_name').notNullable();
    table.varchar('company_logo').notNullable();
    table.varchar('address').notNullable();
    table.varchar('city').notNullable();
    table.varchar('state').notNullable();
    table.integer('postal_code').notNullable().checkLength('=', 6);
    table.varchar('country').notNullable();
    table.integer('country_code').notNullable();
    table.varchar('phone').checkLength('=', 10);
    table.varchar('fax').nullable().unique();
    table.varchar('website').unique();
    table.varchar('facebook').unique();
    table.varchar('twitter').unique();
    table.varchar('linkedin').unique();
    table
      .integer('financial_year_start_month')
      .checkBetween([1, 12]);
    table.string('gstin').notNullable().checkLength('=', 15).unique();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.bigInteger('created_by').unsigned();
    table.timestamp('updated_at');
    table.index('company_name');
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('organizations');
};
