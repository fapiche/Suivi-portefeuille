'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Application Principale
// ============================================================

// ── État global ─────────────────────────────────────────────
const AppState = {
  activeTab:        'portfolio',
  chartTimeframe:   '1D',
  chartDisplay:     'value',   // 'value' | 'gain'
  selectedTicker:   null,
  portfolioChart:   null,
  predictionChart:  null,
  auditChart:       null,
  allocationChart:  null,
  macroNewsIndex:   0,
  editingRow:       null,
  mcData:           null,
};

// ── Calculs Portefeuille ─────────────────────────────────────

function getPortfolioValue() {
  return PORTFOLIO.reduce((sum, s) => sum + s.qty * CURRENT_PRICES[s.ticker], 0);
}

function getPortfolioCost() {
  return PORTFOLIO.reduce((sum, s) => sum + s.qty * s.pru, 0);
}

function getPortfolioGain() {
  return getPortfolioValue() - getPortfolioCost();
}

function getAnnualDividends() {
  return PORTFOLIO.reduce((sum, s) => {
    return sum + s.qty * CURRENT_PRICES[s.ticker] * (s.dividendYield / 100);
  }, 0);
}

function getStockValue(stock)    { return stock.qty * CURRENT_PRICES[stock.ticker]; }
function getStockCost(stock)     { return stock.qty * stock.pru; }
function getStockGain(stock)     { return getStockValue(stock) - getStockCost(stock); }
function getStockGainPct(stock)  { return ((CURRENT_PRICES[stock.ticker] - stock.pru) / stock.pru) * 100; }

// ── Persistance portefeuille ──────────────────────────────────

function saveCurrentPortfolio() {
  const session = AuthManager.getSession();
  // savePortfolio est async — on laisse tourner en tâche de fond
  if (session) AuthManager.savePortfolio(session.userId, PORTFOLIO).catch(console.warn);
}

// ── Formatage ────────────────────────────────────────────────

const fmt = {
  price: v => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €',
  pct:   v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%',
  num:   v => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
  short: v => {
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + ' M€';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + ' k€';
    return fmt.price(v);
  },
};

function gainClass(v) { return v >= 0 ? 'gain' : 'loss'; }
function sentimentClass(s) {
  return s === 'haussier' ? 'bullish' : s === 'baissier' ? 'bearish' : 'neutral';
}
function sentimentLabel(s) {
  return s === 'haussier' ? '▲ Haussier' : s === 'baissier' ? '▼ Baissier' : '● Neutre';
}

// ── Gestion des Onglets ──────────────────────────────────────

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  const content = document.getElementById('tab-' + tabId);
  const btn     = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (content) { content.classList.add('active'); content.classList.add('fade-in'); }
  if (btn)     btn.classList.add('active');

  AppState.activeTab = tabId;

  // Initialisation à la demande
  if (tabId === 'portfolio')   { renderPortfolioTab(); }
  if (tabId === 'macro')       { renderMacroTab(); }
  if (tabId === 'predictions') { renderPredictionsTab(); }
  if (tabId === 'audit')       { renderAuditTab(); }
  if (tabId === 'manage')      { renderManageTab(); }
  if (tabId === 'gem')         { renderGemTab(); }
}

// ============================================================
// TAB A — ANALYSE PORTEFEUILLE
// ============================================================

function renderPortfolioTab() {
  updateKPIs();
  renderStockTable();
  initOrUpdatePortfolioChart();
  if (AppState.selectedTicker) renderStockNews(AppState.selectedTicker);
  else renderStockNewsPlaceholder();
}

function updateKPIs() {
  const val       = getPortfolioValue();
  const cost      = getPortfolioCost();
  const gain      = val - cost;
  const gainPct   = (gain / cost) * 100;
  const divAnnual = getAnnualDividends();

  setEl('kpi-total-value',    fmt.price(val));
  setEl('kpi-total-invested', 'Investi : ' + fmt.price(cost));
  setEl('kpi-total-gain',     (gain >= 0 ? '+' : '') + fmt.price(gain));
  setEl('kpi-total-gain-pct', fmt.pct(gainPct));

  const gainEl = document.getElementById('kpi-total-gain');
  if (gainEl) gainEl.className = 'kpi-value ' + gainClass(gain);

  setEl('kpi-lines',      PORTFOLIO.length.toString());
  setEl('kpi-cto-pea',    'CTO: ' + PORTFOLIO.filter(s => s.account === 'CTO').length + '  |  PEA: ' + PORTFOLIO.filter(s => s.account === 'PEA').length);
  setEl('kpi-dividends',  fmt.price(divAnnual) + ' /an');
  setEl('kpi-dca',        'DCA ' + CONFIG.DCA_MONTHLY + ' €/mois');
}

