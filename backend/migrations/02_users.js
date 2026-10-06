/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
const NAME_FORMAT_KEYS = ['first_last', 'last_first'];
const TIME_ZONE_KEYS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Paris',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Cairo',
];
const CURRENCY_KEYS = [
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'KRW',
  'SGD', 'AED', 'SAR', 'BRL', 'MXN', 'ZAR', 'RUB', 'TRY', 'SEK', 'NOK',
  'NZD', 'PKR', 'BDT', 'NGN', 'EGP',
];
const DIGIT_GROUPING_PATTERNS = [
  '123,456,789',
  '12,34,56,789',
  '123 456 789',
  '123.456.789',
];
const DECIMAL_SEPARATORS = ['.', ','];
const DECIMAL_PRECISIONS = [0, 1, 2, 3, 4, 5, 6];

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
    table.string('name_format').checkIn(NAME_FORMAT_KEYS);
    table.string('phone_country_code');
    table.boolean('full_screen_preview');
    table.string('preferred_currency').checkIn(CURRENCY_KEYS);
    table.string('digit_grouping_pattern').checkIn(DIGIT_GROUPING_PATTERNS);
    table.string('decimal_separator').checkIn(DECIMAL_SEPARATORS);
    table.integer('decimal_precision').checkIn(DECIMAL_PRECISIONS);
    table
      .string('symbol_placement')
      .checkIn(['before', 'after']);
    table.string('time_zone').checkIn(TIME_ZONE_KEYS);
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
    table.bigInteger('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('last_login_at');
    table.timestamp('password_changed_at');
    table.unique('username');
    table.index('primary_email');
    table.index('status');
  })
  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT chk_users_phone_country_code
    CHECK (phone_country_code IS NULL OR phone_country_code ~ '^\\+[0-9]{1,4}$');
  `);
  await knex.raw(`
    ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
  `);
  await knex.raw(`
    ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropForeign('created_by', 'fk_organizations_created_by');
    table.dropForeign('updated_by', 'fk_organizations_updated_by');
  });

  await knex.raw('DROP TABLE IF EXISTS users CASCADE');
};
