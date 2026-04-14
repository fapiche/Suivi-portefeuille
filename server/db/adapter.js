'use strict';

/**
 * DatabaseAdapter — Interface abstraite
 *
 * Pour brancher une nouvelle base de données :
 *   1. Créer un fichier server/db/<nom>.js qui extends cette classe
 *   2. Implémenter les 5 méthodes ci-dessous
 *   3. Enregistrer le case dans server/db/index.js
 *   4. Ajouter les variables d'environnement dans .env.example
 *
 * Contrat de données :
 *
 *   User {
 *     id:           string   — UUID v4
 *     username:     string   — identifiant unique (minuscules)
 *     email:        string   — email unique (minuscules)
 *     passwordHash: string   — bcrypt hash (coût 12)
 *     createdAt:    string   — ISO 8601
 *   }
 *
 *   Portfolio : tableau JSON sérialisé (array d'objets action)
 */
class DatabaseAdapter {

  /**
   * Rechercher un utilisateur par son identifiant.
   * @param {string} username
   * @returns {Promise<User|null>}
   */
  async findUserByUsername(username) {
    throw new Error(`[${this.constructor.name}] findUserByUsername() non implémenté.`);
  }

  /**
   * Rechercher un utilisateur par son adresse email.
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findUserByEmail(email) {
    throw new Error(`[${this.constructor.name}] findUserByEmail() non implémenté.`);
  }

  /**
   * Créer un nouvel utilisateur.
   * @param {User} user
   * @returns {Promise<User>} — l'utilisateur tel qu'il est persisté
   */
  async createUser(user) {
    throw new Error(`[${this.constructor.name}] createUser() non implémenté.`);
  }

  /**
   * Récupérer le portefeuille d'un utilisateur.
   * @param {string} userId
   * @returns {Promise<Object[]|null>} — null si aucun portefeuille trouvé
   */
  async getPortfolio(userId) {
    throw new Error(`[${this.constructor.name}] getPortfolio() non implémenté.`);
  }

  /**
   * Créer ou mettre à jour le portefeuille d'un utilisateur (upsert).
   * @param {string}   userId
   * @param {Object[]|null} portfolio
   * @returns {Promise<void>}
   */
  async savePortfolio(userId, portfolio) {
    throw new Error(`[${this.constructor.name}] savePortfolio() non implémenté.`);
  }
}

module.exports = DatabaseAdapter;
