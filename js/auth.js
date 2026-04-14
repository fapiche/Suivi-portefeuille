'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Gestionnaire d'Authentification
//
// Toutes les opérations passent par le backend REST (/api/).
// Les tokens JWT sont stockés dans localStorage (pas de cookie
// pour rester compatible avec tout hébergement statique+API).
//
// Sécurité :
//   - Hash bcrypt (coût 12) côté SERVEUR (server/routes/auth.js)
//   - JWT signé HS256, expiration 30 jours
//   - Ce fichier ne contient aucune logique cryptographique sensible
// ============================================================

const AuthManager = (function () {

  const TOKEN_KEY = 'eh_jwt';
  const USER_KEY  = 'eh_user';
  const API       = '/api';

  // ── Helpers HTTP ──────────────────────────────────────────

  async function _fetch(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res  = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);
    return data;
  }

  function _getToken()  { return localStorage.getItem(TOKEN_KEY); }

  // ── Session (lecture locale du payload JWT) ───────────────

  function getSession() {
    const token = _getToken();
    if (!token) return null;
    try {
      // Décoder le payload sans vérifier la signature (validation = serveur)
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (Date.now() >= payload.exp * 1000) {
        _clearSession();
        return null;
      }
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      _clearSession();
      return null;
    }
  }

  function _saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify({
      userId:   user.id,
      username: user.username,
      email:    user.email,
    }));
  }

  function _clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() { _clearSession(); }

  // ── Portfolio ─────────────────────────────────────────────

  async function loadPortfolio(_userId) {
    // _userId ignoré — le serveur l'extrait du token JWT
    try {
      const { portfolio } = await _fetch('GET', '/portfolio', null, _getToken());
      if (!portfolio) return null;
      // Fusionner les données sauvegardées avec le template (volatility, drift, color…)
      return portfolio.map(s => {
        const tpl = (typeof DEFAULT_PORTFOLIO !== 'undefined')
          ? DEFAULT_PORTFOLIO.find(t => t.ticker === s.ticker)
          : null;
        return tpl ? { ...tpl, ...s } : s;
      });
    } catch {
      return null;
    }
  }

  async function savePortfolio(_userId, portfolio) {
    // Sérialiser uniquement les champs utiles (éviter de stocker les données moteur redondantes)
    const slim = (portfolio ?? []).map(s => ({
      id:           s.id,
      ticker:       s.ticker,
      name:         s.name,
      pru:          s.pru,
      qty:          s.qty,
      account:      s.account,
      sector:       s.sector,
      country:      s.country,
      currency:     s.currency,
      dividendYield: s.dividendYield,
      // Conserver les champs moteur pour les actions ajoutées par l'utilisateur (hors template)
      volatility:   s.volatility,
      drift:        s.drift,
      color:        s.color,
      description:  s.description,
    }));
    try {
      await _fetch('PUT', '/portfolio', { portfolio: slim }, _getToken());
    } catch (err) {
      console.warn('[AuthManager] savePortfolio failed (will retry):', err.message);
    }
  }

  // ── Inscription ────────────────────────────────────────────

  async function register(username, email, password, confirm) {
    // Validation rapide côté client (feedback immédiat)
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

    const { token, user } = await _fetch('POST', '/auth/register', {
      username: u, email: e, password, confirm,
    });
    _saveSession(token, user);
    return { userId: user.id, username: user.username, email: user.email };
  }

  // ── Connexion ─────────────────────────────────────────────

  async function login(username, password) {
    const { token, user } = await _fetch('POST', '/auth/login', {
      username: String(username ?? '').trim().toLowerCase(),
      password: String(password ?? ''),
    });
    _saveSession(token, user);
    return { userId: user.id, username: user.username, email: user.email };
  }

  // ── API publique ──────────────────────────────────────────

  return { register, login, logout, getSession, loadPortfolio, savePortfolio };

})();
