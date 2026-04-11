'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Moteur de Cotation
// Modes : Simulation GBM / Yahoo Finance API (fallback auto)
// ============================================================

const PriceEngine = (function () {

  // ── Etat interne ────────────────────────────────────────
  let _mode            = 'simulation';
  let _tickInterval    = null;
  let _apiRetryTimer   = null;
  let _callbacks       = [];
  let _dailyChanges    = {};
  let _tickCount       = 0;

  // ── Mathématiques ────────────────────────────────────────

  /** Box-Muller — variable normale centrée réduite */
  function _randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /** GBM : S(t+dt) = S(t) · exp((μ – σ²/2)·dt + σ·ε·√dt) */
  function _gbmStep(price, vol, drift, dt) {
    return price * Math.exp((drift - vol * vol / 2) * dt + vol * _randn() * Math.sqrt(dt));
  }

  // ── Initialisation de l'historique intraday ─────────────

  function _initHistory() {
    const tickers = Object.keys(BASE_PRICES);
    const now     = Date.now();
    // dt ≈ intervalle de 2 minutes sur une journée de trading de 8h
    const dt      = (2 / 60) / (252 * 8);

    tickers.forEach(ticker => {
      const vol   = PORTFOLIO.find(s => s.ticker === ticker)?.volatility ?? 0.30;
      const drift = PORTFOLIO.find(s => s.ticker === ticker)?.drift      ?? 0.12;

      // Générer CONFIG.INTRADAY_POINTS points backwards depuis le prix de base
      const n = CONFIG.INTRADAY_POINTS;
      let   p = BASE_PRICES[ticker];
      const prices = [p];

      for (let i = 1; i < n; i++) {
        p = _gbmStep(p, vol, drift, dt);
        prices.unshift(p);
      }

      // Stocker l'historique
      PRICE_HISTORY[ticker] = prices.map((price, i) => ({
        time:  now - (n - i) * 2 * 60 * 1000,
        price: price,
      }));

      // Prix d'ouverture = premier point de l'historique
      DAILY_OPENS[ticker]   = prices[0];
      // Prix courant = dernier point
      CURRENT_PRICES[ticker] = prices[prices.length - 1];
      _dailyChanges[ticker]  = ((CURRENT_PRICES[ticker] - DAILY_OPENS[ticker]) / DAILY_OPENS[ticker]) * 100;
    });
  }

  // ── Tick de simulation ───────────────────────────────────

  function _simulateTick() {
    const dt      = CONFIG.TICK_INTERVAL / 1000 / (252 * 8 * 3600);
    const tickers = Object.keys(BASE_PRICES);
    const changes = {};

    tickers.forEach(ticker => {
      const prev  = CURRENT_PRICES[ticker];
      const stock = PORTFOLIO.find(s => s.ticker === ticker);
      if (!stock) return;

      const newPrice            = _gbmStep(prev, stock.volatility, stock.drift, dt);
      changes[ticker]           = newPrice - prev;
      CURRENT_PRICES[ticker]    = newPrice;
      _dailyChanges[ticker]     = ((newPrice - DAILY_OPENS[ticker]) / DAILY_OPENS[ticker]) * 100;

      PRICE_HISTORY[ticker].push({ time: Date.now(), price: newPrice });
      if (PRICE_HISTORY[ticker].length > 500) PRICE_HISTORY[ticker].shift();
    });

    return changes;
  }

  // ── Yahoo Finance API (tentative CORS) ──────────────────

  async function _tryFetchLive() {
    const tickers = Object.keys(BASE_PRICES).join(',');
    const url     = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}&fields=regularMarketPrice,regularMarketChangePercent`;

    try {
      const ctrl = new AbortController();
      const to   = setTimeout(() => ctrl.abort(), 5000);

      const res  = await fetch(url, {
        signal: ctrl.signal,
        mode:   'cors',
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(to);

      if (res.ok) {
        const data   = await res.json();
        const quotes = data?.quoteResponse?.result ?? [];
        if (quotes.length > 0) {
          quotes.forEach(q => {
            if (q.regularMarketPrice && BASE_PRICES[q.symbol] !== undefined) {
              CURRENT_PRICES[q.symbol]  = q.regularMarketPrice;
              _dailyChanges[q.symbol]   = q.regularMarketChangePercent ?? 0;
            }
          });
          _mode = 'live';
          return true;
        }
      }
    } catch (_) {
      // CORS bloqué ou timeout — simulation conservée
    }
    _mode = 'simulation';
    return false;
  }

  // ── Génération données historiques (par timeframe) ───────

  /**
   * Retourne un tableau [{time, price}] synthétique pour un ticker
   * sur la période demandée.
   */
  function getHistoricalData(ticker, timeframe) {
    if (timeframe === '1D') return [...(PRICE_HISTORY[ticker] ?? [])];

    const stock = PORTFOLIO.find(s => s.ticker === ticker);
    if (!stock) return [];

    const { volatility: vol, drift } = stock;
    const currentPrice = CURRENT_PRICES[ticker];
    const now          = Date.now();

    let points, dtFrac, spanMs;
    switch (timeframe) {
      case '1W': points = 56;  dtFrac = 1 / (252 * 8);     spanMs = 7   * 24 * 3600e3; break;
      case '1M': points = 30;  dtFrac = 1 / 252;            spanMs = 30  * 24 * 3600e3; break;
      case '1Y': points = 52;  dtFrac = 7 / 365;            spanMs = 365 * 24 * 3600e3; break;
      case '5Y': points = 60;  dtFrac = 30 / 365;           spanMs = 5 * 365 * 24 * 3600e3; break;
      default:   return [...(PRICE_HISTORY[ticker] ?? [])];
    }

    // Générer backwards depuis le prix courant
    let p = currentPrice;
    const arr = [p];
    for (let i = 1; i < points; i++) {
      // Inverser le drift pour remonter dans le temps
      p = p / Math.exp((drift - vol * vol / 2) * dtFrac + vol * _randn() * Math.sqrt(dtFrac));
      arr.unshift(Math.max(0.01, p));
    }

    return arr.map((price, i) => ({
      time:  now - (points - i) * (spanMs / points),
      price: price,
    }));
  }

  /**
   * Retourne un tableau [{time, value}] pour la valeur totale du
   * portefeuille sur la période demandée.
   */
  function getPortfolioHistory(timeframe) {
    // Construire l'historique de chaque action
    const histories = {};
    PORTFOLIO.forEach(s => {
      histories[s.ticker] = getHistoricalData(s.ticker, timeframe);
    });

    const refLen = histories[PORTFOLIO[0].ticker]?.length ?? 0;
    const result = [];

    for (let i = 0; i < refLen; i++) {
      let totalValue = 0;
      let totalCost  = 0;
      PORTFOLIO.forEach(s => {
        const h = histories[s.ticker];
        if (h && h[i]) {
          totalValue += s.qty * h[i].price;
          totalCost  += s.qty * s.pru;
        }
      });
      result.push({
        time:  histories[PORTFOLIO[0].ticker][i].time,
        value: totalValue,
        gain:  totalValue - totalCost,
      });
    }
    return result;
  }

  // ── Monte Carlo — Projection 12 mois ────────────────────

  function runMonteCarlo() {
    const N    = CONFIG.MONTE_CARLO_RUNS;
    const DAYS = CONFIG.MONTE_CARLO_DAYS;
    const dt   = 1 / 252;

    // Valeur courante et poids du portefeuille
    const stocks = PORTFOLIO.map(s => ({
      ticker: s.ticker,
      weight: (s.qty * CURRENT_PRICES[s.ticker]),
      vol:    s.volatility,
      drift:  s.drift,
      divYield: s.dividendYield / 100,
    }));
    const totalValue = stocks.reduce((a, s) => a + s.weight, 0);
    stocks.forEach(s => { s.weight = s.weight / totalValue; });

    const allPaths = [];
    for (let sim = 0; sim < N; sim++) {
      let pv   = totalValue;
      const path = [pv];
      for (let day = 1; day <= DAYS; day++) {
        // DCA mensuel (~chaque 21 jours de trading)
        if (day % 21 === 0) pv += CONFIG.DCA_MONTHLY;

        // Rendement du portefeuille (somme pondérée des rendements individuels)
        let r = 0;
        stocks.forEach(s => {
          const stockReturn = Math.exp((s.drift - s.vol * s.vol / 2) * dt + s.vol * _randn() * Math.sqrt(dt)) - 1;
          r += s.weight * stockReturn;
        });
        pv = pv * (1 + r);

        // Dividendes trimestriels (~63 jours de trading)
        if (day % 63 === 0) {
          PORTFOLIO.forEach(s => {
            pv += (s.qty * CURRENT_PRICES[s.ticker] * (s.dividendYield / 100)) / 4;
          });
        }

        path.push(Math.max(0, pv));
      }
      allPaths.push(path);
    }

    // Calcul des percentiles pour chaque jour
    const pct = (arr, p) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx    = Math.max(0, Math.min(sorted.length - 1, Math.round(p / 100 * sorted.length)));
      return sorted[idx];
    };

    // Sous-échantillonner pour l'affichage (52 points ~ hebdomadaire)
    const step        = Math.ceil(DAYS / 52);
    const indices     = Array.from({ length: Math.ceil(DAYS / step) + 1 }, (_, i) => Math.min(i * step, DAYS));
    const optimistic  = indices.map(d => pct(allPaths.map(p => p[d]), 85));
    const central     = indices.map(d => pct(allPaths.map(p => p[d]), 50));
    const pessimistic = indices.map(d => pct(allPaths.map(p => p[d]), 15));

    // Labels mensuels
    const now    = new Date();
    const labels = indices.map(d => {
      const date = new Date(now.getTime() + d * 24 * 3600e3);
      return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    });

    // Dividendes cumulés mensuels pour les barres
    const dividendBars = [];
    let cumDiv = 0;
    indices.forEach((d, i) => {
      if (i > 0) {
        const prevD = indices[i - 1];
        const daysInPeriod = d - prevD;
        PORTFOLIO.forEach(s => {
          cumDiv += (s.qty * CURRENT_PRICES[s.ticker] * (s.dividendYield / 100)) * (daysInPeriod / 365);
        });
      }
      dividendBars.push(cumDiv);
    });

    return { labels, optimistic, central, pessimistic, dividendBars, totalValue };
  }

  // ── API Publique ─────────────────────────────────────────

  function start() {
    _initHistory();

    // Tentative connexion live au démarrage
    _tryFetchLive().then(isLive => {
      _callbacks.forEach(cb => cb({ changes: {}, mode: _mode, isFirst: true }));
    });

    _tickInterval = setInterval(() => {
      _tickCount++;
      const changes = _simulateTick();
      // Toutes les 20 ticks (~60s), re-tenter l'API live
      if (_mode !== 'live' && _tickCount % 20 === 0) _tryFetchLive();
      _callbacks.forEach(cb => cb({ changes, mode: _mode, isFirst: false }));
    }, CONFIG.TICK_INTERVAL);
  }

  function stop() {
    if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
    if (_apiRetryTimer) { clearTimeout(_apiRetryTimer); _apiRetryTimer = null; }
  }

  function onTick(cb) { _callbacks.push(cb); }
  function getMode()  { return _mode; }
  function getDailyChange(ticker) { return _dailyChanges[ticker] ?? 0; }

  return { start, stop, onTick, getMode, getDailyChange, getHistoricalData, getPortfolioHistory, runMonteCarlo };

})();
