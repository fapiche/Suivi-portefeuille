'use strict';

module.exports = {
  jwt: {
    secret:    process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET non défini dans .env'); })(),
    expiresIn: '30d',
  },
  db: {
    adapter: (process.env.DB_ADAPTER || 'airtable').toLowerCase(),

    // Airtable
    airtable: {
      apiKey:           process.env.AIRTABLE_API_KEY,
      baseId:           process.env.AIRTABLE_BASE_ID,
      usersTable:       process.env.AIRTABLE_USERS_TABLE       || 'Users',
      portfoliosTable:  process.env.AIRTABLE_PORTFOLIOS_TABLE  || 'Portfolios',
    },

    // Supabase (placeholder)
    supabase: {
      url:        process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_KEY,
    },

    // SQLite (placeholder)
    sqlite: {
      path: process.env.SQLITE_PATH || './data/elite_horizon.db',
    },

    // PostgreSQL (placeholder)
    postgres: {
      url: process.env.DATABASE_URL,
    },
  },
};
