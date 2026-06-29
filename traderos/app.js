/**
 * TRADER OS — Main Application Controller
 * Complete production version with all features wired up.
 */

/* ── Patch Analytics: add missing fields ── */
(function patchAnalytics() {
  if (!window.Analytics) return;
  const _orig = Analytics.compute.bind(Analytics);
  Analytics.compute = function(trades) {
    const base = _orig(trades);
    if (!trades || !trades.length) return { ...base, ..._emptyExt() };
    const closed = trades.filter(t => t.exit && parseFloat(t.exit) > 0);
    function groupStats(arr, keyFn) {
      const g = {};
      for (const t of arr) {
        const k = keyFn(t) || 'Unknown';
        if (!g[k]) g[k] = { trades:0, wins:0, losses:0, total_pnl:0, win_rate:0 };
        const pnl = parseFloat(t.net_profit)||0;
        g[k].trades++; g[k].total_pnl += pnl;
        if (pnl>0) g[k].wins++; else if (pnl<0) g[k].losses++;
      }
      for (const k in g) g[k].win_rate = g[k].trades ? g[k].wins/g[k].trades*100 : 0;
      return g;
    }
    const by_strategy  = groupStats(closed, t => t.strategy_id);
    const by_index     = groupStats(closed, t => t.index);
    const by_direction = groupStats(closed, t => t.direction);
    const by_day       = groupStats(closed, t => { const d=new Date(t.date); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; });
    const by_hour      = groupStats(closed, t => t.time ? t.time.substring(0,2)+':00' : null);
    const by_month     = groupStats(closed, t => t.date ? t.date.substring(0,7) : null);
    const by_session   = groupStats(closed, t => t.session);
    const sorted = [...closed].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let running=0;
    const equity_curve = sorted.map(t => { running+=parseFloat(t.net_profit)||0; return parseFloat(running.toFixed(2)); });
    const settings = window.DB ? window.DB.getSettings() : {};
    const sc = parseFloat(settings.startingCapital)||100000;
    const capital_curve = equity_curve.map(v=>parseFloat((sc+v).toFixed(2)));
    const rets = sorted.map(t=>parseFloat(t.net_profit)||0);
    const mean = rets.reduce((a,b)=>a+b,0)/(rets.length||1);
    const variance = rets.reduce((a,b)=>a+Math.pow(b-mean,2),0)/(rets.length||1);
    const sharpe = variance > 0 ? mean/Math.sqrt(variance) : 0;
    return {
      ...base,
      win_rate: base.winRate, loss_rate: base.lossRate,
      win_count: base.winningTrades, loss_count: base.losingTrades,
      open_trades: base.openTrades, total_trades: base.totalTrades,
      total_pnl: base.totalPnL, today_pnl: base.todayPnL,
      weekly_pnl: base.weeklyPnL, monthly_pnl: base.monthlyPnL,
      avg_rr: base.avgRR, avg_holding_time: base.avgHolding,
      largest_win: base.largestWin, largest_loss: base.largestLoss,
      win_streak: base.winStreak, loss_streak: base.lossStreak,
      profit_factor: base.profitFactor, max_drawdown: base.maxDrawdown,
      psychology_score: Math.round((base.psychScore||0)*10),
      best_strategy: base.bestStrategy, best_day: base.bestDay,
      by_strategy, by_index, by_direction, by_day, by_hour, by_month, by_session,
      equity_curve, capital_curve, sharpe,
    };
  };
  function _emptyExt() {
    return { win_rate:0, loss_rate:0, win_count:0, loss_count:0, open_trades:0,
      total_trades:0, total_pnl:0, today_pnl:0, weekly_pnl:0, monthly_pnl:0,
      avg_rr:0, avg_holding_time:'—', largest_win:0, largest_loss:0,
      win_streak:0, loss_streak:0, profit_factor:0, max_drawdown:0,
      psychology_score:0, best_strategy:'—', best_day:'—', sharpe:0,
      by_strategy:{}, by_index:{}, by_direction:{}, by_day:{}, by_hour:{}, by_month:{}, by_session:{},
      equity_curve:[], capital_curve:[] };
  }

  Analytics.generateInsights = function(trades, stats) {
    if (!trades || trades.length < 3) return [{
      icon:'📊', type:'Getting Started', sentiment:'neutral',
      title:'Log More Trades',
      text:'You need at least 3 trades to start seeing pattern-based insights. Keep logging your trades!'
    }];
    const insights = [], s = stats;
    if ((s.win_rate||0) > 60) insights.push({ icon:'🎯', type:'Win Rate', sentiment:'positive', title:`Strong ${(s.win_rate||0).toFixed(1)}% Win Rate`, text:`Your win rate is excellent. Keep applying your best setups consistently.` });
    else if ((s.win_rate||0) < 40) insights.push({ icon:'⚠️', type:'Win Rate', sentiment:'negative', title:`Win Rate at ${(s.win_rate||0).toFixed(1)}%`, text:`Your win rate is below 40%. Focus on higher-probability setups and reduce impulsive entries.` });
    if ((s.profit_factor||0) > 1.5) insights.push({ icon:'💰', type:'Profit Factor', sentiment:'positive', title:`Profit Factor: ${isFinite(s.profit_factor)?(s.profit_factor||0).toFixed(2):'∞'}`, text:`A profit factor above 1.5 means your strategy earns more than it loses. Excellent risk management!` });
    else if ((s.profit_factor||0) > 0 && (s.profit_factor||0) < 1) insights.push({ icon:'📉', type:'Risk Management', sentiment:'negative', title:`Profit Factor Below 1.0`, text:`Your losses currently outpace your wins. Review your stop-loss discipline and exit strategy.` });
    if ((s.win_streak||0) >= 3) insights.push({ icon:'🔥', type:'Hot Streak', sentiment:'positive', title:`${s.win_streak}-Trade Win Streak!`, text:`You're on fire! Stay focused and don't get overconfident.` });
    if ((s.loss_streak||0) >= 3) insights.push({ icon:'🧊', type:'Loss Streak', sentiment:'negative', title:`${s.loss_streak} Consecutive Losses`, text:`Take a break and review your last trades carefully. Consider reducing size until clarity returns.` });
    if (s.by_strategy) {
      const bestS = Object.entries(s.by_strategy).sort((a,b)=>b[1].total_pnl-a[1].total_pnl)[0];
      if (bestS) {
        const strats = window.DB ? window.DB.getStrategies() : [];
        const name = strats.find(st=>st.id===bestS[0])?.name || bestS[0];
        insights.push({ icon:'⭐', type:'Best Strategy', sentiment:'positive', title:`"${name}" is Your Best Strategy`, text:`This strategy generates the most profit. Consider allocating more trades to it.` });
      }
    }
    if (s.by_hour) {
      const bestH = Object.entries(s.by_hour).sort((a,b)=>b[1].total_pnl-a[1].total_pnl)[0];
      if (bestH && bestH[1].total_pnl > 0) insights.push({ icon:'⏰', type:'Best Time', sentiment:'positive', title:`Peak Performance at ${bestH[0]}`, text:`You make the most profit around ${bestH[0]}. Schedule your best setups in this window.` });
    }
    if ((s.avg_rr||0) < 1 && (s.total_trades||0) > 5) insights.push({ icon:'📐', type:'R:R Ratio', sentiment:'warning', title:`Average RR is ${(s.avg_rr||0).toFixed(2)}R`, text:`Your average Risk:Reward is below 1R. Look for trades with at least 1.5R to improve profitability.` });
    if ((s.psychology_score||0) > 0 && (s.psychology_score||0) < 50) insights.push({ icon:'🧠', type:'Psychology', sentiment:'warning', title:`Psychology Score: ${s.psychology_score}/100`, text:`Your emotional state may be affecting trades. Review entries taken with anxious or FOMO emotions.` });
    return insights.slice(0, 8);
  };
})();

