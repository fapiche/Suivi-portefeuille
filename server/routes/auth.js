'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { getAdapter } = require('../db');
const config         = require('../config');

const router = express.Router();

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirm } = req.body ?? {};
    const db = getAdapter();

    const u = String(username ?? '').trim().toLowerCase();
    const e = String(email    ?? '').trim().toLowerCase();
    const p = String(password ?? '');

    // Validation
    if (u.length < 3)
      return res.status(400).json({ error: 'Identifiant : 3 caractères minimum.' });
    if (!/^[a-z0-9_.]+$/.test(u))
      return res.status(400).json({ error: 'Identifiant invalide — lettres minuscules, chiffres, _ et . uniquement.' });
    if (!e.includes('@') || !e.includes('.'))
      return res.status(400).json({ error: 'Adresse email invalide.' });
    if (p.length < 6)
      return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
    if (p !== confirm)
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });

    // Unicité
    if (await db.findUserByUsername(u))
      return res.status(409).json({ error: 'Cet identifiant est déjà utilisé.' });
    if (await db.findUserByEmail(e))
      return res.status(409).json({ error: 'Cette adresse email est déjà enregistrée.' });

    // Création
    const user = await db.createUser({
      id:           uuidv4(),
      username:     u,
      email:        e,
      passwordHash: await bcrypt.hash(p, 12),
      createdAt:    new Date().toISOString(),
    });

    // Le portefeuille sera sauvegardé par le frontend après le premier login
    await db.savePortfolio(user.id, null);

    const token = _signToken(user);
    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });

  } catch (err) {
    console.error('[POST /auth/register]', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    const db = getAdapter();

    const u    = String(username ?? '').trim().toLowerCase();
    const user = await db.findUserByUsername(u);

    if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash)))
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });

    const token = _signToken(user);
    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });

  } catch (err) {
    console.error('[POST /auth/login]', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ── Helpers ──────────────────────────────────────────────────

function _signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = router;
