'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');

const { getAdapter } = require('../db');
const config         = require('../config');

const router = express.Router();

// ── Middleware JWT ────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token manquant.' });
  try {
    req.user = jwt.verify(auth.slice(7), config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré. Veuillez vous reconnecter.' });
  }
}

// ── GET /api/portfolio ────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const portfolio = await getAdapter().getPortfolio(req.user.userId);
    res.json({ portfolio: portfolio ?? null });
  } catch (err) {
    console.error('[GET /portfolio]', err);
    res.status(500).json({ error: 'Impossible de récupérer le portefeuille.' });
  }
});

// ── PUT /api/portfolio ────────────────────────────────────────

router.put('/', requireAuth, async (req, res) => {
  try {
    const { portfolio } = req.body ?? {};
    if (!Array.isArray(portfolio) && portfolio !== null)
      return res.status(400).json({ error: 'Format de portefeuille invalide.' });

    await getAdapter().savePortfolio(req.user.userId, portfolio);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /portfolio]', err);
    res.status(500).json({ error: 'Impossible de sauvegarder le portefeuille.' });
  }
});

module.exports = router;