/* ─── App State ─── */
const AppState = {
  currentPage: 'dashboard', trades: [], stats: null, settings: {}, strategies: [],
  isLoggedIn: false, tradeFilter: { search:'', index:'', direction:'', result:'' },
  tradePage: 1, tradePerPage: 20, tradeSortCol: 'date', tradeSortDir: 'desc',
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });

const App = {
  init() {
    this.loadState(); Login.init();
    const session = sessionStorage.getItem('traderos_session') || localStorage.getItem('traderos_session');
    if (session === 'authenticated') this.onLogin();
  },
  loadState() {
    AppState.settings = DB.getSettings(); AppState.strategies = DB.getStrategies();
    AppState.trades = DB.getAllTrades(); AppState.stats = Analytics.compute(AppState.trades);
  },
  onLogin() {
    AppState.isLoggedIn = true;
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').classList.remove('hidden');
    this.loadState(); Shell.init(); Router.navigate('dashboard');
  },
  onLogout() {
    sessionStorage.removeItem('traderos_session'); localStorage.removeItem('traderos_session');
    AppState.isLoggedIn = false;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.add('active');
    Utils.toast('Logged out successfully', 'info');
  },
  refresh() {
    this.loadState();
    const p = AppState.currentPage;
    if (p==='dashboard')    Pages.renderDashboard();
    if (p==='history')      Pages.renderHistory();
    if (p==='analytics')    Pages.renderAnalytics();
    if (p==='charts')       Pages.renderCharts();
    if (p==='ai-insights')  Pages.renderInsights();
    if (p==='psychology')   Pages.renderPsychology();
    if (p==='calendar')     Pages.renderCalendar();
    Shell._updateCapital();
  },
};

const Login = {
  init() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app').classList.add('hidden');
    const input = document.getElementById('passcode-input');
    const toggle = document.getElementById('toggle-pass');
    toggle?.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      const eyeEl = document.getElementById('eye-icon');
      if (eyeEl) eyeEl.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
      if (window.lucide) lucide.createIcons();
    });
    input?.addEventListener('keydown', e => { if (e.key==='Enter') this.attempt(); });
    document.getElementById('unlock-btn')?.addEventListener('click', () => this.attempt());
  },
  attempt() {
    const input = document.getElementById('passcode-input');
    const errorEl = document.getElementById('login-error');
    const settings = DB.getSettings();
    if (input.value === (settings.passcode||'trader123')) {
      const remember = document.getElementById('remember-me')?.checked !== false;
      if (remember) localStorage.setItem('traderos_session', 'authenticated');
      sessionStorage.setItem('traderos_session', 'authenticated');
      App.onLogin();
    } else {
      errorEl.classList.remove('hidden');
      errorEl.textContent = '✕ Incorrect passcode. Try again.';
      input.value = ''; input.focus();
    }
  },
};

