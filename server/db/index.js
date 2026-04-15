'use strict';

/**
 * Fabrique d'adaptateurs de base de données.
 *
 * Pour ajouter un nouvel adaptateur :
 *   1. Créer server/db/<nom>.js (extends DatabaseAdapter)
 *   2. Ajouter un case ci-dessous
 *   3. Définir les variables d'env dans .env.example et server/config.js
 */

const config = require('../config');

let _instance = null;

function getAdapter() {
  if (_instance) return _instance;

  const name = config.db.adapter;

  switch (name) {
    case 'airtable':
      _instance = new (require('./airtable'))();
      break;

    // ── Futurs adaptateurs ────────────────────────────────
    // case 'supabase':
    //   _instance = new (require('./supabase'))();
    //   break;

    // case 'sqlite':
    //   _instance = new (require('./sqlite'))();
    //   break;

    // case 'postgres':
    //   _instance = new (require('./postgres'))();
    //   break;

    default:
      throw new Error(
        `Adaptateur inconnu : "${name}". ` +
        `Valeurs supportées : airtable. ` +
        `Vérifiez DB_ADAPTER dans votre fichier .env.`
      );
  }

  console.log(`[DB] Adaptateur chargé : ${name}`);
  return _instance;
}

module.exports = { getAdapter };
