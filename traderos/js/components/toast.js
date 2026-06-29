/* ══════════════════════════════════════════════
   TRADEROS — Utils, Icons & Toast
══════════════════════════════════════════════ */

window.Utils = {

  $(sel)  { return document.querySelector(sel); },
  $$(sel) { return Array.from(document.querySelectorAll(sel)); },

  formatCurrency(val, currency = '₹') {
    const n = parseFloat(val) || 0;
    const sign = n < 0 ? '-' : '';
    const abs  = Math.abs(n);
    let str;
    if (abs >= 1e7)      str = (abs / 1e7).toFixed(2) + 'Cr';
    else if (abs >= 1e5) str = (abs / 1e5).toFixed(2) + 'L';
    else if (abs >= 1e3) str = (abs / 1e3).toFixed(1) + 'K';
    else                 str = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${currency}${str}`;
  },

  formatPct(val, decimals = 1) {
    const n = parseFloat(val) || 0;
    return `${n.toFixed(decimals)}%`;
  },

  formatDuration(mins) {
    const m = parseInt(mins) || 0;
    if (!m) return '—';
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${m}m`;
  },

  formatDate(dateStr, style = 'full') {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    if (style === 'short')    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (style === 'relative') {
      const diff = Date.now() - d.getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7)  return `${days} days ago`;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  colorClass(val) {
    const n = parseFloat(val) || 0;
    if (n > 0) return 'positive';
    if (n < 0) return 'negative';
    return '';
  },

  todayStr() { return new Date().toISOString().split('T')[0]; },

  exportToCSV(trades, filename = 'traderos_trades.csv') {
    if (!trades || !trades.length) { this.toast('No trades to export', 'warning'); return; }
    const headers = ['date','time','index','direction','strategy_id','entry','exit','stoploss','target',
      'quantity','capital_used','broker_charges','net_profit','rr','holding_time',
      'emotion_before','emotion_after','confidence','mistake','lesson','notes','tags',
      'entry_reason','exit_reason','market_structure','session'];
    const rows = trades.map(t => headers.map(h => {
      const v = Array.isArray(t[h]) ? t[h].join('|') : (t[h] !== undefined && t[h] !== null ? t[h] : '');
      return `"${String(v).replace(/"/g,'""')}"`;
    }).join(','));
    this._download([headers.join(','), ...rows].join('\n'), filename, 'text/csv');
  },

  exportToJSON(data, filename = 'traderos_backup.json') {
    this._download(JSON.stringify(data, null, 2), filename, 'application/json');
  },

  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  parseCSV(text) {
    const lines   = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
    return lines.slice(1).map(line => {
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  },

  toast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 280);
    }, duration);
  },
};

/* ── Icons helper ── */
window.Icons = {
  get(name) {
    const map = {
      'trending-up':    'M22 7l-8.5 8.5-5-5L1 17',
      'trending-down':  'M22 17l-8.5-8.5-5 5L1 7',
      'calendar':       'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',
      'bar-chart-2':    'M18 20V10 M12 20V4 M6 20v-6',
      'target':         'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
      'activity':       'M22 12h-4l-3 9L9 3l-3 9H2',
      'dollar-sign':    'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      'zap':            'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      'git-merge':      'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v3a6 6 0 0 0 6 6h3',
      'award':          'M8.21 13.89L7 23l5-3 5 3-1.21-9.11 M12 15A7 7 0 1 0 12 1a7 7 0 0 0 0 14z',
      'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
      'clock':          'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2',
      'star':           'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      'check-circle':   'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
      'x-circle':       'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z M15 9l-6 6 M9 9l6 6',
      'brain':          'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z',
      'inbox':          'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
      'edit-2':         'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
      'trash-2':        'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M10 11v6 M14 11v6',
      'book-open':      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
    };
    const d = map[name] || 'M12 12h.01';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${
      d.split(' M').map((seg, i) => i === 0 ? `<path d="${seg}"/>` : `<path d="M${seg}"/>`).join('')
    }</svg>`;
  },
};
