'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Serveur de fichiers statiques
//
// Ce serveur sert uniquement les fichiers statiques de la PWA.
// Toute la logique applicative (auth, portefeuille) est gérée
// 100% côté client via IndexedDB.
//
// Vous pouvez également servir ces fichiers avec n'importe quel
// autre serveur HTTP (Nginx, Apache, Caddy, GitHub Pages…).
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // Empêcher la traversée de répertoires
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → index.html
      fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(500); res.end('Error'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n⬡  Terminal Elite Horizon`);
  console.log(`   URL  : http://localhost:${PORT}`);
  console.log(`   Mode : PWA autonome (IndexedDB, aucune base externe)\n`);
});