const Shell = {
  init() {
    this._setDate(); this._bindNav(); this._bindTopbar(); this._bindSettings();
    this._updateMarketStatus(); this._updateCapital(); this._loadSettingsValues();
    setInterval(() => this._updateMarketStatus(), 60000);
    if (window.lucide) lucide.createIcons();
  },
  _setDate() {
    const el = document.getElementById('page-date');
    if (el) el.textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  },
  _bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        if (item.dataset.page==='add-trade') { TradeModal.open(); return; }
        Router.navigate(item.dataset.page);
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('open');
      });
    });
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('collapsed'));
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('open');
    });
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => App.onLogout());
    document.getElementById('add-trade-btn')?.addEventListener('click', () => TradeModal.open());
  },
  _bindTopbar() {
    document.getElementById('ai-refresh-btn')?.addEventListener('click', () => Pages._updateAIBanner());
    document.getElementById('generate-insights-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('generate-insights-btn');
      if (btn) { btn.textContent = '⏳ Generating…'; btn.disabled = true; }
      await Pages._fetchAndRenderInsights(true);
      if (btn) { btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Generate Insights'; btn.disabled = false; }
    });
  },
  _updateMarketStatus() {
    const dot = document.getElementById('market-dot'), text = document.getElementById('market-status-text');
    const open = Helpers.isMarketOpen();
    if (dot) dot.classList.toggle('open', open);
    if (text) text.textContent = open ? 'Market Open' : 'Market Closed';
  },
  _updateCapital() {
    const el = document.getElementById('sidebar-capital');
    if (el) el.textContent = Utils.formatCurrency(AppState.stats?.currentCapital || AppState.stats?.capital_curve?.slice(-1)[0] || AppState.settings.startingCapital || 100000);
  },
  _loadSettingsValues() {
    const s = AppState.settings, strats = AppState.strategies;
    const setV = (id, val) => { const el = document.getElementById(id); if (el&&val!=null) el.value = val; };
    setV('starting-capital', s.startingCapital||s.default_capital||100000);
    setV('max-risk', s.maxRisk||s.risk_per_trade||1);
    setV('daily-loss-limit', s.dailyLossLimit||5000);
    setV('strat-1-name', strats[0]?.name||'Gann Breakout');
    setV('strat-2-name', strats[1]?.name||'Rejection Play');
    setV('strat-3-name', strats[2]?.name||'Midpoint Bounce');
    setV('supabase-url', localStorage.getItem('traderos_supabase_url')||'');
    setV('supabase-key', localStorage.getItem('traderos_supabase_key')||'');
    // Auto-show Supabase connection status when settings page opens
    const statusEl = document.getElementById('supabase-status');
    if (statusEl) {
      const savedUrl = localStorage.getItem('traderos_supabase_url');
      const savedKey = localStorage.getItem('traderos_supabase_key');
      if (savedUrl && savedKey && SupabaseConfig.isConnected()) {
        statusEl.textContent = '✓ Connected to Supabase';
        statusEl.className = 'supabase-status connected';
      } else if (savedUrl && savedKey) {
        // Credentials saved but client not init — re-init now
        SupabaseConfig.init(savedUrl, savedKey);
        statusEl.textContent = '✓ Credentials loaded — click Connect to verify';
        statusEl.className = 'supabase-status connected';
      } else {
        statusEl.textContent = '';
        statusEl.className = 'supabase-status';
      }
    }
  },
  _bindSettings() {
    document.getElementById('change-pass-btn')?.addEventListener('click', () => SettingsCtrl.changePasscode());
    document.getElementById('save-strategies-btn')?.addEventListener('click', () => SettingsCtrl.saveStrategies());
    document.getElementById('save-capital-btn')?.addEventListener('click', () => SettingsCtrl.saveCapital());
    document.getElementById('backup-btn')?.addEventListener('click', () => SettingsCtrl.exportDB());
    document.getElementById('restore-btn')?.addEventListener('click', () => document.getElementById('restore-file')?.click());
    document.getElementById('restore-file')?.addEventListener('change', e => SettingsCtrl.importDB(e.target.files[0]));
    document.getElementById('clear-data-btn')?.addEventListener('click', () => SettingsCtrl.clearData());
    document.getElementById('save-supabase-btn')?.addEventListener('click', () => SettingsCtrl.saveSupabase());
    document.getElementById('sync-from-supabase-btn')?.addEventListener('click', () => SettingsCtrl.syncFromCloud());
    document.getElementById('push-to-supabase-btn')?.addEventListener('click', () => SettingsCtrl.pushToCloud());
    document.getElementById('export-csv-btn')?.addEventListener('click', () => HistoryCtrl.exportCSV());
    document.getElementById('import-csv-btn')?.addEventListener('click', () => document.getElementById('import-file')?.click());
    document.getElementById('import-file')?.addEventListener('change', e => HistoryCtrl.importCSV(e.target.files[0]));
    document.getElementById('screenshot-upload')?.addEventListener('change', e => Screenshots.upload(e.target));
    document.getElementById('new-note-btn')?.addEventListener('click', () => NotesCtrl.openNew());
    document.getElementById('save-note-btn')?.addEventListener('click', () => NotesCtrl.save());
    document.querySelectorAll('[data-note-type]').forEach(btn => btn.addEventListener('click', () => NotesCtrl.setType(btn.dataset.noteType)));
    document.getElementById('history-search')?.addEventListener('input', Helpers.debounce(() => HistoryCtrl.filter(), 250));
    document.getElementById('filter-index')?.addEventListener('change', () => HistoryCtrl.filter());
    document.getElementById('filter-direction')?.addEventListener('change', () => HistoryCtrl.filter());
    document.getElementById('filter-result')?.addEventListener('change', () => HistoryCtrl.filter());
    document.querySelectorAll('[data-cmd]').forEach(btn => btn.addEventListener('click', () => document.execCommand(btn.dataset.cmd, false, null)));
    document.getElementById('modal-close-btn')?.addEventListener('click', () => TradeModal.close());
    document.getElementById('trade-modal-overlay')?.addEventListener('click', e => { if (e.target===document.getElementById('trade-modal-overlay')) TradeModal.close(); });
    document.addEventListener('keydown', e => { if (e.key==='Escape') TradeModal.close(); });
    document.getElementById('lightbox-close')?.addEventListener('click', () => document.getElementById('lightbox')?.classList.add('hidden'));
    document.getElementById('lightbox-bg')?.addEventListener('click', () => document.getElementById('lightbox')?.classList.add('hidden'));
  },
  setPageTitle(title) {
    const el = document.getElementById('page-title');
    if (el) el.textContent = title;
    document.querySelectorAll('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === AppState.currentPage));
  },
};

const Router = {
  navigate(pageId) {
    if (pageId==='add-trade') { TradeModal.open(); return; }
    AppState.currentPage = pageId;
    document.querySelectorAll('.page').forEach(s => s.classList.remove('active'));
    document.getElementById('page-'+pageId)?.classList.add('active');
    const titles = { dashboard:'Dashboard', history:'Trade History', analytics:'Analytics', charts:'Charts', calendar:'Calendar', 'ai-insights':'AI Insights', notes:'Journal', psychology:'Psychology', screenshots:'Screenshots', settings:'Settings' };
    Shell.setPageTitle(titles[pageId]||pageId);
    const renders = { dashboard:()=>Pages.renderDashboard(), history:()=>Pages.renderHistory(), analytics:()=>Pages.renderAnalytics(), charts:()=>Pages.renderCharts(), calendar:()=>Pages.renderCalendar(), 'ai-insights':()=>Pages.renderInsights(), notes:()=>Pages.renderNotes(), psychology:()=>Pages.renderPsychology(), screenshots:()=>Pages.renderScreenshots(), settings:()=>Shell._loadSettingsValues() };
    if (renders[pageId]) renders[pageId]();
  },
};

