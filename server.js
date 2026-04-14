'use strict';
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');

const authRoutes      = require('./server/routes/auth');
const portfolioRoutes = require('./server/routes/portfolio');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/portfolio', portfolioRoutes);

// ── Servir la SPA (fichiers statiques) ───────────────────────
app.use(express.static(path.join(__dirname)));
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

// ── Démarrage ────────────────────────────────────────────────
app.listen(PORT, () => {
  const adapter = process.env.DB_ADAPTER || 'airtable';
  console.log(`\n⬡  Terminal Elite Horizon`);
  console.log(`   URL     : http://localhost:${PORT}`);
  console.log(`   Adapter : ${adapter}`);
  console.log(`   Mode    : ${process.env.NODE_ENV || 'development'}\n`);
});