function renderStockTable() {
  const totalVal = getPortfolioValue();
  const tbody    = document.getElementById('stock-table-body');
  if (!tbody) return;

  tbody.innerHTML = PORTFOLIO.map(stock => {
    const price    = CURRENT_PRICES[stock.ticker];
    const value    = getStockValue(stock);
    const gain     = getStockGain(stock);
    const gainPct  = getStockGainPct(stock);
    const dayChg   = PriceEngine.getDailyChange(stock.ticker);
    const weight   = (value / totalVal) * 100;
    const isMicro  = value < 500;

    return `
      <tr class="stock-row ${isMicro ? 'micro-line' : ''}" data-ticker="${stock.ticker}"
          title="${isMicro ? '⚠ Micro-ligne (<500€) — Cf. Audit Stratégique' : ''}">
        <td><span class="badge badge-${stock.account.toLowerCase()}">${stock.account}</span></td>
        <td class="col-name">
          <span class="ticker">${stock.ticker}</span>
          <span class="name">${stock.name}</span>
        </td>
        <td class="mono">${fmt.num(stock.pru)} €</td>
        <td class="mono price-cell" id="price-${stock.ticker}">${fmt.num(price)} €</td>
        <td class="mono ${gainClass(dayChg)}">${fmt.pct(dayChg)}</td>
        <td class="mono ${gainClass(gainPct)}">${fmt.pct(gainPct)}</td>
        <td class="mono">${fmt.price(value)}</td>
        <td>
          <div class="weight-bar-wrap">
            <div class="weight-bar" style="width:${Math.min(100, weight * 1.2)}%"></div>
            <span class="weight-label">${weight.toFixed(1)}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Clic sur une ligne → sélection + graph individuel
  tbody.querySelectorAll('.stock-row').forEach(row => {
    row.addEventListener('click', () => {
      tbody.querySelectorAll('.stock-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      const ticker = row.dataset.ticker;
      AppState.selectedTicker = ticker;
      initOrUpdatePortfolioChart();
      renderStockNews(ticker);
    });
  });
}

function flashPrice(ticker, direction) {
  const cell = document.getElementById('price-' + ticker);
  if (!cell) return;
  cell.classList.remove('flash-up', 'flash-down');
  void cell.offsetWidth; // reflow
  cell.classList.add(direction === 'up' ? 'flash-up' : 'flash-down');
  cell.textContent = fmt.num(CURRENT_PRICES[ticker]) + ' €';
}

// ── Graphique Principal ──────────────────────────────────────

function initOrUpdatePortfolioChart() {
  const ctx = document.getElementById('portfolio-chart');
  if (!ctx) return;

  const tf       = AppState.chartTimeframe;
  const display  = AppState.chartDisplay;
  const ticker   = AppState.selectedTicker;

  let dataPoints, labelTitle;

  if (ticker) {
    const hist = PriceEngine.getHistoricalData(ticker, tf);
    const stock = PORTFOLIO.find(s => s.ticker === ticker);
    labelTitle = `${ticker} – ${stock?.name ?? ''}`;
    dataPoints = hist.map(p => ({
      x: new Date(p.time),
      y: display === 'gain' ? (p.price - stock.pru) * stock.qty : p.price,
    }));
  } else {
    const hist = PriceEngine.getPortfolioHistory(tf);
    labelTitle = 'Portefeuille Global';
    dataPoints = hist.map(p => ({
      x: new Date(p.time),
      y: display === 'gain' ? p.gain : p.value,
    }));
  }

  const isGain      = display === 'gain';
  const lastY       = dataPoints.length ? dataPoints[dataPoints.length - 1].y : 0;
  const firstY      = dataPoints.length ? dataPoints[0].y : 0;
  const trendUp     = lastY >= firstY;
  const lineColor   = isGain ? (trendUp ? '#00e676' : '#ff1744') : '#00d4ff';
  const fillColor   = isGain ? (trendUp ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)') : 'rgba(0,212,255,0.10)';

  const chartData = {
    datasets: [{
      label:           labelTitle,
      data:            dataPoints,
      borderColor:     lineColor,
      backgroundColor: fillColor,
      borderWidth:     2,
      fill:            true,
      tension:         0.3,
      pointRadius:     0,
      pointHoverRadius: 4,
    }],
  };

  const chartOpts = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2540',
        borderColor:     '#2a3a60',
        borderWidth:     1,
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            return isGain
              ? (v >= 0 ? '  +' : '  ') + fmt.price(v)
              : '  ' + fmt.price(v);
          },
        },
      },
    },
    scales: {
      x: {
        type:    'time',
        time:    { tooltipFormat: tf === '1D' ? 'HH:mm' : 'dd/MM/yy' },
        grid:    { color: 'rgba(255,255,255,0.04)' },
        ticks:   { color: '#8899bb', maxTicksLimit: 8, font: { size: 11 } },
      },
      y: {
        position: 'right',
        grid:     { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#8899bb',
          font:  { size: 11 },
          callback: v => {
            if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + 'k €';
            return v.toFixed(0) + ' €';
          },
        },
      },
    },
  };

  if (AppState.portfolioChart) {
    AppState.portfolioChart.data    = chartData;
    AppState.portfolioChart.options = chartOpts;
    AppState.portfolioChart.update('none');
  } else {
    AppState.portfolioChart = new Chart(ctx, { type: 'line', data: chartData, options: chartOpts });
  }

  // Mise à jour du titre
  setEl('chart-title', labelTitle);
}

// ── Actualités Stock ─────────────────────────────────────────

function renderStockNews(ticker) {
  const news   = STOCK_NEWS[ticker] ?? [];
  const stock  = PORTFOLIO.find(s => s.ticker === ticker);
  const header = document.getElementById('news-stock-title');
  const list   = document.getElementById('news-list');
  if (!header || !list) return;

  header.textContent = `Actualités — ${stock?.name ?? ticker}`;

  list.innerHTML = news.map((n, i) => `
    <article class="news-item news-${sentimentClass(n.sentiment)}" data-news-idx="${i}" data-ticker="${ticker}">
      <div class="news-meta">
        <span class="news-sentiment ${sentimentClass(n.sentiment)}">${sentimentLabel(n.sentiment)}</span>
        <span class="news-time">${n.time}</span>
      </div>
      <h4 class="news-title">${n.title}</h4>
      <p class="news-preview">${n.body.substring(0, 100)}…</p>
    </article>
  `).join('') || '<p class="news-empty">Aucune actualité disponible pour cette action.</p>';

  list.querySelectorAll('.news-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx   = parseInt(el.dataset.newsIdx);
      const nData = STOCK_NEWS[el.dataset.ticker][idx];
      openNewsModal(nData);
    });
  });
}

function renderStockNewsPlaceholder() {
  const list = document.getElementById('news-list');
  if (list) list.innerHTML = '<p class="news-empty">Cliquez sur une action pour afficher ses actualités.</p>';
  const header = document.getElementById('news-stock-title');
  if (header) header.textContent = 'Fil d\'actualités — Sélectionnez une action';
}

function openNewsModal(news) {
  let modal = document.getElementById('news-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'news-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" id="modal-close-btn">&times;</button>
        <div class="modal-source" id="modal-source"></div>
        <h3 class="modal-title" id="modal-title"></h3>
        <div class="modal-sentiment" id="modal-sentiment"></div>
        <p class="modal-body" id="modal-body"></p>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  }

  document.getElementById('modal-source').textContent    = news.source ?? 'Analyse interne';
  document.getElementById('modal-title').textContent     = news.title;
  document.getElementById('modal-body').textContent      = news.body;
  const sentEl = document.getElementById('modal-sentiment');
  sentEl.textContent = sentimentLabel(news.sentiment ?? 'neutre');
  sentEl.className   = 'modal-sentiment ' + sentimentClass(news.sentiment ?? 'neutre');

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const m = document.getElementById('news-modal');
  if (m) m.classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================================
// TAB B — RADAR MACRO
// ============================================================

function renderMacroTab() {
  const container = document.getElementById('macro-news-container');
  if (!container) return;

  // Rotation des actualités (afficher 5 à la fois)
  const start    = AppState.macroNewsIndex % MACRO_NEWS.length;
  const visible  = [...MACRO_NEWS.slice(start), ...MACRO_NEWS.slice(0, start)].slice(0, 6);

  container.innerHTML = visible.map(n => {
    const affectedHtml = n.affected.map(t => `<span class="ticker-tag">${t}</span>`).join('');
    const horizonsHtml = Object.entries(n.horizons).map(([h, v]) =>
      `<div class="horizon-item"><span class="horizon-label">${h}</span><span class="horizon-val ${sentimentClass(v)}">${sentimentLabel(v)}</span></div>`
    ).join('');
    const scoreSign = n.impact.score >= 0 ? '+' : '';

    return `
      <article class="macro-card macro-${sentimentClass(n.impact.rating)}">
        <div class="macro-header">
          <span class="macro-category">${n.category}</span>
          <span class="macro-time">${n.time}</span>
          <span class="macro-score ${sentimentClass(n.impact.rating)}">${scoreSign}${n.impact.score}</span>
        </div>
        <h4 class="macro-title">${n.title}</h4>
        <p class="macro-body">${n.body}</p>
        <div class="macro-affected">
          <span class="macro-affected-label">Lignes concernées :</span>
          ${affectedHtml}
        </div>
        <div class="macro-horizons">${horizonsHtml}</div>
        <div class="macro-source">${n.source}</div>
      </article>`;
  }).join('');
}

// ============================================================
// TAB C — PRÉDICTIONS IA (Monte Carlo)
// ============================================================

function renderPredictionsTab() {
  const ctx = document.getElementById('prediction-chart');
  if (!ctx) return;

  // Calculer Monte Carlo (une seule fois par session)
  if (!AppState.mcData) {
    AppState.mcData = PriceEngine.runMonteCarlo();
  }
  const mc = AppState.mcData;

  // Mise à jour KPIs prédiction
  const last = mc.central.length - 1;
  setEl('mc-central',    fmt.price(mc.central[last]));
  setEl('mc-optimistic', fmt.price(mc.optimistic[last]));
  setEl('mc-pessimistic',fmt.price(mc.pessimistic[last]));
  setEl('mc-dividends',  fmt.price(mc.dividendBars[last]));
  const roi = ((mc.central[last] - mc.totalValue) / mc.totalValue) * 100;
  const roiEl = document.getElementById('mc-roi');
  if (roiEl) { roiEl.textContent = fmt.pct(roi); roiEl.className = 'kpi-value ' + gainClass(roi); }

  // Détruire l'ancien chart
  if (AppState.predictionChart) { AppState.predictionChart.destroy(); AppState.predictionChart = null; }

  AppState.predictionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mc.labels,
      datasets: [
        {
          label:           'Scénario Optimiste (85e)',
          data:            mc.optimistic,
          borderColor:     'rgba(0,230,118,0.7)',
          backgroundColor: 'rgba(0,230,118,0.08)',
          borderWidth:     1.5,
          borderDash:      [4, 3],
          fill:            '+1',
          pointRadius:     0,
          tension:         0.4,
        },
        {
          label:           'Scénario Central (médiane)',
          data:            mc.central,
          borderColor:     '#a78bfa',
          backgroundColor: 'rgba(167,139,250,0.10)',
          borderWidth:     2.5,
          fill:            false,
          pointRadius:     0,
          tension:         0.4,
        },
        {
          label:           'Scénario Pessimiste (15e)',
          data:            mc.pessimistic,
          borderColor:     'rgba(255,23,68,0.6)',
          backgroundColor: 'rgba(255,23,68,0.06)',
          borderWidth:     1.5,
          borderDash:      [4, 3],
          fill:            false,
          pointRadius:     0,
          tension:         0.4,
        },
        {
          label:           'Dividendes cumulés',
          data:            mc.dividendBars,
          type:            'bar',
          backgroundColor: 'rgba(0,230,118,0.25)',
          borderColor:     'rgba(0,230,118,0.5)',
          borderWidth:     1,
          yAxisID:         'yDiv',
          order:           10,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display:  true,
          position: 'top',
          labels:   { color: '#8899bb', font: { size: 11 }, boxWidth: 16, padding: 16 },
        },
        tooltip: {
          backgroundColor: '#1a2540',
          borderColor:     '#2a3a60',
          borderWidth:     1,
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ${fmt.price(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8899bb', maxTicksLimit: 13, font: { size: 11 } },
        },
        y: {
          position: 'right',
          grid:     { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8899bb',
            font:  { size: 11 },
            callback: v => (v / 1000).toFixed(0) + 'k €',
          },
        },
        yDiv: {
          position: 'left',
          display:  true,
          grid:     { display: false },
          ticks: {
            color: 'rgba(0,230,118,0.6)',
            font:  { size: 10 },
            callback: v => v > 0 ? (v).toFixed(0) + ' €' : '',
          },
        },
      },
    },
  });
}

// ============================================================
// TAB D — AUDIT STRATÉGIQUE
// ============================================================

function renderAuditTab() {
  renderAllocationChart();
  renderPerformanceChart();
}

function renderAllocationChart() {
  const ctx = document.getElementById('allocation-chart');
  if (!ctx) return;

  // Regrouper par secteur
  const sectors = {};
  PORTFOLIO.forEach(s => {
    const val = getStockValue(s);
    sectors[s.sector] = (sectors[s.sector] ?? 0) + val;
  });
  const totalVal  = getPortfolioValue();
  const labels    = Object.keys(sectors);
  const values    = labels.map(l => sectors[l]);
  const colors    = ['#00d4ff','#a78bfa','#00e676','#ff9800','#ff1744','#ffd600','#64b5f6'];

  if (AppState.allocationChart) { AppState.allocationChart.destroy(); AppState.allocationChart = null; }

  AppState.allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderColor:     '#0f1629',
        borderWidth:     3,
        hoverBorderWidth: 2,
      }],
    },
    options: {
      cutout:      '65%',
      responsive:  true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'right',
          labels:   { color: '#8899bb', font: { size: 12 }, padding: 12 },
        },
        tooltip: {
          backgroundColor: '#1a2540',
          borderColor:     '#2a3a60',
          borderWidth:     1,
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / totalVal) * 100).toFixed(1);
              return `  ${ctx.label}: ${pct}%  (${fmt.price(ctx.parsed)})`;
            },
          },
        },
      },
    },
  });
}

function renderPerformanceChart() {
  const ctx = document.getElementById('performance-chart');
  if (!ctx) return;

  const sorted = [...PORTFOLIO].sort((a, b) => getStockGainPct(b) - getStockGainPct(a));
  const labels = sorted.map(s => s.ticker);
  const gains  = sorted.map(s => getStockGainPct(s));
  const colors = gains.map(g => g >= 0 ? 'rgba(0,230,118,0.75)' : 'rgba(255,23,68,0.75)');

  if (AppState.auditChart) { AppState.auditChart.destroy(); AppState.auditChart = null; }

  AppState.auditChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label:           '+/- vs PRU (%)',
        data:            gains,
        backgroundColor: colors,
        borderColor:     colors.map(c => c.replace('0.75', '1')),
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      indexAxis:           'y',
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2540',
          borderColor:     '#2a3a60',
          borderWidth:     1,
          callbacks: { label: ctx => `  ${fmt.pct(ctx.parsed.x)}` },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8899bb', font: { size: 11 }, callback: v => v + '%' },
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#e8f4fd', font: { size: 12, weight: '600' } },
        },
      },
    },
  });
}

// ============================================================
// TAB E — GÉRER (CRUD)
// ============================================================

function renderManageTab() {
  const tbody = document.getElementById('manage-table-body');
  if (!tbody) return;

  tbody.innerHTML = PORTFOLIO.map(stock => {
    const price = CURRENT_PRICES[stock.ticker];
    const value = getStockValue(stock);
    const gain  = getStockGain(stock);
    return `
      <tr class="manage-row" id="manage-row-${stock.id}">
        <td><span class="badge badge-${stock.account.toLowerCase()}">${stock.account}</span></td>
        <td class="mono"><strong>${stock.ticker}</strong></td>
        <td class="manage-editable" id="me-qty-${stock.id}">${stock.qty}</td>
        <td class="manage-editable" id="me-pru-${stock.id}">${fmt.num(stock.pru)}</td>
        <td class="mono">${fmt.num(price)} €</td>
        <td class="mono">${fmt.price(value)}</td>
        <td class="mono ${gainClass(gain)}">${gain >= 0 ? '+' : ''}${fmt.price(gain)}</td>
        <td class="manage-actions">
          <button class="btn-icon btn-edit" data-id="${stock.id}" title="Modifier">✏</button>
          <button class="btn-icon btn-delete" data-id="${stock.id}" title="Supprimer">🗑</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => startEditRow(parseInt(btn.dataset.id)));
  });
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteStock(parseInt(btn.dataset.id)));
  });
}

