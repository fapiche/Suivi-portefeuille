'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Authentification 100% client-side
//
// Aucun serveur requis. Toutes les données sont stockées
// localement dans le navigateur :
//   - IndexedDB  → comptes utilisateurs + portefeuilles
//   - SubtleCrypto (PBKDF2) → hachage des mots de passe
//   - localStorage → session active (30 jours)
//
// L'API publique est identique à la version serveur pour que
// le reste de l'application ne change pas.
// ============================================================

const AuthManager = (function () {

  const DB_NAME     = 'eh_db';
  const DB_VERSION  = 1;
  const SESSION_KEY = 'eh_session';

  let _db = null;

  // ── IndexedDB ─────────────────────────────────────────────

  function _openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('username', 'username', { unique: true });
          store.createIndex('email',    'email',    { unique: true });
        }
        if (!db.objectStoreNames.contains('portfolios')) {
          db.createObjectStore('portfolios', { keyPath: 'userId' });
        }
      };

      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _get(store, key) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    }));
  }

  function _getByIndex(store, index, value) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly')
                    .objectStore(store).index(index).get(value);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    }));
  }

  function _put(store, record) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  // ── Hachage mot de passe (PBKDF2 / SubtleCrypto) ─────────

  async function _hashPassword(password) {
    const enc  = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      key, 256
    );
    return JSON.stringify({
      hash: Array.from(new Uint8Array(bits)),
      salt: Array.from(salt),
    });
  }

  async function _verifyPassword(password, stored) {
    const { hash, salt } = JSON.parse(stored);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100_000, hash: 'SHA-256' },
      key, 256
    );
    const newHash = Array.from(new Uint8Array(bits));
    return hash.length === newHash.length && hash.every((b, i) => b === newHash[i]);
  }

  // ── Session ───────────────────────────────────────────────

  function _saveSession(user) {
    const session = {
      userId:   user.id,
      username: user.username,
      email:    user.email,
      exp:      Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.exp) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── Inscription ────────────────────────────────────────────

  async function register(username, email, password, confirm) {
    const u = String(username ?? '').trim().toLowerCase();
    const e = String(email    ?? '').trim().toLowerCase();

    if (u.length < 3)
      throw new Error('Identifiant : 3 caractères minimum.');
    if (!/^[a-z0-9_.]+$/.test(u))
      throw new Error('Identifiant : lettres minuscules, chiffres, _ et . uniquement.');
    if (!e.includes('@') || !e.includes('.'))
      throw new Error('Adresse email invalide.');
    if (String(password ?? '').length < 6)
      throw new Error('Mot de passe : 6 caractères minimum.');
    if (password !== confirm)
      throw new Error('Les mots de passe ne correspondent pas.');

    const [existingUser, existingEmail] = await Promise.all([
      _getByIndex('users', 'username', u),
      _getByIndex('users', 'email',    e),
    ]);
    if (existingUser)  throw new Error('Ce nom d\'utilisateur est déjà pris.');
    if (existingEmail) throw new Error('Cet email est déjà utilisé.');

    const user = {
      id:           crypto.randomUUID(),
      username:     u,
      email:        e,
      passwordHash: await _hashPassword(password),
      createdAt:    new Date().toISOString(),
    };
    await _put('users',      user);
    await _put('portfolios', { userId: user.id, portfolio: null, updatedAt: new Date().toISOString() });

    return _saveSession(user);
  }

  // ── Connexion ─────────────────────────────────────────────

  async function login(username, password) {
    if (!username || !password)
      throw new Error('Identifiants manquants.');

    const user = await _getByIndex('users', 'username', String(username).trim().toLowerCase());
    if (!user)
      throw new Error('Utilisateur introuvable.');

    const ok = await _verifyPassword(String(password), user.passwordHash);
    if (!ok)
      throw new Error('Mot de passe incorrect.');

    return _saveSession(user);
  }

  // ── Portefeuille ──────────────────────────────────────────

  async function loadPortfolio(userId) {
    try {
      const record = await _get('portfolios', userId);
      const saved  = record?.portfolio;
      if (!Array.isArray(saved) || saved.length === 0) return null;

      // Fusionner avec le template DEFAULT_PORTFOLIO (volatility, drift, color…)
      const tplMap = typeof DEFAULT_PORTFOLIO !== 'undefined'
        ? Object.fromEntries(DEFAULT_PORTFOLIO.map(s => [s.ticker, s]))
        : {};
      return saved.map(s => ({ ...(tplMap[s.ticker] || {}), ...s }));
    } catch {
      return null;
    }
  }

  async function savePortfolio(userId, portfolio) {
    const slim = (portfolio ?? []).map(s => ({
      id:            s.id,
      ticker:        s.ticker,
      name:          s.name,
      pru:           s.pru,
      qty:           s.qty,
      account:       s.account,
      sector:        s.sector,
      country:       s.country,
      currency:      s.currency,
      dividendYield: s.dividendYield,
      volatility:    s.volatility,
      drift:         s.drift,
      color:         s.color,
      description:   s.description,
    }));
    try {
      await _put('portfolios', { userId, portfolio: slim, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('[AuthManager] savePortfolio failed:', err.message);
    }
  }

  // ── API publique ──────────────────────────────────────────

  return { register, login, logout, getSession, loadPortfolio, savePortfolio };

})();
