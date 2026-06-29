/* ══════════════════════════════════════════════
   TRADEROS — Helpers Utility
   js/utils/helpers.js
══════════════════════════════════════════════ */

window.Helpers = {

  /** Format number as Indian currency */
  formatCurrency(val, showSign = false) {
    const n = parseFloat(val) || 0;
    const prefix = showSign && n > 0 ? '+' : '';
    const abs = Math.abs(n);
    let formatted;
    if (abs >= 10000000) formatted = (abs / 10000000).toFixed(2) + 'Cr';
    else if (abs >= 100000) formatted = (abs / 100000).toFixed(2) + 'L';
    else if (abs >= 1000) formatted = (abs / 1000).toFixed(1) + 'K';
    else formatted = abs.toFixed(2);
    return `${n < 0 ? '-' : prefix}₹${formatted}`;
  },

  /** Format raw number with sign */
  formatPnL(val) {
    const n = parseFloat(val) || 0;
    const formatted = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? '-' : '+'}₹${formatted}`;
  },

  /** Return CSS class for profit/loss */
  pnlClass(val) {
    const n = parseFloat(val) || 0;
    if (n > 0) return 'profit';
    if (n < 0) return 'loss';
    return 'neutral';
  },

  /** Format date nicely */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },

  /** Today as YYYY-MM-DD */
  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  /** Current time as HH:MM */
  nowTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  },

  /** Format percentage */
  formatPct(val, decimals = 1) {
    const n = parseFloat(val) || 0;
    return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
  },

  /** Format RR ratio */
  formatRR(val) {
    const n = parseFloat(val) || 0;
    return `${n.toFixed(2)}R`;
  },

  /** Detect market session from time string HH:MM */
  detectSession(timeStr) {
    if (!timeStr) return 'Opening';
    const [h, m] = timeStr.split(':').map(Number);
    const mins = h * 60 + m;
    if (mins < 11 * 60) return 'Opening';
    if (mins < 14 * 60) return 'Midday';
    return 'Closing';
  },

  /** Is Indian market open right now? */
  isMarketOpen() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;
    const h = now.getHours(), m = now.getMinutes();
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  },

  /** Get day name from date string */
  getDayName(dateStr) {
    if (!dateStr) return '';
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return days[new Date(dateStr).getDay()];
  },

  /** Get month name */
  getMonthName(monthNum) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[monthNum] || '';
  },

  /** Group array by a key */
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key] || 'Unknown';
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  },

  /** Calculate simple average */
  avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  },

  /** Truncate text */
  truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  },

  /** Debounce function */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /** Download text as file */
  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Read file as text */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  },

  /** Read file as Data URL */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  },

  /** Escape HTML to prevent XSS */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  },

  /** Format holding time nicely */
  formatHolding(str) {
    if (!str) return '—';
    return str;
  },

  /** Get date range */
  getDateRange(period) {
    const now = new Date();
    const end = new Date(now);
    let start;
    switch(period) {
      case 'today':
        start = new Date(now.setHours(0,0,0,0));
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(0);
    }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  },

  /** Filter trades by date range */
  filterByPeriod(trades, period) {
    const { start } = this.getDateRange(period);
    return trades.filter(t => t.date >= start);
  },
};