function startEditRow(id) {
  // Annuler toute édition en cours
  if (AppState.editingRow !== null) cancelEditRow(AppState.editingRow);

  const stock    = PORTFOLIO.find(s => s.id === id);
  if (!stock) return;
  AppState.editingRow = id;

  const qtyEl  = document.getElementById('me-qty-' + id);
  const pruEl  = document.getElementById('me-pru-' + id);
  const actEl  = document.querySelector(`#manage-row-${id} .manage-actions`);

  if (!qtyEl || !pruEl) return;

  qtyEl.innerHTML = `<input class="edit-input" id="edit-qty-${id}" type="number" min="0" step="1" value="${stock.qty}">`;
  pruEl.innerHTML = `<input class="edit-input" id="edit-pru-${id}" type="number" min="0" step="0.01" value="${stock.pru}">`;
  actEl.innerHTML = `
    <button class="btn-icon btn-save"   data-id="${id}" title="Enregistrer">✔</button>
    <button class="btn-icon btn-cancel" data-id="${id}" title="Annuler">✕</button>`;

  actEl.querySelector('.btn-save').addEventListener('click',   () => saveEditRow(id));
  actEl.querySelector('.btn-cancel').addEventListener('click', () => cancelEditRow(id));
}

function saveEditRow(id) {
  const stock = PORTFOLIO.find(s => s.id === id);
  if (!stock) return;

  const newQty = parseFloat(document.getElementById('edit-qty-' + id)?.value ?? stock.qty);
  const newPru = parseFloat(document.getElementById('edit-pru-' + id)?.value ?? stock.pru);

  if (!isNaN(newQty) && newQty >= 0) stock.qty = newQty;
  if (!isNaN(newPru) && newPru >= 0) stock.pru = newPru;

  AppState.editingRow = null;
  // Invalider le cache Monte Carlo
  AppState.mcData = null;
  saveCurrentPortfolio();
  renderManageTab();
  if (AppState.activeTab === 'portfolio') renderPortfolioTab();
  showToast('Ligne ' + stock.ticker + ' mise à jour.');
}

