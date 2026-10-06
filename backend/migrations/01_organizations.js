/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('organizations', (table) => {
    table.bigIncrements('id').primary();
    table.string('company_name').notNullable();
    table.string('company_logo').notNullable();
    table.text('address').notNullable();
    table.string('city').notNullable();
    table.string('state').notNullable();
    table.string('postal_code', 6).notNullable();
    table.string('country').notNullable();
    table.string('country_code').notNullable();
    table.string('phone');
    table.string('fax').nullable().unique();
    table.string('website').unique();
    table.string('facebook').unique();
    table.string('twitter').unique();
    table.string('linkedin').unique();
    table.integer('financial_year_start_month');
    table.string('gstin', 15).notNullable().unique();
    table.boolean('is_active').defaultTo(true);
    table.integer('version').notNullable().defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.bigInteger('created_by').unsigned();
    table.timestamp('updated_at');
    table.bigInteger('updated_by').unsigned();
    table.index('company_name');
  });
  // Add raw constraints for PostgreSQL
  await knex.raw(`ALTER TABLE organizations
    ADD CONSTRAINT postal_code_length CHECK (char_length(postal_code) = 6),
    ADD CONSTRAINT phone_length CHECK (phone IS NULL OR char_length(phone) = 10),
    ADD CONSTRAINT fy_start_month CHECK (financial_year_start_month BETWEEN 1 AND 12),
    ADD CONSTRAINT gstin_length CHECK (char_length(gstin) = 15)
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('organizations');
};
