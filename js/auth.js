'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Gestionnaire d'Authentification
// Stockage : localStorage (côté client, par navigateur)
// Sécurité : hash SHA-256 des mots de passe via Web Crypto API
// ============================================================

const AuthManager = (function () {

  const KEY_USERS   = 'eh_v1_users';
  const KEY_SESSION = 'eh_v1_session';
  const SESSION_TTL = 30 * 24 * 3600e3; // 30 jours

  // ── Crypto ────────────────────────────────────────────────

  async function _hash(str) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    return [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Stockage Utilisateurs ─────────────────────────────────

  function _getUsers() {
    try { return JSON.parse(localStorage.getItem(KEY_USERS) || '{}'); }
    catch { return {}; }
  }

  function _saveUsers(users) {
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  // ── Session ───────────────────────────────────────────────

  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY_SESSION));
      if (!s) return null;
      if (Date.now() > s.exp) {
        localStorage.removeItem(KEY_SESSION);
        return null;
      }
      return s;
    } catch { return null; }
  }

  function _createSession(user) {
    const session = {
      userId:   user.id,
      username: user.username,
      email:    user.email,
      exp:      Date.now() + SESSION_TTL,
    };
    localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    return session;
  }

  function logout() {
    localStorage.removeItem(KEY_SESSION);
  }

  // ── Portfolio par Utilisateur ─────────────────────────────

  function loadPortfolio(userId) {
    try {
      const raw = localStorage.getItem(`eh_portfolio_${userId}`);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      // Fusionner avec les données template (volatility, drift, color…)
      // pour les actions présentes dans DEFAULT_PORTFOLIO
      return saved.map(s => {
        const tpl = DEFAULT_PORTFOLIO.find(t => t.ticker === s.ticker);
        return tpl ? { ...tpl, ...s } : s;
      });
    } catch { return null; }
  }

  function savePortfolio(userId, portfolio) {
    // Ne stocker que les champs propres à l'utilisateur (financiers + identifiants)
    // Les champs moteur (volatility, drift, color…) sont rechargés depuis le template
    const slim = portfolio.map(s => ({
      id:          s.id,
      ticker:      s.ticker,
      name:        s.name,
      pru:         s.pru,
      qty:         s.qty,
      account:     s.account,
      sector:      s.sector,
      country:     s.country,
      currency:    s.currency,
      dividendYield: s.dividendYield,
      // Conserver les champs moteur pour les actions non-template (ajoutées par l'utilisateur)
      volatility:  s.volatility,
      drift:       s.drift,
      color:       s.color,
      description: s.description,
    }));
    localStorage.setItem(`eh_portfolio_${userId}`, JSON.stringify(slim));
  }

  // ── Inscription ────────────────────────────────────────────

  async function register(username, email, password, confirm) {
    const users = _getUsers();

    // Validation
    username = username.trim().toLowerCase();
    email    = email.trim().toLowerCase();

    if (username.length < 3)
      throw new Error('Identifiant : 3 caractères minimum.');
    if (!/^[a-z0-9_.]+$/.test(username))
      throw new Error('Identifiant : lettres minuscules, chiffres, _ et . uniquement.');
    if (!email.includes('@') || !email.includes('.'))
      throw new Error('Adresse email invalide.');
    if (password.length < 6)
      throw new Error('Mot de passe : 6 caractères minimum.');
    if (password !== confirm)
      throw new Error('Les mots de passe ne correspondent pas.');
    if (users[username])
      throw new Error('Cet identifiant est déjà utilisé.');
    if (Object.values(users).some(u => u.email === email))
      throw new Error('Cette adresse email est déjà enregistrée.');

    const id   = (crypto.randomUUID?.() ??
      Date.now().toString(36) + Math.random().toString(36).slice(2));
    const user = {
      id,
      username,
      email,
      passwordHash: await _hash(password),
      createdAt:    Date.now(),
    };

    users[username] = user;
    _saveUsers(users);

    // Créer le portefeuille par défaut pour ce nouvel utilisateur
    savePortfolio(id, JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO)));

    return _createSession(user);
  }

  // ── Connexion ─────────────────────────────────────────────

  async function login(username, password) {
    const users = _getUsers();
    username    = username.trim().toLowerCase();

    const user  = users[username];
    if (!user)
      throw new Error('Identifiant ou mot de passe incorrect.');

    if (await _hash(password) !== user.passwordHash)
      throw new Error('Identifiant ou mot de passe incorrect.');

    return _createSession(user);
  }

  // ── API publique ──────────────────────────────────────────

  return { register, login, logout, getSession, loadPortfolio, savePortfolio };

})();