function cancelEditRow(id) {
  AppState.editingRow = null;
  renderManageTab();
}

function deleteStock(id) {
  const stock = PORTFOLIO.find(s => s.id === id);
  if (!stock) return;
  if (!confirm(`Supprimer définitivement la ligne ${stock.ticker} (${stock.name}) ?`)) return;
  PORTFOLIO = PORTFOLIO.filter(s => s.id !== id);
  AppState.mcData = null;
  saveCurrentPortfolio();
  renderManageTab();
  if (AppState.activeTab === 'portfolio') renderPortfolioTab();
  showToast('Ligne ' + stock.ticker + ' supprimée.');
}

function handleAddStockForm(e) {
  e.preventDefault();
  const f = e.target;
  const ticker  = f.ticker.value.trim().toUpperCase();
  const name    = f.sname.value.trim();
  const pru     = parseFloat(f.pru.value);
  const qty     = parseFloat(f.qty.value);
  const account = f.account.value;
  const sector  = f.sector.value.trim() || 'Technologie';

  if (!ticker || !name || isNaN(pru) || isNaN(qty)) {
    showToast('Veuillez remplir tous les champs obligatoires.', 'error');
    return;
  }
  if (PORTFOLIO.find(s => s.ticker === ticker)) {
    showToast('Ce ticker existe déjà dans le portefeuille.', 'error');
    return;
  }

  const newId    = Math.max(...PORTFOLIO.map(s => s.id)) + 1;
  const newStock = {
    id: newId, ticker, name, pru, qty, account, sector,
    country: account === 'PEA' ? 'FR' : 'US',
    currency: account === 'PEA' ? 'EUR' : 'USD',
    dividendYield: 0, volatility: 0.35, drift: 0.12,
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    description: '',
  };
  PORTFOLIO.push(newStock);
  CURRENT_PRICES[ticker] = pru;
  DAILY_OPENS[ticker]    = pru;
  PRICE_HISTORY[ticker]  = [{ time: Date.now(), price: pru }];

  AppState.mcData = null;
  saveCurrentPortfolio();
  f.reset();
  renderManageTab();
  showToast('Action ' + ticker + ' ajoutée avec succès !');
}

