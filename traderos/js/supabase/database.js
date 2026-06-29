/* ══════════════════════════════════════════════
   TRADEROS — Database Module
   js/supabase/database.js

   Primary store: localStorage (offline-first).
   Supabase synced in background when configured.
══════════════════════════════════════════════ */

window.DB = {

  /* ─── LOCAL STORAGE HELPERS ─── */
  _get(key) {
    try { return JSON.parse(localStorage.getItem(`traderos_${key}`)); } catch { return null; }
  },
  _set(key, val) {
    try { localStorage.setItem(`traderos_${key}`, JSON.stringify(val)); return true; } catch { return false; }
  },

  /* ─── TRADES ─── */
  getAllTrades() {
    return this._get('trades') || [];
  },

  saveTrade(trade) {
    const trades = this.getAllTrades();
    if (trade.id) {
      const idx = trades.findIndex(t => t.id === trade.id);
      if (idx !== -1) {
        trades[idx] = { ...trades[idx], ...trade, updated_at: new Date().toISOString() };
      } else {
        trade.updated_at = new Date().toISOString();
        trades.unshift(trade);
      }
    } else {
      trade.id         = 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      trade.created_at = new Date().toISOString();
      trade.updated_at = new Date().toISOString();
      trades.unshift(trade);
    }
    this._set('trades', trades);
    this._syncTrade(trade);
    return trade;
  },

  deleteTrade(id) {
    const trades = this.getAllTrades().filter(t => t.id !== id);
    this._set('trades', trades);
    this._deleteSyncTrade(id);
    return true;
  },

  getTradeById(id) {
    return this.getAllTrades().find(t => t.id === id) || null;
  },

  importTrades(rows) {
    const existing = this.getAllTrades();
    const existingKeys = new Set(existing.map(t => `${t.date}_${t.time}_${t.entry}`));
    const newOnes = rows.filter(r => !existingKeys.has(`${r.date}_${r.time}_${r.entry}`));
    newOnes.forEach(t => {
      t.id         = 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      t.created_at = new Date().toISOString();
      t.updated_at = new Date().toISOString();
      // Normalise numeric fields
      ['entry','exit','stoploss','target','quantity','capital_used',
       'broker_charges','net_profit','rr','confidence'].forEach(f => {
        if (t[f] !== undefined) t[f] = parseFloat(t[f]) || null;
      });
    });
    this._set('trades', [...newOnes, ...existing]);
    return { count: newOnes.length };
  },

  /* ─── STRATEGIES ─── */
  getStrategies() {
    const stored = this._get('strategies');
    if (stored && stored.length) return stored;
    // Defaults
    const defaults = [
      { id: 'strat_1', name: 'Gann Breakout',     description: 'Gann level breakout with volume', color: '#6C63FF' },
      { id: 'strat_2', name: 'Rejection Play',    description: 'Gann level wick rejection',       color: '#00D4AA' },
      { id: 'strat_3', name: 'Midpoint Bounce',   description: '5m midpoint bounce strategy',     color: '#FF4D6D' },
    ];
    this._set('strategies', defaults);
    return defaults;
  },

  saveStrategy(strategy) {
    const strats = this.getStrategies();
    const idx = strats.findIndex(s => s.id === strategy.id);
    if (idx !== -1) strats[idx] = { ...strats[idx], ...strategy };
    else strats.push(strategy);
    this._set('strategies', strats);
    return strategy;
  },

  /* ─── SETTINGS ─── */
  getSettings() {
    return this._get('settings') || {
      passcode:         'trader123',
      user_name:        'Trader',
      default_capital:  100000,
      startingCapital:  100000,
      currency:         '₹',
      risk_per_trade:   1,
      broker_charges:   0,
      remember_login:   true,
    };
  },

  saveSettings(patch) {
    const current = this.getSettings();
    const merged  = { ...current, ...patch };
    // Keep startingCapital in sync with default_capital
    if (patch.default_capital !== undefined) merged.startingCapital = patch.default_capital;
    if (patch.startingCapital !== undefined) merged.default_capital  = patch.startingCapital;
    this._set('settings', merged);
    return merged;
  },

  /* ─── NOTES ─── */
  getNotes() {
    return this._get('notes') || [];
  },

  saveNote(note) {
    const notes = this.getNotes();
    if (note.id) {
      const idx = notes.findIndex(n => n.id === note.id);
      if (idx !== -1) notes[idx] = { ...notes[idx], ...note, updated_at: new Date().toISOString() };
      else notes.unshift({ ...note, updated_at: new Date().toISOString() });
    } else {
      note.id         = 'note_' + Date.now();
      note.created_at = new Date().toISOString();
      note.updated_at = new Date().toISOString();
      notes.unshift(note);
    }
    this._set('notes', notes);
    return note;
  },

  deleteNote(id) {
    this._set('notes', this.getNotes().filter(n => n.id !== id));
  },

  /* ─── SCREENSHOTS ─── */
  getScreenshots() {
    return this._get('screenshots') || [];
  },

  saveScreenshot(ss) {
    const all = this.getScreenshots();
    ss.id         = 'ss_' + Date.now();
    ss.created_at = new Date().toISOString();
    all.unshift(ss);
    this._set('screenshots', all);
    return ss;
  },

  deleteScreenshot(id) {
    this._set('screenshots', this.getScreenshots().filter(s => s.id !== id));
  },

  /* ─── BACKUP / RESTORE ─── */
  exportAll() {
    return {
      version:     '2.0.0',
      exported_at: new Date().toISOString(),
      trades:      this.getAllTrades(),
      strategies:  this.getStrategies(),
      notes:       this.getNotes(),
      settings:    this.getSettings(),
      screenshots: this.getScreenshots(),
    };
  },

  importAll(data) {
    if (!data || !data.trades) throw new Error('Invalid backup file');
    if (data.trades)      this._set('trades',      data.trades);
    if (data.strategies)  this._set('strategies',  data.strategies);
    if (data.notes)       this._set('notes',        data.notes);
    if (data.settings)    this._set('settings',     data.settings);
    if (data.screenshots) this._set('screenshots',  data.screenshots);
    return { count: (data.trades || []).length };
  },

  clearTrades() {
    this._set('trades', []);
  },

  /* ─── SUPABASE BACKGROUND SYNC ─── */
  async _syncTrade(trade) {
    if (!window.SupabaseConfig?.isConnected()) return;
    try {
      const { error } = await window.SupabaseConfig.client
        .from('trades')
        .upsert({ id: trade.id, data: trade, created_at: trade.created_at, updated_at: trade.updated_at });
      if (error) console.warn('Supabase sync warning:', error.message);
    } catch (e) { console.warn('Supabase sync failed:', e); }
  },

  async _deleteSyncTrade(id) {
    if (!window.SupabaseConfig?.isConnected()) return;
    try {
      await window.SupabaseConfig.client.from('trades').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete sync failed:', e); }
  },

  async syncFromSupabase() {
    if (!window.SupabaseConfig?.isConnected()) return false;
    try {
      const { data, error } = await window.SupabaseConfig.client
        .from('trades').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      // Always replace local with cloud data (cloud is source of truth)
      const trades = (data || []).map(r => r.data || r);
      this._set('trades', trades);
      return true;
    } catch (e) { console.warn('Supabase pull failed:', e); return false; }
  },

  async testConnection() {
    if (!window.SupabaseConfig?.isConnected()) return false;
    try {
      const { error } = await window.SupabaseConfig.client.from('trades').select('id').limit(1);
      return !error;
    } catch { return false; }
  },
};
