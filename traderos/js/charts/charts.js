/* ══════════════════════════════════════════════
   TRADEROS — Charts Module
   js/charts/charts.js

   All Chart.js based charts used across the app.
   Exposed as window.TCharts — every method is
   idempotent: it destroys the old chart before
   drawing a new one on the same canvas.
══════════════════════════════════════════════ */

window.TCharts = (() => {

  /* ── Shared defaults ── */
  const COLORS = {
    primary:    '#6C63FF',
    secondary:  '#00D4AA',
    red:        '#FF4D6D',
    amber:      '#FFB703',
    blue:       '#00B4D8',
    grid:       'rgba(255,255,255,0.05)',
    tick:       'rgba(240,242,255,0.55)',
    tooltipBg:  'rgba(14,16,21,0.96)',
    tooltipBorder: 'rgba(255,255,255,0.08)',
  };

  /* Destroy existing Chart instance on a canvas before re-drawing */
  function canvas(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const existing = Chart.getChart(el);
    if (existing) existing.destroy();
    return el;
  }

  /* Shared base options factory */
  function baseOpts(overrides = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: COLORS.tooltipBg,
          borderColor: COLORS.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          titleColor: '#F0F2FF',
          bodyColor: 'rgba(240,242,255,0.7)',
          titleFont: { family: 'Poppins', weight: '600', size: 12 },
          bodyFont:  { family: 'Inter',   size: 12 },
        },
        ...((overrides.plugins) || {}),
      },
      scales: {
        x: {
          grid:   { color: COLORS.grid, drawBorder: false },
          ticks:  { color: COLORS.tick, font: { family: 'Inter', size: 11 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          grid:   { color: COLORS.grid, drawBorder: false },
          ticks:  { color: COLORS.tick, font: { family: 'Inter', size: 11 } },
          border: { display: false },
        },
        ...((overrides.scales) || {}),
      },
      ...Object.fromEntries(Object.entries(overrides).filter(([k]) => !['plugins','scales'].includes(k))),
    };
  }

  /* Format Indian currency for tooltips */
  function fmtINR(v, c = '₹') {
    const abs = Math.abs(v);
    let s;
    if (abs >= 1e7)      s = (abs / 1e7).toFixed(2) + 'Cr';
    else if (abs >= 1e5) s = (abs / 1e5).toFixed(2) + 'L';
    else if (abs >= 1e3) s = (abs / 1e3).toFixed(1) + 'K';
    else                 s = abs.toFixed(2);
    return `${v < 0 ? '-' : ''}${c}${s}`;
  }

  /* ── PUBLIC API ── */
  return {

    /* ─── 1. EQUITY CURVE ─── */
    equityCurve(id, data, c = '₹') {
      const el = canvas(id); if (!el) return;
      if (!data || !data.length) return;

      const labels = data.map((_, i) => `T${i + 1}`);
      const color  = data[data.length - 1] >= 0 ? COLORS.secondary : COLORS.red;

      new Chart(el, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data,
            borderColor: color,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
              g.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
              g.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
              return g;
            },
            tension: 0.4,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => ` ${fmtINR(ctx.parsed.y, c)}`,
              },
            },
          },
          scales: {
            x: { display: false },
            y: {
              grid:   { color: COLORS.grid },
              ticks:  { color: COLORS.tick, callback: v => fmtINR(v, c) },
              border: { display: false },
            },
          },
        }),
      });
    },

    /* ─── 2. WIN / LOSS DOUGHNUT ─── */
    winLossDoughnut(id, stats) {
      const el = canvas(id); if (!el) return;
      const wins   = stats.winningTrades || stats.win_count  || 0;
      const losses = stats.losingTrades  || stats.loss_count || 0;
      const open   = stats.openTrades    || stats.open_trades|| 0;

      if (!wins && !losses && !open) return;

      new Chart(el, {
        type: 'doughnut',
        data: {
          labels: ['Wins', 'Losses', 'Open'],
          datasets: [{
            data: [wins, losses, open],
            backgroundColor: [
              'rgba(0,212,170,0.85)',
              'rgba(255,77,109,0.85)',
              'rgba(108,99,255,0.6)',
            ],
            borderColor: 'rgba(255,255,255,0.05)',
            borderWidth: 2,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          animation: { duration: 600 },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: COLORS.tick,
                font: { family: 'Inter', size: 11 },
                padding: 14,
                usePointStyle: true,
                pointStyleWidth: 10,
              },
            },
            tooltip: {
              backgroundColor: COLORS.tooltipBg,
              borderColor: COLORS.tooltipBorder,
              borderWidth: 1,
              cornerRadius: 10,
              callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` },
            },
          },
        },
      });
    },

    /* ─── 3. STRATEGY COMPARISON (BAR) ─── */
    strategyComparison(id, byStrategy, c = '₹') {
      const el = canvas(id); if (!el) return;
      const strats  = window.DB ? window.DB.getStrategies() : [];
      const entries = Object.entries(byStrategy);
      if (!entries.length) return;

      const labels = entries.map(([k]) => strats.find(s => s.id === k)?.name || k);
      const data   = entries.map(([, v]) => parseFloat(v.total_pnl.toFixed(2)));
      const colors = data.map(v => v >= 0 ? 'rgba(0,212,170,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 8, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${fmtINR(ctx.parsed.y, c)}` } },
          },
        }),
      });
    },

    /* ─── 4. DAILY P&L BAR ─── */
    dailyPnL(id, trades, c = '₹') {
      const el = canvas(id); if (!el) return;
      const closed = trades.filter(t => t.net_profit != null && t.date);

      /* Group by date */
      const byDate = {};
      for (const t of closed) {
        byDate[t.date] = (byDate[t.date] || 0) + (parseFloat(t.net_profit) || 0);
      }

      const sorted = Object.keys(byDate).sort();
      const last14 = sorted.slice(-14);
      const labels = last14.map(d => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      });
      const data   = last14.map(d => parseFloat(byDate[d].toFixed(2)));
      const colors = data.map(v => v >= 0 ? 'rgba(0,212,170,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${fmtINR(ctx.parsed.y, c)}` } },
          },
        }),
      });
    },

    /* ─── 5. MONTHLY P&L ─── */
    monthlyPnL(id, byMonth, c = '₹') {
      const el = canvas(id); if (!el) return;
      const sorted = Object.keys(byMonth).sort();
      if (!sorted.length) return;

      const labels = sorted.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, parseInt(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      });
      const data   = sorted.map(m => parseFloat((byMonth[m].total_pnl || 0).toFixed(2)));
      const colors = data.map(v => v >= 0 ? 'rgba(0,212,170,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${fmtINR(ctx.parsed.y, c)}` } },
          },
        }),
      });
    },

    /* ─── 6. HOURLY PERFORMANCE ─── */
    hourPerformance(id, byHour, c = '₹') {
      const el = canvas(id); if (!el) return;
      const sorted = Object.keys(byHour).sort();
      if (!sorted.length) return;

      const labels = sorted;
      const data   = sorted.map(h => parseFloat((byHour[h].total_pnl || 0).toFixed(2)));
      const colors = data.map(v => v >= 0 ? 'rgba(0,180,216,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${fmtINR(ctx.parsed.y, c)}` } },
          },
        }),
      });
    },

    /* ─── 7. INDEX PIE ─── */
    indexPie(id, byIndex) {
      const el = canvas(id); if (!el) return;
      const entries = Object.entries(byIndex);
      if (!entries.length) return;

      const palette = [COLORS.primary, COLORS.secondary, COLORS.amber, COLORS.blue, COLORS.red];

      new Chart(el, {
        type: 'pie',
        data: {
          labels: entries.map(([k]) => k),
          datasets: [{
            data: entries.map(([, v]) => v.trades),
            backgroundColor: entries.map((_, i) => palette[i % palette.length]),
            borderColor: 'rgba(255,255,255,0.06)',
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500 },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: COLORS.tick,
                font: { family: 'Inter', size: 11 },
                padding: 12,
                usePointStyle: true,
              },
            },
            tooltip: {
              backgroundColor: COLORS.tooltipBg,
              borderColor: COLORS.tooltipBorder,
              borderWidth: 1,
              cornerRadius: 10,
              callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} trades` },
            },
          },
        },
      });
    },

    /* ─── 8. DRAWDOWN CURVE ─── */
    drawdownCurve(id, trades) {
      const el = canvas(id); if (!el) return;
      const closed = trades
        .filter(t => t.net_profit != null)
        .sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);

      if (!closed.length) return;

      let peak = 0, running = 0;
      const ddSeries = closed.map(t => {
        running += parseFloat(t.net_profit) || 0;
        if (running > peak) peak = running;
        return parseFloat(-(peak - running).toFixed(2));
      });

      new Chart(el, {
        type: 'line',
        data: {
          labels: closed.map((_, i) => `T${i + 1}`),
          datasets: [{
            data: ddSeries,
            borderColor: COLORS.red,
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            backgroundColor: 'rgba(255,77,109,0.12)',
            tension: 0.3,
          }],
        },
        options: baseOpts({
          scales: {
            x: { display: false },
            y: {
              grid:   { color: COLORS.grid },
              ticks:  { color: COLORS.tick, callback: v => fmtINR(v) },
              border: { display: false },
            },
          },
          plugins: {
            tooltip: { callbacks: { label: ctx => ` DD: ${fmtINR(ctx.parsed.y)}` } },
          },
        }),
      });
    },

    /* ─── 9. PSYCHOLOGY / EMOTION CHART ─── */
    psychologyChart(id, trades) {
      const el = canvas(id); if (!el) return;
      const closed = trades.filter(t => t.emotion_before && t.net_profit != null);
      if (!closed.length) return;

      const groups = {};
      for (const t of closed) {
        const em = t.emotion_before;
        if (!groups[em]) groups[em] = { total: 0, count: 0 };
        groups[em].total += parseFloat(t.net_profit) || 0;
        groups[em].count++;
      }

      const entries = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
      const labels  = entries.map(([k]) => k);
      const data    = entries.map(([, v]) => parseFloat((v.total / v.count).toFixed(2)));
      const colors  = data.map(v => v >= 0 ? 'rgba(0,212,170,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 6, borderSkipped: false,
            label: 'Avg P&L',
          }],
        },
        options: baseOpts({
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` Avg P&L: ${fmtINR(ctx.parsed.y)}` } },
          },
        }),
      });
    },

    /* ─── 10. SESSION PERFORMANCE ─── */
    sessionChart(id, bySession, c = '₹') {
      const el = canvas(id); if (!el) return;
      const sessions = ['Opening', 'Midday', 'Closing'];
      const data     = sessions.map(s => parseFloat(((bySession[s]?.total_pnl) || 0).toFixed(2)));
      const colors   = data.map(v => v >= 0 ? 'rgba(0,212,170,0.8)' : 'rgba(255,77,109,0.8)');

      new Chart(el, {
        type: 'bar',
        data: {
          labels: sessions,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 8, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${fmtINR(ctx.parsed.y, c)}` } },
          },
        }),
      });
    },

    /* ─── 11. P&L DISTRIBUTION HISTOGRAM ─── */
    pnlDistribution(id, trades, c = '₹') {
      const el = canvas(id); if (!el) return;
      const { labels, data, colors } = Analytics.getPnLDistribution(trades);
      if (!labels.length) return;

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data, backgroundColor: colors,
            borderRadius: 4, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} trades` } },
          },
        }),
      });
    },

    /* ─── 12. RR DISTRIBUTION ─── */
    rrDistribution(id, trades) {
      const el = canvas(id); if (!el) return;
      const buckets = { '<0.5R': 0, '0.5–1R': 0, '1–1.5R': 0, '1.5–2R': 0, '>2R': 0 };
      for (const t of trades) {
        const rr = parseFloat(t.rr) || 0;
        if (rr < 0.5)      buckets['<0.5R']++;
        else if (rr < 1)   buckets['0.5–1R']++;
        else if (rr < 1.5) buckets['1–1.5R']++;
        else if (rr < 2)   buckets['1.5–2R']++;
        else               buckets['>2R']++;
      }

      const labels = Object.keys(buckets);
      const data   = Object.values(buckets);

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: 'rgba(108,99,255,0.75)',
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} trades` } },
          },
        }),
      });
    },

    /* ─── 13. HOLDING TIME DISTRIBUTION ─── */
    holdingDistribution(id, trades) {
      const el = canvas(id); if (!el) return;
      const buckets = { '<5m': 0, '5–15m': 0, '15–30m': 0, '30–60m': 0, '>60m': 0 };
      for (const t of trades) {
        const m = parseInt(t.holding_time_min) || 0;
        if (m < 5)        buckets['<5m']++;
        else if (m < 15)  buckets['5–15m']++;
        else if (m < 30)  buckets['15–30m']++;
        else if (m < 60)  buckets['30–60m']++;
        else              buckets['>60m']++;
      }

      const labels = Object.keys(buckets);
      const data   = Object.values(buckets);

      new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: 'rgba(0,180,216,0.75)',
            borderRadius: 6, borderSkipped: false,
          }],
        },
        options: baseOpts({
          plugins: {
            tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} trades` } },
          },
        }),
      });
    },

    /* ─── 14. CALENDAR HEATMAP ─── */
    calendarHeatmap(containerId, trades) {
      const container = document.getElementById(containerId);
      if (!container) return;

      /* Build date → P&L map */
      const dateMap = {};
      for (const t of trades) {
        if (!t.date || t.net_profit == null) continue;
        dateMap[t.date] = (dateMap[t.date] || 0) + (parseFloat(t.net_profit) || 0);
      }

      /* Determine month to show (current) */
      const now   = new Date();
      let year    = now.getFullYear();
      let month   = now.getMonth(); // 0-indexed

      function render(y, m) {
        const monthName = new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const firstDay  = new Date(y, m, 1).getDay(); // 0=Sun
        const daysInMo  = new Date(y, m + 1, 0).getDate();
        const todayStr  = new Date().toISOString().split('T')[0];

        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let html = `
          <div class="calendar-nav">
            <button class="btn-icon" id="cal-prev"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
            <h3>${monthName}</h3>
            <button class="btn-icon" id="cal-next"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
          <div class="calendar-grid">
            ${dayLabels.map(d => `<div class="calendar-day-label">${d}</div>`).join('')}
        `;

        /* Leading blanks */
        for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day other-month"></div>`;

        /* Days */
        for (let d = 1; d <= daysInMo; d++) {
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const pnl     = dateMap[dateStr];
          const isToday = dateStr === todayStr;
          const cls = [
            'calendar-day',
            isToday ? 'today' : '',
            pnl != null ? (pnl >= 0 ? 'profitable' : 'losing') : '',
          ].filter(Boolean).join(' ');

          const pnlLabel = pnl != null
            ? `<div class="cal-pnl">${pnl >= 0 ? '+' : ''}${Math.round(pnl / 100) / 10}K</div>`
            : '';

          html += `<div class="${cls}" title="${dateStr}${pnl != null ? ': ₹' + pnl.toFixed(0) : ''}">
            <div class="cal-date">${d}</div>
            ${pnlLabel}
          </div>`;
        }

        html += '</div>';

        /* Monthly summary */
        const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
        const monthTrades = trades.filter(t => t.date?.startsWith(monthKey));
        const monthPnL    = monthTrades.reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);
        const monthWins   = monthTrades.filter(t => parseFloat(t.net_profit) > 0).length;

        html += `
          <div style="margin-top:20px;display:flex;gap:16px;flex-wrap:wrap;">
            <div class="glass-card" style="padding:14px 20px;flex:1;min-width:140px;">
              <div class="kpi-label">Month P&L</div>
              <div class="kpi-number ${monthPnL >= 0 ? 'positive' : 'negative'}">${monthPnL >= 0 ? '+' : ''}₹${Math.abs(monthPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div class="glass-card" style="padding:14px 20px;flex:1;min-width:140px;">
              <div class="kpi-label">Month Trades</div>
              <div class="kpi-number">${monthTrades.length}</div>
            </div>
            <div class="glass-card" style="padding:14px 20px;flex:1;min-width:140px;">
              <div class="kpi-label">Win Rate</div>
              <div class="kpi-number positive">${monthTrades.length ? (monthWins / monthTrades.length * 100).toFixed(0) : 0}%</div>
            </div>
          </div>
        `;

        container.innerHTML = html;

        /* Nav button listeners */
        document.getElementById('cal-prev')?.addEventListener('click', () => {
          m--; if (m < 0) { m = 11; y--; } render(y, m);
        });
        document.getElementById('cal-next')?.addEventListener('click', () => {
          m++; if (m > 11) { m = 0; y++; } render(y, m);
        });
      }

      render(year, month);
    },

    /* ─── 15. SCREENSHOTS grid renderer (delegates to ScreenshotsManager) ─── */
    renderScreenshots(containerId) {
      const container = document.getElementById(containerId);
      if (!container || !window.ScreenshotsManager) return;
      container.innerHTML = ScreenshotsManager.renderGrid();
    },

  }; // end return
})();