const Pages = {
  renderDashboard() {
    const { stats, settings } = AppState;
    const c = settings.currency || '₹';
    const grid = document.getElementById('kpi-grid');
    if (grid) grid.innerHTML = this._buildKPIGrid(stats, c);
    this._updateAIBanner();
    setTimeout(() => {
      if (AppState.trades.length) {
        TCharts.equityCurve('equity-chart', stats.equity_curve||[], c);
        TCharts.winLossDoughnut('winloss-chart', stats);
        TCharts.strategyComparison('strategy-chart', stats.by_strategy||{}, c);
        TCharts.dailyPnL('daily-pnl-chart', AppState.trades, c);
      }
    }, 80);
    this._renderRecentTrades();
    Shell._updateCapital();
  },

  _buildKPIGrid(s, c) {
    const strats = AppState.strategies;
    const stratName = id => strats.find(st=>st.id===id)?.name || id || '—';
    const kpis = [
      { label:"Today's P&L", val:s.today_pnl||0, icon:'trending-up', color:(s.today_pnl||0)>=0?'green':'red', fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Weekly P&L",  val:s.weekly_pnl||0, icon:'calendar',    color:(s.weekly_pnl||0)>=0?'green':'red', fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Monthly P&L", val:s.monthly_pnl||0,icon:'bar-chart-2', color:(s.monthly_pnl||0)>=0?'green':'red',fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Total P&L",   val:s.total_pnl||0,  icon:'dollar-sign', color:(s.total_pnl||0)>=0?'green':'red', fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Win Rate",    val:s.win_rate||0,   icon:'target',      color:'blue',   fmt:v=>v.toFixed(1)+'%' },
      { label:"Total Trades",val:s.total_trades||0,icon:'activity',   color:'indigo', fmt:v=>v },
      { label:"Profit Factor",val:s.profit_factor||0,icon:'zap',      color:(s.profit_factor||0)>=1.5?'green':(s.profit_factor||0)<1?'red':'yellow', fmt:v=>isFinite(v)?v.toFixed(2):'∞' },
      { label:"Avg R:R",     val:s.avg_rr||0,    icon:'git-merge',    color:'cyan',   fmt:v=>v.toFixed(2)+'R' },
      { label:"Expectancy",  val:s.expectancy||0, icon:'trending-up', color:(s.expectancy||0)>=0?'green':'red', fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Max Drawdown",val:s.max_drawdown||0,icon:'trending-down',color:'red',  fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Largest Win", val:s.largest_win||0,icon:'award',       color:'green',  fmt:v=>Utils.formatCurrency(v,c) },
      { label:"Largest Loss",val:Math.abs(s.largest_loss||0),icon:'alert-triangle',color:'red', fmt:v=>v?'-'+Utils.formatCurrency(v,c):'—' },
      { label:"Win Streak",  val:s.win_streak||0, icon:'zap',         color:'green',  fmt:v=>v?v+'🔥':'0' },
      { label:"Loss Streak", val:s.loss_streak||0,icon:'trending-down',color:'red',   fmt:v=>v?v+'💀':'0' },
      { label:"Psych Score", val:s.psychology_score||0,icon:'brain',  color:(s.psychology_score||0)>70?'green':(s.psychology_score||0)>40?'yellow':'red', fmt:v=>v+'/100' },
      { label:"Wins",        val:s.win_count||0,  icon:'check-circle',color:'green',  fmt:v=>v },
      { label:"Losses",      val:s.loss_count||0, icon:'x-circle',    color:'red',    fmt:v=>v },
      { label:"Avg Hold",    val:s.avg_holding_time||0,icon:'clock',  color:'blue',   fmt:v=>Utils.formatDuration(v) },
      { label:"Best Strategy",val:s.best_strategy||'—',icon:'star',   color:'yellow', fmt:v=>stratName(v) },
      { label:"Sharpe Ratio",val:s.sharpe||0,     icon:'activity',    color:(s.sharpe||0)>1?'green':(s.sharpe||0)<0?'red':'blue', fmt:v=>v.toFixed(2) },
    ];
    return kpis.map(k => {
      const dispVal = typeof k.val === 'number' ? k.fmt(k.val) : k.fmt(k.val);
      const cls = typeof k.val === 'number' ? Utils.colorClass(k.val) : '';
      return `<div class="glass-card kpi-card animate-in">
        <div class="kpi-card-icon ${k.color}">${Icons.get(k.icon)}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-number ${cls}">${dispVal}</div>
      </div>`;
    }).join('');
  },

  _updateAIBanner() {
    const el = document.getElementById('ai-banner-text');
    if (!el) return;
    const insights = Analytics.generateInsights(AppState.trades, AppState.stats);
    const top = insights[Math.floor(Math.random()*Math.min(3,insights.length))];
    if (top) el.textContent = `${top.icon} ${top.title}: ${top.text}`;
  },

  _renderRecentTrades() {
    const container = document.getElementById('recent-trades-table');
    if (!container) return;
    const trades = AppState.trades.slice(0, 8);
    const c = AppState.settings.currency || '₹';
    const strats = AppState.strategies;
    if (!trades.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icons.get('inbox')}</div><h3>No trades yet</h3><p>Click "Add Trade" to log your first trade.</p></div>`;
      return;
    }
    container.innerHTML = `<div style="overflow-x:auto;"><table><thead><tr><th>Date</th><th>Index</th><th>Direction</th><th>Strategy</th><th>Entry</th><th>Exit</th><th>P&L</th><th>RR</th></tr></thead><tbody>
      ${trades.map(t=>`<tr onclick="TradeModal.open('${t.id}')" style="cursor:pointer;">
        <td>${Utils.formatDate(t.date,'short')}</td>
        <td><span class="badge badge-blue">${t.index||'-'}</span></td>
        <td><span class="badge ${t.direction?.includes('BUY')?'badge-green':'badge-red'}">${t.direction||'-'}</span></td>
        <td class="truncate" style="max-width:100px;">${strats.find(s=>s.id===t.strategy_id)?.name||t.strategy_id||'-'}</td>
        <td>${t.entry||'-'}</td><td>${t.exit||'-'}</td>
        <td class="${Utils.colorClass(t.net_profit)}" style="font-weight:700;">${t.net_profit!=null?Utils.formatCurrency(t.net_profit,c):'-'}</td>
        <td>${t.rr?t.rr+'R':'-'}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
  },

  renderHistory() { HistoryCtrl._filtered = AppState.trades; HistoryCtrl.filter(); },

  renderAnalytics() {
    const { stats, settings } = AppState;
    const c = settings.currency || '₹';
    const grid = document.getElementById('analytics-grid');
    if (grid) {
      const rows = [
        ['Win Rate', Utils.formatPct(stats.win_rate||0), (stats.win_rate||0)>=50?'positive':'negative'],
        ['Profit Factor', isFinite(stats.profit_factor)?(stats.profit_factor||0).toFixed(2):'∞', (stats.profit_factor||0)>=1.5?'positive':'negative'],
        ['Expectancy', Utils.formatCurrency(stats.expectancy||0,c), (stats.expectancy||0)>=0?'positive':'negative'],
        ['Max Drawdown', Utils.formatCurrency(stats.max_drawdown||0,c), 'negative'],
        ['Avg Win', Utils.formatCurrency(stats.avgWin||0,c), 'positive'],
        ['Avg Loss', Utils.formatCurrency(stats.avgLoss||0,c), 'negative'],
      ];
      grid.innerHTML = rows.map(([l,v,cls])=>`<div class="glass-card kpi-card"><div class="kpi-label">${l}</div><div class="kpi-number ${cls}">${v}</div></div>`).join('');
    }
    setTimeout(() => {
      TCharts.monthlyPnL('monthly-chart', stats.by_month||{}, c);
      TCharts.hourPerformance('hourly-chart', stats.by_hour||{}, c);
      TCharts.indexPie('index-chart', stats.by_index||{});
      TCharts.drawdownCurve('drawdown-chart', AppState.trades);
      TCharts.psychologyChart('emotion-chart', AppState.trades);
      TCharts.sessionChart('session-chart', stats.by_session||{}, c);
    }, 80);
  },

  renderCharts() {
    const c = AppState.settings.currency||'₹';
    const { stats, trades } = AppState;
    setTimeout(() => {
      TCharts.equityCurve('capital-chart', stats.capital_curve||stats.equity_curve||[], c);
      TCharts.pnlDistribution('pnl-dist-chart', trades, c);
      TCharts.rrDistribution('rr-dist-chart', trades);
      TCharts.holdingDistribution('holding-chart', trades);
      TCharts.psychologyChart('psych-chart', trades);
    }, 80);
  },

  renderCalendar() { TCharts.calendarHeatmap('calendar-container', AppState.trades); },

  async renderInsights() { await this._fetchAndRenderInsights(false); },

  async _fetchAndRenderInsights(forceAI) {
    const container = document.getElementById('insights-grid');
    if (!container) return;
    container.innerHTML = `<div class="glass-card" style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted);"><div class="spinner" style="margin:0 auto 12px;border:2px solid var(--border-default);border-top-color:var(--accent-primary);width:24px;height:24px;border-radius:50%;animation:spin 600ms linear infinite;"></div><p>Analyzing your trades…</p></div>`;
    const { trades, stats } = AppState;
    let insights = null;
    if (forceAI && trades.length >= 5) insights = await AIInsights.fetchLive(trades, stats).catch(()=>null);
    if (!insights) insights = Analytics.generateInsights(trades, stats);
    container.innerHTML = AIInsights.renderCards(insights);
  },

  renderNotes() { NotesCtrl.render(); },
  renderPsychology() { PsychologyPage.render('page-psychology'); },
  renderScreenshots() {
    const grid = document.getElementById('screenshots-grid');
    if (grid) grid.innerHTML = Screenshots.renderAll();
  },
};

const TradeModal = {
  _editId: null,
  open(id=null) {
    this._editId = id||null;
    const overlay = document.getElementById('trade-modal-overlay');
    if (!overlay) return;
    this._buildStrategyButtons();
    if (id) { const t=DB.getTradeById(id); if(t) this._populate(t); } else { this._reset(); }
    overlay.classList.remove('hidden'); document.body.style.overflow='hidden';
    const title=document.getElementById('modal-title'); if(title) title.textContent = id?'Edit Trade':'Add Trade';
    // Wire save/cancel fresh
    const saveBtn=document.getElementById('save-trade-btn');
    if(saveBtn){saveBtn.onclick=null;saveBtn.onclick=()=>this.save();}
    this._bindCalcs();
    if(window.lucide) lucide.createIcons();
  },
  close() {
    document.getElementById('trade-modal-overlay')?.classList.add('hidden');
    document.body.style.overflow=''; this._editId=null;
  },
  _buildStrategyButtons() {
    const group=document.getElementById('strategy-group'); if(!group) return;
    const strats=AppState.strategies||DB.getStrategies();
    group.innerHTML=strats.map(s=>`<button type="button" class="toggle-btn" data-value="${s.id}">${s.name}</button>`).join('');
    group.querySelectorAll('.toggle-btn').forEach(btn=>btn.addEventListener('click',()=>{group.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}));
  },
  _reset() {
    document.getElementById('trade-form')?.reset();
    const now=new Date();
    const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
    s('trade-date',now.toISOString().split('T')[0]);
    s('trade-time',`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    s('trade-charges', AppState.settings.broker_charges||0);
    s('trade-confidence',5); const cd=document.getElementById('confidence-display');if(cd)cd.textContent='5';
    document.querySelectorAll('.btn-toggle-group .toggle-btn').forEach(b=>b.classList.remove('active'));
    ['setup-preview','exit-preview'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
    ['setup-screenshot','exit-screenshot'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';delete el.dataset.imgData;}});
    const ssn=document.getElementById('setup-screenshot-name');if(ssn)ssn.textContent='Choose image';
    const esn=document.getElementById('exit-screenshot-name');if(esn)esn.textContent='Choose image';
    document.getElementById('trade-id').value='';
  },
  _populate(t) {
    const s=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v;};
    document.getElementById('trade-id').value=t.id||'';
    s('trade-date',t.date);s('trade-time',t.time);s('trade-entry',t.entry);s('trade-exit',t.exit);
    s('trade-stoploss',t.stoploss);s('trade-target',t.target);s('trade-qty',t.quantity);
    s('trade-capital',t.capital_used);s('trade-charges',t.broker_charges);s('trade-pnl',t.net_profit);
    s('trade-rr',t.rr);s('trade-holding',t.holding_time);s('trade-session',t.session);
    s('trade-emotion-before',t.emotion_before);s('trade-emotion-after',t.emotion_after);
    s('trade-confidence',t.confidence||5);s('trade-mistake',t.mistake);
    s('trade-lesson',t.lesson);s('trade-notes',t.notes);
    s('trade-tags',Array.isArray(t.tags)?t.tags.join(', '):(t.tags||''));
    s('trade-entry-reason',t.entry_reason);s('trade-exit-reason',t.exit_reason);
    s('trade-market-structure',t.market_structure);
    const cd=document.getElementById('confidence-display');if(cd)cd.textContent=t.confidence||5;
    this._setToggle('index-group',t.index);this._setToggle('direction-group',t.direction);
    this._setToggle('strategy-group',t.strategy_id);this._setToggle('market-structure-group',t.market_structure);
    if(t.setup_screenshot) this._showPreview('setup-preview',t.setup_screenshot,'setup-screenshot-name');
    if(t.exit_screenshot)  this._showPreview('exit-preview', t.exit_screenshot, 'exit-screenshot-name');
  },
  _setToggle(gid,value) {
    const g=document.getElementById(gid);if(!g||!value)return;
    g.querySelectorAll('.toggle-btn').forEach(b=>b.classList.toggle('active',b.dataset.value===value));
  },
  _bindCalcs() {
    const slider=document.getElementById('trade-confidence'),disp=document.getElementById('confidence-display');
    if(slider&&disp) slider.oninput=()=>{disp.textContent=slider.value;};
    ['trade-entry','trade-exit','trade-stoploss','trade-target','trade-qty','trade-charges'].forEach(id=>{
      const el=document.getElementById(id);if(el) el.oninput=()=>this._recalculate();
    });
    const ssi=document.getElementById('setup-screenshot'),esi=document.getElementById('exit-screenshot');
    if(ssi) ssi.onchange=()=>this._handleScreenshot(ssi,'setup-preview','setup-screenshot-name');
    if(esi) esi.onchange=()=>this._handleScreenshot(esi,'exit-preview','exit-screenshot-name');
    ['index-group','direction-group','market-structure-group'].forEach(gid=>{
      document.getElementById(gid)?.querySelectorAll('.toggle-btn').forEach(btn=>btn.addEventListener('click',()=>{
        document.getElementById(gid).querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
      }));
    });
    document.getElementById('trade-time')?.addEventListener('change',e=>{
      const session=Helpers.detectSession(e.target.value);const sel=document.getElementById('trade-session');if(sel)sel.value=session;
    });
  },
  _recalculate() {
    const g=id=>parseFloat(document.getElementById(id)?.value)||0;
    const entry=g('trade-entry'),exit=g('trade-exit'),sl=g('trade-stoploss'),target=g('trade-target'),qty=g('trade-qty'),charges=g('trade-charges');
    if(entry&&exit&&qty){
      const net=parseFloat(((exit-entry)*qty-charges).toFixed(2));
      const pnlEl=document.getElementById('trade-pnl');
      if(pnlEl){pnlEl.value=net;pnlEl.classList.toggle('positive',net>0);pnlEl.classList.toggle('negative',net<0);}
    }
    if(entry&&sl&&qty){
      const risk=Math.abs((entry-sl)*qty);
      const riskEl=document.getElementById('trade-risk');if(riskEl)riskEl.value=risk.toFixed(2);
      if(target){
        const reward=Math.abs((target-entry)*qty);
        const rwEl=document.getElementById('trade-reward');if(rwEl)rwEl.value=reward.toFixed(2);
        if(risk>0){const rrEl=document.getElementById('trade-rr');if(rrEl)rrEl.value=(reward/risk).toFixed(2);}
      }
    }
  },
  _handleScreenshot(input,previewId,nameId) {
    const file=input.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{input.dataset.imgData=e.target.result;this._showPreview(previewId,e.target.result,nameId);};
    reader.readAsDataURL(file);
  },
  _showPreview(previewId,src,nameId) {
    const el=document.getElementById(previewId);const nameEl=document.getElementById(nameId);
    if(el)el.innerHTML=`<img src="${src}" alt="Screenshot">`;if(nameEl)nameEl.textContent='✓ Image loaded';
  },
  save() {
    const g=id=>(document.getElementById(id)?.value||'').trim();
    const gf=id=>parseFloat(document.getElementById(id)?.value)||null;
    const date=g('trade-date'),entry=gf('trade-entry');
    if(!date){Utils.toast('Please enter a trade date','warning');return;}
    if(!entry){Utils.toast('Please enter an entry price','warning');return;}
    const getToggle=gid=>document.getElementById(gid)?.querySelector('.toggle-btn.active')?.dataset.value||'';
    const holding_time=g('trade-holding');let holding_time_min=0;
    if(holding_time){const hm=holding_time.match(/(\d+)\s*h/i),mm=holding_time.match(/(\d+)\s*m/i);if(hm)holding_time_min+=parseInt(hm[1])*60;if(mm)holding_time_min+=parseInt(mm[1]);if(!hm&&!mm)holding_time_min=parseInt(holding_time)||0;}
    const tagsRaw=g('trade-tags');
    const tags=tagsRaw?tagsRaw.split(',').map(t=>t.trim()).filter(Boolean):[];
    const editId=document.getElementById('trade-id')?.value||this._editId;
    const trade={
      id:editId||undefined, date, entry,
      time:g('trade-time'), index:getToggle('index-group'), direction:getToggle('direction-group'),
      strategy_id:getToggle('strategy-group'), market_structure:getToggle('market-structure-group')||g('trade-market-structure'),
      exit:gf('trade-exit'), stoploss:gf('trade-stoploss'), target:gf('trade-target'),
      quantity:gf('trade-qty'), capital_used:gf('trade-capital'), broker_charges:gf('trade-charges'),
      net_profit:gf('trade-pnl'), rr:gf('trade-rr'), holding_time, holding_time_min,
      session:g('trade-session'), emotion_before:g('trade-emotion-before'), emotion_after:g('trade-emotion-after'),
      confidence:parseFloat(document.getElementById('trade-confidence')?.value)||5,
      mistake:g('trade-mistake'), lesson:g('trade-lesson'), notes:g('trade-notes'), tags,
      entry_reason:g('trade-entry-reason'), exit_reason:g('trade-exit-reason'),
      setup_screenshot:document.getElementById('setup-screenshot')?.dataset.imgData||null,
      exit_screenshot:document.getElementById('exit-screenshot')?.dataset.imgData||null,
    };
    DB.saveTrade(trade); this.close(); App.refresh();
    Utils.toast(editId?'Trade updated! ✓':'Trade saved! ✓','success');
  },
};

const HistoryCtrl = {
  _filtered: [],
  filter() {
    const search=(document.getElementById('history-search')?.value||'').toLowerCase();
    const index=document.getElementById('filter-index')?.value||'';
    const direction=document.getElementById('filter-direction')?.value||'';
    const result=document.getElementById('filter-result')?.value||'';
    this._filtered=AppState.trades.filter(t=>{
      if(search&&!JSON.stringify(t).toLowerCase().includes(search))return false;
      if(index&&t.index!==index)return false;
      if(direction&&t.direction!==direction)return false;
      if(result==='win'&&!(parseFloat(t.net_profit)>0))return false;
      if(result==='loss'&&!(parseFloat(t.net_profit)<0))return false;
      return true;
    });
    AppState.tradePage=1; this.renderTable();
  },
  sort(col) {
    if(AppState.tradeSortCol===col)AppState.tradeSortDir=AppState.tradeSortDir==='asc'?'desc':'asc';
    else{AppState.tradeSortCol=col;AppState.tradeSortDir='desc';}
    this.renderTable();
  },
  renderTable() {
    const tbody=document.getElementById('trades-tbody'),pageEl=document.getElementById('pagination');if(!tbody)return;
    const c=AppState.settings.currency||'₹',strats=AppState.strategies;
    const stratName=id=>strats.find(s=>s.id===id)?.name||id||'-';
    const sorted=[...this._filtered].sort((a,b)=>{const col=AppState.tradeSortCol,dir=AppState.tradeSortDir==='asc'?1:-1;const av=a[col]??'',bv=b[col]??'';return av<bv?-dir:av>bv?dir:0;});
    const total=sorted.length,pages=Math.ceil(total/AppState.tradePerPage)||1,page=Math.min(AppState.tradePage,pages),start=(page-1)*AppState.tradePerPage,slice=sorted.slice(start,start+AppState.tradePerPage);
    tbody.innerHTML=slice.length?slice.map(t=>`<tr>
      <td>${Utils.formatDate(t.date,'short')}</td><td style="color:var(--text-muted);">${t.time||'-'}</td>
      <td><span class="badge badge-blue">${t.index||'-'}</span></td>
      <td><span class="badge ${t.direction?.includes('BUY')?'badge-green':'badge-red'}">${t.direction||'-'}</span></td>
      <td class="truncate" style="max-width:110px;">${stratName(t.strategy_id)}</td>
      <td>${t.entry||'-'}</td><td>${t.exit||'-'}</td>
      <td class="${Utils.colorClass(t.net_profit)}" style="font-weight:700;">${t.net_profit!=null?Utils.formatCurrency(t.net_profit,c):'-'}</td>
      <td>${t.rr?t.rr+'R':'-'}</td>
      <td><span class="badge ${parseFloat(t.net_profit)>0?'badge-green':parseFloat(t.net_profit)<0?'badge-red':'badge-blue'}">${parseFloat(t.net_profit)>0?'WIN':parseFloat(t.net_profit)<0?'LOSS':'OPEN'}</span></td>
      <td><div class="flex gap-2"><button class="btn btn-ghost btn-icon btn-sm" onclick="TradeModal.open('${t.id}')" title="Edit">${Icons.get('edit-2')}</button><button class="btn btn-danger btn-icon btn-sm" onclick="HistoryCtrl.deleteTrade('${t.id}')" title="Delete">${Icons.get('trash-2')}</button></div></td>
    </tr>`).join(''):`<tr><td colspan="11"><div class="empty-state" style="padding:40px;"><div class="empty-state-icon">${Icons.get('inbox')}</div><h3>No trades found</h3></div></td></tr>`;
    if(pageEl)pageEl.innerHTML=pages>1?this._buildPagination(page,pages):'';
  },
  _buildPagination(cur,total) {
    let h='<div class="pagination">';
    h+=`<button class="page-btn" ${cur===1?'disabled':''} onclick="HistoryCtrl.goPage(${cur-1})">←</button>`;
    for(let i=1;i<=total;i++){if(i===1||i===total||Math.abs(i-cur)<=2)h+=`<button class="page-btn ${i===cur?'active':''}" onclick="HistoryCtrl.goPage(${i})">${i}</button>`;else if(Math.abs(i-cur)===3)h+=`<span style="padding:0 6px;color:var(--text-muted);">…</span>`;}
    h+=`<button class="page-btn" ${cur===total?'disabled':''} onclick="HistoryCtrl.goPage(${cur+1})">→</button></div>`;
    return h;
  },
  goPage(p){AppState.tradePage=p;this.renderTable();},
  deleteTrade(id){if(!confirm('Delete this trade? This cannot be undone.'))return;DB.deleteTrade(id);App.refresh();Utils.toast('Trade deleted','success');},
  exportCSV(){Utils.exportToCSV(this._filtered.length?this._filtered:AppState.trades);Utils.toast('CSV exported','success');},
  importCSV(file){if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const rows=Utils.parseCSV(e.target.result);const result=DB.importTrades(rows);App.refresh();Utils.toast(`Imported ${result.count} new trades`,'success');}catch(err){Utils.toast('Import failed: '+err.message,'error');}};reader.readAsText(file);},
};

const NotesCtrl = {
  _editing:null, _type:'daily',
  render() {
    const list=document.getElementById('notes-list');if(!list)return;
    const notes=DB.getNotes().filter(n=>n.type===this._type);
    if(!notes.length){list.innerHTML=`<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon">${Icons.get('book-open')}</div><p style="font-size:0.8rem;">No ${this._type} entries yet.</p></div>`;return;}
    list.innerHTML=notes.map(n=>`<div class="note-item ${this._editing===n.id?'active':''}" onclick="NotesCtrl.edit('${n.id}')"><div class="note-item-title">${n.title||'Untitled'}</div><div class="note-item-date">${Utils.formatDate(n.updated_at,'relative')}</div></div>`).join('');
  },
  setType(type){this._type=type;document.querySelectorAll('.notes-tab').forEach(b=>b.classList.toggle('active',b.dataset.noteType===type));this.render();},
  openNew(){this._editing=null;const t=document.getElementById('note-title'),c=document.getElementById('note-content');if(t)t.value='';if(c){c.innerHTML='<p></p>';c.focus();}},
  edit(id){const note=DB.getNotes().find(n=>n.id===id);if(!note)return;this._editing=id;const t=document.getElementById('note-title'),c=document.getElementById('note-content');if(t)t.value=note.title||'';if(c)c.innerHTML=note.content||'<p></p>';this.render();},
  save(){const title=(document.getElementById('note-title')?.value||'').trim(),content=document.getElementById('note-content')?.innerHTML||'';if(!content||content==='<p></p>'){Utils.toast('Write something first','warning');return;}DB.saveNote({id:this._editing||undefined,title:title||'Untitled',content,type:this._type});this._editing=null;this.render();Utils.toast('Journal entry saved','success');},
};

const SettingsCtrl = {
  changePasscode(){const cur=document.getElementById('current-pass')?.value||'',newP=document.getElementById('new-pass')?.value||'',conf=document.getElementById('confirm-pass')?.value||'',s=DB.getSettings();if(cur!==s.passcode){Utils.toast('Current passcode is incorrect','error');return;}if(newP.length<4){Utils.toast('New passcode must be at least 4 characters','warning');return;}if(newP!==conf){Utils.toast('Passcodes do not match','error');return;}DB.saveSettings({passcode:newP});['current-pass','new-pass','confirm-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});Utils.toast('Passcode updated ✓','success');},
  saveStrategies(){const strats=DB.getStrategies();['strat-1-name','strat-2-name','strat-3-name'].forEach((id,i)=>{const el=document.getElementById(id);if(el&&el.value.trim()){strats[i].name=el.value.trim();DB.saveStrategy(strats[i]);}});AppState.strategies=DB.getStrategies();Utils.toast('Strategies saved ✓','success');},
  saveCapital(){DB.saveSettings({startingCapital:parseFloat(document.getElementById('starting-capital')?.value)||100000,maxRisk:parseFloat(document.getElementById('max-risk')?.value)||1,dailyLossLimit:parseFloat(document.getElementById('daily-loss-limit')?.value)||5000});AppState.settings=DB.getSettings();App.refresh();Utils.toast('Capital settings saved ✓','success');},
  exportDB(){Utils.exportToJSON(DB.exportAll(),`traderos_backup_${Utils.todayStr()}.json`);Utils.toast('Database exported ✓','success');},
  importDB(file){if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const result=DB.importAll(JSON.parse(e.target.result));App.refresh();Utils.toast(`Restored ${result.count} trades ✓`,'success');}catch{Utils.toast('Invalid backup file','error');}};reader.readAsText(file);},
  clearData(){if(!confirm('Clear ALL trades? This cannot be undone!'))return;DB.clearTrades();App.refresh();Utils.toast('All trades cleared','info');},
  async saveSupabase(){
    const url=(document.getElementById('supabase-url')?.value||'').trim();
    const key=(document.getElementById('supabase-key')?.value||'').trim();
    if(!url||!key){Utils.toast('Please enter both URL and key','warning');return;}
    SupabaseConfig.init(url,key);
    const ok=await DB.testConnection();
    const el=document.getElementById('supabase-status');
    if(el){el.textContent=ok?'✓ Connected to Supabase':'✗ Connection failed — check URL and key';el.className='supabase-status '+(ok?'connected':'error');}
    Utils.toast(ok?'Supabase connected ✓':'Connection failed — check credentials',ok?'success':'error');
  },

  async syncFromCloud(){
    const el=document.getElementById('supabase-status');
    if(!SupabaseConfig.isConnected()){
      // Try to re-init from saved creds first
      const url=localStorage.getItem('traderos_supabase_url');
      const key=localStorage.getItem('traderos_supabase_key');
      if(url&&key) SupabaseConfig.init(url,key);
    }
    if(!SupabaseConfig.isConnected()){Utils.toast('Connect to Supabase first','warning');return;}
    if(el){el.textContent='⏳ Pulling from cloud…';el.className='supabase-status';}
    Utils.toast('Pulling trades from cloud…','info');
    const ok=await DB.syncFromSupabase();
    if(ok){
      App.refresh();
      const count=DB.getAllTrades().length;
      if(el){el.textContent=`✓ Synced — ${count} trades loaded`;el.className='supabase-status connected';}
      Utils.toast(`✓ Pulled ${count} trades from cloud`,'success');
    } else {
      if(el){el.textContent='✗ Sync failed';el.className='supabase-status error';}
      Utils.toast('Pull failed — check Supabase connection','error');
    }
  },

  async pushToCloud(){
    const el=document.getElementById('supabase-status');
    if(!SupabaseConfig.isConnected()){
      const url=localStorage.getItem('traderos_supabase_url');
      const key=localStorage.getItem('traderos_supabase_key');
      if(url&&key) SupabaseConfig.init(url,key);
    }
    if(!SupabaseConfig.isConnected()){Utils.toast('Connect to Supabase first','warning');return;}
    if(el){el.textContent='⏳ Pushing to cloud…';el.className='supabase-status';}
    const trades=DB.getAllTrades();
    let pushed=0,failed=0;
    for(const trade of trades){
      try{
        const{error}=await SupabaseConfig.client.from('trades').upsert({id:trade.id,data:trade,created_at:trade.created_at,updated_at:trade.updated_at});
        if(error)failed++;else pushed++;
      }catch(e){failed++;}
    }
    if(el){el.textContent=`✓ Pushed ${pushed} trades to cloud${failed?` (${failed} failed)`:''}`;el.className='supabase-status connected';}
    Utils.toast(`✓ Pushed ${pushed} trades to Supabase`,'success');
  },
};

/* ─── TCharts extension: session, pnl dist, holding dist ─── */
(function extendTCharts(){
  if(!window.TCharts)return;
  const baseOpts=(overrides={})=>({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(20,23,35,0.95)',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,cornerRadius:8,titleColor:'#F0F2FF',bodyColor:'rgba(240,242,255,0.7)'}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'rgba(240,242,255,0.6)'},border:{display:false}},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'rgba(240,242,255,0.6)'},border:{display:false}}},...overrides});
  const cnv=id=>{const el=document.getElementById(id);if(!el)return null;const ex=Chart.getChart(el);if(ex)ex.destroy();return el;};
  TCharts.sessionChart=function(id,bySession,c='₹'){const el=cnv(id);if(!el)return;const sessions=['Opening','Midday','Closing'],data=sessions.map(s=>parseFloat((bySession[s]?.total_pnl||0).toFixed(2))),colors=data.map(v=>v>=0?'rgba(0,212,170,0.8)':'rgba(255,77,109,0.8)');new Chart(el,{type:'bar',data:{labels:sessions,datasets:[{data,backgroundColor:colors,borderRadius:6,borderSkipped:false}]},options:baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${c}${ctx.parsed.y.toLocaleString('en-IN')}`}}}})});};
  TCharts.pnlDistribution=function(id,trades){const el=cnv(id);if(!el)return;const{labels,data,colors}=Analytics.getPnLDistribution(trades);if(!labels.length)return;new Chart(el,{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:4,borderSkipped:false}]},options:baseOpts()});};
  TCharts.holdingDistribution=function(id,trades){const el=cnv(id);if(!el)return;const buckets={'<5m':0,'5-15m':0,'15-30m':0,'30-60m':0,'>60m':0};for(const t of trades){const m=parseInt(t.holding_time_min)||0;if(m<5)buckets['<5m']++;else if(m<15)buckets['5-15m']++;else if(m<30)buckets['15-30m']++;else if(m<60)buckets['30-60m']++;else buckets['>60m']++;}const labels=Object.keys(buckets),data=Object.values(buckets);new Chart(el,{type:'bar',data:{labels,datasets:[{data,backgroundColor:'rgba(108,99,255,0.7)',borderRadius:4,borderSkipped:false}]},options:baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.y} trades`}}}})});};
})();
