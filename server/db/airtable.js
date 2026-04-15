'use strict';

/**
 * AirtableAdapter — Implémentation Airtable
 *
 * Schéma requis dans votre base Airtable :
 *
 * Table "Users"
 * ┌─────────────────┬──────────────────────────┐
 * │ Champ           │ Type Airtable             │
 * ├─────────────────┼──────────────────────────┤
 * │ user_id         │ Single line text          │
 * │ username        │ Single line text          │
 * │ email           │ Email                     │
 * │ password_hash   │ Single line text          │
 * │ created_at      │ Single line text          │
 * └─────────────────┴──────────────────────────┘
 *
 * Table "Portfolios"
 * ┌─────────────────┬──────────────────────────┐
 * │ Champ           │ Type Airtable             │
 * ├─────────────────┼──────────────────────────┤
 * │ user_id         │ Single line text          │
 * │ portfolio_json  │ Long text                 │
 * │ updated_at      │ Single line text          │
 * └─────────────────┴──────────────────────────┘
 *
 * Note : Airtable limite à 5 req/s par base. Pour un usage en production
 * à fort trafic, préférez Supabase ou PostgreSQL.
 */

const Airtable       = require('airtable');
const DatabaseAdapter = require('./adapter');
const config         = require('../config');

class AirtableAdapter extends DatabaseAdapter {

  constructor() {
    super();
    const { apiKey, baseId, usersTable, portfoliosTable } = config.db.airtable;

    if (!apiKey)  throw new Error('AIRTABLE_API_KEY manquant dans .env');
    if (!baseId)  throw new Error('AIRTABLE_BASE_ID manquant dans .env');

    const base       = new Airtable({ apiKey }).base(baseId);
    this._users      = base(usersTable);
    this._portfolios = base(portfoliosTable);
  }

  // ── Users ──────────────────────────────────────────────────

  async findUserByUsername(username) {
    const rows = await this._users
      .select({ filterByFormula: `{username} = "${_esc(username)}"`, maxRecords: 1 })
      .firstPage();
    return rows.length ? this._toUser(rows[0]) : null;
  }

  async findUserByEmail(email) {
    const rows = await this._users
      .select({ filterByFormula: `{email} = "${_esc(email)}"`, maxRecords: 1 })
      .firstPage();
    return rows.length ? this._toUser(rows[0]) : null;
  }

  async createUser(user) {
    const created = await this._users.create([{
      fields: {
        user_id:       user.id,
        username:      user.username,
        email:         user.email,
        password_hash: user.passwordHash,
        created_at:    user.createdAt,
      },
    }]);
    return this._toUser(created[0]);
  }

  // ── Portfolios ────────────────────────────────────────────

  async getPortfolio(userId) {
    const rows = await this._portfolios
      .select({ filterByFormula: `{user_id} = "${_esc(userId)}"`, maxRecords: 1 })
      .firstPage();
    if (!rows.length) return null;
    try {
      const raw = rows[0].fields.portfolio_json;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async savePortfolio(userId, portfolio) {
    const rows = await this._portfolios
      .select({ filterByFormula: `{user_id} = "${_esc(userId)}"`, maxRecords: 1 })
      .firstPage();

    const fields = {
      portfolio_json: portfolio ? JSON.stringify(portfolio) : null,
      updated_at:     new Date().toISOString(),
    };

    if (rows.length) {
      // UPDATE
      await this._portfolios.update([{ id: rows[0].id, fields }]);
    } else {
      // INSERT
      await this._portfolios.create([{ fields: { user_id: userId, ...fields } }]);
    }
  }

  // ── Mapping interne ───────────────────────────────────────

  _toUser(record) {
    return {
      id:           record.fields.user_id,
      username:     record.fields.username,
      email:        record.fields.email,
      passwordHash: record.fields.password_hash,
      createdAt:    record.fields.created_at,
    };
  }
}

/**
 * Échappe les guillemets dans les formules Airtable
 * pour prévenir les injections de formule.
 */
function _esc(str) {
  return String(str).replace(/"/g, '\\"');
}

module.exports = AirtableAdapter;