// ============================================================
// TAB F — LA PÉPITE x5 (VusionGroup)
// ============================================================

function renderGemTab() {
  const ctx = document.getElementById('gem-chart');
  if (!ctx) return;
  if (ctx._chartRendered) return;
  ctx._chartRendered = true;

  // Historique de revenus VusionGroup (2020-2026E, M€)
  const labels  = ['2020', '2021', '2022', '2023', '2024', '2025E', '2026E'];
  const revenue = [72, 89, 118, 195, 296, 440, 620];
  const ebitda  = [-8, -12, -4, 18, 42, 80, 145];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label:           'Chiffre d\'affaires (M€)',
          data:            revenue,
          backgroundColor: 'rgba(0,212,255,0.55)',
          borderColor:     '#00d4ff',
          borderWidth:     1,
          borderRadius:    4,
          order:           2,
        },
        {
          label:           'EBITDA ajusté (M€)',
          data:            ebitda,
          type:            'line',
          borderColor:     '#00e676',
          backgroundColor: 'rgba(0,230,118,0.1)',
          borderWidth:     2.5,
          fill:            false,
          pointRadius:     4,
          pointBackgroundColor: '#00e676',
          tension:         0.4,
          order:           1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display:  true,
          labels:   { color: '#8899bb', font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1a2540',
          borderColor:     '#2a3a60',
          borderWidth:     1,
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} M€` },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8899bb', font: { size: 11 } },
        },
        y: {
          position: 'right',
          grid:     { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8899bb', font: { size: 11 }, callback: v => v + ' M€' },
        },
      },
    },
  });
}

// ============================================================
// TICK HANDLER — Mise à jour temps réel
// ============================================================

function onTick({ changes, mode, isFirst }) {
  // Mise à jour indicateur de statut
  const dot   = document.getElementById('status-dot');
  const text  = document.getElementById('status-text');
  const clock = document.getElementById('status-clock');

  if (dot)  dot.className   = 'status-dot ' + (mode === 'live' ? 'live' : 'sim');
  if (text) text.textContent = mode === 'live' ? 'EN DIRECT' : 'SIMULATION';
  if (clock) {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Mise à jour header global
  const hVal  = document.getElementById('header-total');
  const hGain = document.getElementById('header-gain');
  if (hVal)  hVal.textContent  = fmt.price(getPortfolioValue());
  const gain = getPortfolioGain();
  if (hGain) {
    hGain.textContent = (gain >= 0 ? '+' : '') + fmt.price(gain);
    hGain.className   = 'header-gain ' + gainClass(gain);
  }

  if (isFirst) return;

  // Flash des prix + mise à jour table si onglet actif
  if (AppState.activeTab === 'portfolio') {
    Object.entries(changes).forEach(([ticker, delta]) => {
      flashPrice(ticker, delta >= 0 ? 'up' : 'down');
    });
    updateKPIs();

    // Mise à jour graphique en temps réel (1D seulement)
    if (AppState.chartTimeframe === '1D') initOrUpdatePortfolioChart();
  }
}

// ============================================================
// UTILITAIRES UI
// ============================================================

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

let _toastTimer = null;
function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = 'toast toast-' + type + ' show';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
// AUTHENTIFICATION — UI
// ============================================================

function showAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.add('open');
  // Masquer l'app principale tant qu'on n'est pas connecté
  document.getElementById('app-shell')?.style.setProperty('display', 'none');
}

function hideAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.remove('open');
  document.getElementById('app-shell')?.style.removeProperty('display');
}

function setUserDisplay(session) {
  const userEl     = document.getElementById('header-user');
  const nameEl     = document.getElementById('header-username');
  const avatarEl   = document.getElementById('user-avatar-initials');
  if (userEl)   userEl.style.display  = 'flex';
  if (nameEl)   nameEl.textContent    = session.username;
  if (avatarEl) avatarEl.textContent  = session.username.slice(0, 2).toUpperCase();
}

function initAuthForms() {
  // ── Bascule Login / Register ─────────────────────────────
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.authTab;
      document.getElementById('auth-login-form').style.display    = which === 'login'    ? 'flex' : 'none';
      document.getElementById('auth-register-form').style.display = which === 'register' ? 'flex' : 'none';
      // Vider les erreurs
      ['login-error','register-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.remove('visible'); }
      });
    });
  });

  // ── Formulaire Connexion ─────────────────────────────────
  document.getElementById('auth-login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f        = e.target;
    const errEl    = document.getElementById('login-error');
    const submitEl = document.getElementById('login-submit-btn');
    setAuthError('login-error', '');
    submitEl.disabled = true;
    submitEl.querySelector('.auth-submit-text').style.display  = 'none';
    submitEl.querySelector('.auth-submit-loader').style.display = 'inline';
    try {
      const session = await AuthManager.login(f.username.value, f.password.value);
      await startApp(session);
    } catch (err) {
      setAuthError('login-error', err.message);
    } finally {
      submitEl.disabled = false;
      submitEl.querySelector('.auth-submit-text').style.display  = 'inline';
      submitEl.querySelector('.auth-submit-loader').style.display = 'none';
    }
  });

  // ── Formulaire Inscription ───────────────────────────────
  document.getElementById('auth-register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f        = e.target;
    const submitEl = document.getElementById('register-submit-btn');
    setAuthError('register-error', '');
    submitEl.disabled = true;
    submitEl.querySelector('.auth-submit-text').style.display  = 'none';
    submitEl.querySelector('.auth-submit-loader').style.display = 'inline';
    try {
      const session = await AuthManager.register(
        f.username.value, f.email.value, f.password.value, f.confirm.value
      );
      await startApp(session);
    } catch (err) {
      setAuthError('register-error', err.message);
    } finally {
      submitEl.disabled = false;
      submitEl.querySelector('.auth-submit-text').style.display  = 'inline';
      submitEl.querySelector('.auth-submit-loader').style.display = 'none';
    }
  });
}

function setAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
}

// ── Démarrage de l'app après authentification ────────────────

async function startApp(session) {
  // Charger le portefeuille depuis l'API (ou cloner le défaut pour un nouvel utilisateur)
  const saved = await AuthManager.loadPortfolio(session.userId);
  if (saved && saved.length > 0) {
    PORTFOLIO = saved;
  } else {
    PORTFOLIO = JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));
    AuthManager.savePortfolio(session.userId, PORTFOLIO);
  }

  // S'assurer que les prix courants existent pour toutes les lignes
  PORTFOLIO.forEach(s => {
    if (!CURRENT_PRICES[s.ticker]) {
      CURRENT_PRICES[s.ticker] = s.pru;
      DAILY_OPENS[s.ticker]    = s.pru;
      PRICE_HISTORY[s.ticker]  = [{ time: Date.now(), price: s.pru }];
    }
  });

  setUserDisplay(session);
  hideAuthModal();
  init();
}

// ── Déconnexion ──────────────────────────────────────────────

function handleLogout() {
  if (!confirm('Se déconnecter du terminal ?')) return;
  PriceEngine.stop();
  AuthManager.logout();
  PORTFOLIO = [];
  // Réinitialiser l'état de l'app
  if (AppState.portfolioChart)  { AppState.portfolioChart.destroy();  AppState.portfolioChart  = null; }
  if (AppState.predictionChart) { AppState.predictionChart.destroy(); AppState.predictionChart = null; }
  if (AppState.auditChart)      { AppState.auditChart.destroy();      AppState.auditChart      = null; }
  if (AppState.allocationChart) { AppState.allocationChart.destroy(); AppState.allocationChart = null; }
  AppState.mcData        = null;
  AppState.selectedTicker = null;
  // Masquer infos utilisateur
  const userEl = document.getElementById('header-user');
  if (userEl) userEl.style.display = 'none';
  showToast('Déconnexion effectuée.', 'success');
  setTimeout(() => showAuthModal(), 400);
}

// ============================================================
// INITIALISATION
// ============================================================

function init() {
  // ── Onglets ──────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // ── Contrôles graphique (timeframes + value/gain) ────────
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.chartTimeframe = btn.dataset.tf;
      initOrUpdatePortfolioChart();
    });
  });

  document.querySelectorAll('.dsp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dsp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.chartDisplay = btn.dataset.display;
      initOrUpdatePortfolioChart();
    });
  });

  // ── Bouton Refresh Macro ─────────────────────────────────
  const macroRefreshBtn = document.getElementById('macro-refresh-btn');
  if (macroRefreshBtn) {
    macroRefreshBtn.addEventListener('click', () => {
      AppState.macroNewsIndex = (AppState.macroNewsIndex + 3) % MACRO_NEWS.length;
      renderMacroTab();
      macroRefreshBtn.classList.add('spinning');
      setTimeout(() => macroRefreshBtn.classList.remove('spinning'), 600);
    });
  }

  // ── Formulaire Ajout Stock ───────────────────────────────
  const addForm = document.getElementById('add-stock-form');
  if (addForm) addForm.addEventListener('submit', handleAddStockForm);

  // ── Bouton Déconnexion ───────────────────────────────────
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // ── Moteur de cotation ───────────────────────────────────
  PriceEngine.onTick(onTick);
  PriceEngine.start();

  // ── Affichage initial ────────────────────────────────────
  showTab('portfolio');

  // ── Heure courante dans le header ────────────────────────
  setInterval(() => {
    const clock = document.getElementById('status-clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
}

// ── Point d'entrée principal ─────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initAuthForms();
  const session = AuthManager.getSession();
  if (session) {
    await startApp(session);
  } else {
    showAuthModal();
  }
});
