/* ══════════════════════════════════════════════
   TRADEROS — Analytics Engine
   js/utils/analytics.js

   Computes every stat the app needs from raw trades.
   All methods are pure — no side effects, no DOM.
══════════════════════════════════════════════ */

window.Analytics = {

  /**
   * Master compute: called on every refresh.
   * Returns a flat stats object consumed by Pages & Charts.
   */
  compute(trades) {
    if (!trades || !trades.length) return this._empty();

    const closed  = trades.filter(t => t.exit && parseFloat(t.exit) > 0 && t.net_profit != null);
    const winners = closed.filter(t => parseFloat(t.net_profit) > 0);
    const losers  = closed.filter(t => parseFloat(t.net_profit) < 0);

    /* ── Core P&L ── */
    const totalPnL    = closed.reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);
    const totalWins   = winners.reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);
    const totalLosses = losers.reduce((s, t) => s + Math.abs(parseFloat(t.net_profit) || 0), 0);

    /* ── Period P&L ── */
    const today    = new Date().toISOString().split('T')[0];
    const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const todayPnL   = closed.filter(t => t.date === today).reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);
    const weeklyPnL  = closed.filter(t => t.date >= weekAgo).reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);
    const monthlyPnL = closed.filter(t => t.date >= monthAgo).reduce((s, t) => s + (parseFloat(t.net_profit) || 0), 0);

    /* ── Rates ── */
    const totalTrades  = closed.length;
    const winningTrades= winners.length;
    const losingTrades = losers.length;
    const openTrades   = trades.filter(t => !t.exit || parseFloat(t.exit) === 0).length;
    const winRate  = totalTrades ? (winningTrades / totalTrades) * 100 : 0;
    const lossRate = totalTrades ? (losingTrades  / totalTrades) * 100 : 0;

    /* ── Averages ── */
    const avgWin  = winningTrades ? totalWins   / winningTrades : 0;
    const avgLoss = losingTrades  ? totalLosses / losingTrades  : 0;

    /* ── RR ── */
    const rrValues = closed.filter(t => t.rr && parseFloat(t.rr) > 0).map(t => parseFloat(t.rr));
    const avgRR    = rrValues.length ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

    /* ── Extremes ── */
    const largestWin  = winners.length ? Math.max(...winners.map(t => parseFloat(t.net_profit) || 0)) : 0;
    const largestLoss = losers.length  ? Math.min(...losers.map(t => parseFloat(t.net_profit)  || 0)) : 0;

    /* ── Holding Time (avg in minutes) ── */
    const holdingMins = closed.filter(t => t.holding_time_min > 0).map(t => parseInt(t.holding_time_min) || 0);
    const avgHolding  = holdingMins.length ? holdingMins.reduce((a, b) => a + b, 0) / holdingMins.length : 0;

    /* ── Profit Factor ── */
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);

    /* ── Expectancy per trade ── */
    const expectancy = totalTrades ? totalPnL / totalTrades : 0;

    /* ── Max Drawdown ── */
    const maxDrawdown = this._calcMaxDrawdown(closed);

    /* ── Streaks ── */
    const { winStreak, lossStreak } = this._calcStreaks(closed);

    /* ── Psychology Score ── */
    const psychScore = this._calcPsychScore(closed);

    /* ── Mistake frequency (% of trades with mistakes) ── */
    const withMistakes = closed.filter(t => t.mistake && t.mistake !== '').length;
    const mistakeFreq  = totalTrades ? (withMistakes / totalTrades) * 100 : 0;

    /* ── Best/Worst analysis ── */
    const bestDay      = this._bestGroupKey(closed, t => this._dayName(t.date), 'pnl');
    const worstDay     = this._bestGroupKey(closed, t => this._dayName(t.date), 'pnl', true);
    const bestStrategy = this._bestGroupKey(closed, t => t.strategy_id, 'pnl');
    const worstStrategy= this._bestGroupKey(closed, t => t.strategy_id, 'pnl', true);
    const bestMonth    = this._bestGroupKey(closed, t => t.date?.substring(0, 7), 'pnl');
    const worstMonth   = this._bestGroupKey(closed, t => t.date?.substring(0, 7), 'pnl', true);
    const bestHour     = this._bestGroupKey(closed, t => t.time?.substring(0, 2) + ':00', 'pnl');

    /* ── Capital curve ── */
    const settings = window.DB ? window.DB.getSettings() : {};
    const sc = parseFloat(settings.startingCapital) || 100000;
    const sorted = [...closed].sort((a, b) => (a.date + (a.time||'')) < (b.date + (b.time||'')) ? -1 : 1);
    let running = 0;
    const equity_curve  = sorted.map(t => { running += parseFloat(t.net_profit) || 0; return parseFloat(running.toFixed(2)); });
    const capital_curve = equity_curve.map(v => parseFloat((sc + v).toFixed(2)));
    const currentCapital = capital_curve.slice(-1)[0] || sc;

    /* ── Sharpe (simplified) ── */
    const rets = sorted.map(t => parseFloat(t.net_profit) || 0);
    const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const variance = rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rets.length || 1);
    const sharpe = variance > 0 ? mean / Math.sqrt(variance) : 0;

    return {
      /* counts */
      totalTrades, winningTrades, losingTrades, openTrades,
      /* rates */
      winRate, lossRate,
      /* pnl */
      totalPnL, todayPnL, weeklyPnL, monthlyPnL,
      avgWin, avgLoss, largestWin, largestLoss,
      /* ratios */
      avgRR, profitFactor, expectancy,
      /* risk */
      maxDrawdown,
      /* streaks */
      winStreak, lossStreak,
      /* time */
      avgHolding,
      /* psychology */
      psychScore, mistakeFreq,
      /* best/worst */
      bestDay, worstDay, bestStrategy, worstStrategy, bestMonth, worstMonth, bestHour,
      /* curves */
      equity_curve, capital_curve, currentCapital,
      /* extra */
      sharpe,
      /* pass-through aliases used by app.js patch */
      win_rate: winRate, loss_rate: lossRate,
      win_count: winningTrades, loss_count: losingTrades,
      open_trades: openTrades, total_trades: totalTrades,
      total_pnl: totalPnL, today_pnl: todayPnL,
      weekly_pnl: weeklyPnL, monthly_pnl: monthlyPnL,
      avg_rr: avgRR, avg_holding_time: avgHolding,
      largest_win: largestWin, largest_loss: largestLoss,
      win_streak: winStreak, loss_streak: lossStreak,
      profit_factor: profitFactor, max_drawdown: maxDrawdown,
      psychology_score: Math.round((psychScore || 0) * 10),
      best_strategy: bestStrategy, best_day: bestDay,
    };
  },

  /* ─── GROUPING HELPERS (used by app.js patch) ─── */

  groupBy(arr, keyFn) {
    const g = {};
    for (const t of arr) {
      const k = keyFn(t) || 'Unknown';
      if (!g[k]) g[k] = { trades: 0, wins: 0, losses: 0, total_pnl: 0, win_rate: 0 };
      const pnl = parseFloat(t.net_profit) || 0;
      g[k].trades++;
      g[k].total_pnl += pnl;
      if (pnl > 0) g[k].wins++; else if (pnl < 0) g[k].losses++;
    }
    for (const k in g) g[k].win_rate = g[k].trades ? g[k].wins / g[k].trades * 100 : 0;
    return g;
  },

  /* ─── CHART DATA HELPERS ─── */

  /** P&L distribution buckets for histogram */
  getPnLDistribution(trades) {
    const closed = trades.filter(t => t.net_profit != null);
    if (!closed.length) return { labels: [], data: [], colors: [] };

    const pnls   = closed.map(t => parseFloat(t.net_profit) || 0);
    const min    = Math.floor(Math.min(...pnls) / 500) * 500;
    const max    = Math.ceil(Math.max(...pnls) / 500) * 500;
    const step   = Math.max(500, Math.round((max - min) / 10 / 500) * 500);

    const buckets = {};
    for (let v = min; v < max; v += step) {
      const label = `${v >= 0 ? '+' : ''}${v}`;
      buckets[label] = 0;
    }
    for (const pnl of pnls) {
      const bucket = Math.floor(pnl / step) * step;
      const label  = `${bucket >= 0 ? '+' : ''}${bucket}`;
      if (buckets[label] !== undefined) buckets[label]++;
      else buckets[label] = 1;
    }

    const labels = Object.keys(buckets).sort((a, b) => parseFloat(a) - parseFloat(b));
    const data   = labels.map(l => buckets[l]);
    const colors = labels.map(l => parseFloat(l) >= 0 ? 'rgba(0,212,170,0.75)' : 'rgba(255,77,109,0.75)');
    return { labels, data, colors };
  },

  /**
   * AI summary object for prompt building
   */
  getSummaryForAI(trades) {
    const stats = this.compute(trades);
    return { stats, totalTrades: stats.totalTrades };
  },

  /**
   * Local insight generation (fallback when AI API unavailable)
   */
  generateInsights(trades, stats) {
    if (!trades || trades.length < 3) return [{
      icon: '📊', type: 'Getting Started', sentiment: 'neutral',
      title: 'Log More Trades',
      text: 'You need at least 3 trades to start seeing pattern-based insights. Keep logging your trades daily!',
    }];

    const insights = [];
    const s = stats || this.compute(trades);
    const strats = window.DB ? window.DB.getStrategies() : [];
    const stratName = id => strats.find(st => st.id === id)?.name || id || 'Unknown';

    /* Win rate */
    if (s.winRate > 60 || s.win_rate > 60)
      insights.push({ icon: '🎯', type: 'Win Rate', sentiment: 'positive', title: `Strong ${(s.winRate||s.win_rate||0).toFixed(1)}% Win Rate`, text: `Your win rate is excellent. Maintain your entry discipline and stick to your best setups.` });
    else if ((s.winRate||s.win_rate||0) < 40 && (s.totalTrades||s.total_trades||0) > 5)
      insights.push({ icon: '⚠️', type: 'Win Rate', sentiment: 'negative', title: `Win Rate at ${(s.winRate||s.win_rate||0).toFixed(1)}%`, text: `Your win rate is below 40%. Focus on higher-probability setups and avoid impulsive entries.` });

    /* Profit factor */
    const pf = s.profitFactor || s.profit_factor || 0;
    if (pf > 1.5)
      insights.push({ icon: '💰', type: 'Profit Factor', sentiment: 'positive', title: `Profit Factor: ${isFinite(pf) ? pf.toFixed(2) : '∞'}`, text: `A profit factor above 1.5 means your winners significantly outpace your losers. Excellent risk management!` });
    else if (pf > 0 && pf < 1)
      insights.push({ icon: '📉', type: 'Risk Management', sentiment: 'negative', title: 'Profit Factor Below 1.0', text: `Your losses currently outpace your wins. Review your stop-loss discipline and exit strategy to flip this metric.` });

    /* Streaks */
    const ws = s.winStreak  || s.win_streak  || 0;
    const ls = s.lossStreak || s.loss_streak || 0;
    if (ws >= 3) insights.push({ icon: '🔥', type: 'Hot Streak', sentiment: 'positive', title: `${ws}-Trade Win Streak!`, text: `You're on a roll. Stay disciplined, stick to your rules, and avoid overconfidence.` });
    if (ls >= 3) insights.push({ icon: '🧊', type: 'Loss Streak', sentiment: 'negative', title: `${ls} Consecutive Losses`, text: `Take a step back and review your last ${ls} trades. Consider reducing position size until you regain clarity.` });

    /* Best strategy */
    const byStrat = s.by_strategy;
    if (byStrat) {
      const bestS = Object.entries(byStrat).sort((a, b) => b[1].total_pnl - a[1].total_pnl)[0];
      if (bestS && bestS[1].total_pnl > 0)
        insights.push({ icon: '⭐', type: 'Best Strategy', sentiment: 'positive', title: `"${stratName(bestS[0])}" is Your Best Strategy`, text: `This strategy generates your highest profits. Prioritise setups matching this approach.` });
    }

    /* Best time */
    const byHour = s.by_hour;
    if (byHour) {
      const bestH = Object.entries(byHour).sort((a, b) => b[1].total_pnl - a[1].total_pnl)[0];
      if (bestH && bestH[1].total_pnl > 0)
        insights.push({ icon: '⏰', type: 'Best Time', sentiment: 'positive', title: `Peak Performance at ${bestH[0]}`, text: `You generate the most profit around ${bestH[0]}. Prioritise your best setups during this window.` });
    }

    /* RR */
    const avgRR = s.avgRR || s.avg_rr || 0;
    if (avgRR < 1 && (s.totalTrades || s.total_trades || 0) > 5)
      insights.push({ icon: '📐', type: 'R:R Ratio', sentiment: 'warning', title: `Average RR is ${avgRR.toFixed(2)}R`, text: `Your average Risk:Reward is below 1R. Target setups with at least 1.5R to improve long-term profitability.` });

    /* Psychology */
    const ps = s.psychology_score || 0;
    if (ps > 0 && ps < 50)
      insights.push({ icon: '🧠', type: 'Psychology', sentiment: 'warning', title: `Psychology Score: ${ps}/100`, text: `Emotional states (Anxious, FOMO, Greedy) appear in your losing trades. Review your pre-trade routine.` });

    /* Mistakes */
    const byDay = s.by_day;
    if (byDay) {
      const worstD = Object.entries(byDay).sort((a, b) => a[1].total_pnl - b[1].total_pnl)[0];
      if (worstD && worstD[1].total_pnl < 0)
        insights.push({ icon: '📅', type: 'Worst Day', sentiment: 'warning', title: `${worstD[0]}s Are Your Weakest Day`, text: `You lose the most on ${worstD[0]}s. Consider trading conservatively or skipping low-quality setups on this day.` });
    }

    return insights.slice(0, 8);
  },

  /* ─── PRIVATE HELPERS ─── */

  _empty() {
    return {
      totalTrades: 0, winningTrades: 0, losingTrades: 0, openTrades: 0,
      winRate: 0, lossRate: 0,
      totalPnL: 0, todayPnL: 0, weeklyPnL: 0, monthlyPnL: 0,
      avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
      avgRR: 0, profitFactor: 0, expectancy: 0,
      maxDrawdown: 0, winStreak: 0, lossStreak: 0,
      avgHolding: 0, psychScore: 0, mistakeFreq: 0,
      bestDay: '—', worstDay: '—', bestStrategy: '—', worstStrategy: '—',
      bestMonth: '—', worstMonth: '—', bestHour: '—',
      equity_curve: [], capital_curve: [], currentCapital: 0, sharpe: 0,
      /* aliases */
      win_rate: 0, loss_rate: 0, win_count: 0, loss_count: 0,
      open_trades: 0, total_trades: 0, total_pnl: 0,
      today_pnl: 0, weekly_pnl: 0, monthly_pnl: 0,
      avg_rr: 0, avg_holding_time: 0,
      largest_win: 0, largest_loss: 0,
      win_streak: 0, loss_streak: 0,
      profit_factor: 0, max_drawdown: 0,
      psychology_score: 0, best_strategy: '—', best_day: '—',
    };
  },

  _calcMaxDrawdown(closed) {
    if (!closed.length) return 0;
    const sorted = [...closed].sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
    let peak = 0, maxDD = 0, running = 0;
    for (const t of sorted) {
      running += parseFloat(t.net_profit) || 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDD) maxDD = dd;
    }
    return parseFloat(maxDD.toFixed(2));
  },

  _calcStreaks(closed) {
    const sorted = [...closed].sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
    let winStreak = 0, lossStreak = 0, curWin = 0, curLoss = 0;
    for (const t of sorted) {
      const pnl = parseFloat(t.net_profit) || 0;
      if (pnl > 0) { curWin++; curLoss = 0; }
      else if (pnl < 0) { curLoss++; curWin = 0; }
      if (curWin  > winStreak)  winStreak  = curWin;
      if (curLoss > lossStreak) lossStreak = curLoss;
    }
    return { winStreak, lossStreak };
  },

  _calcPsychScore(closed) {
    if (!closed.length) return 5;
    const goodEmotions = ['Calm', 'Confident', 'Neutral'];
    let score = 0, count = 0;
    for (const t of closed) {
      if (!t.emotion_before) continue;
      const isGood = goodEmotions.includes(t.emotion_before);
      const pnl    = parseFloat(t.net_profit) || 0;
      const conf   = (parseFloat(t.confidence) || 5) / 10;
      const emo    = isGood ? 0.7 : 0.3;
      const result = pnl > 0 ? 0.8 : 0.2;
      score += (emo * 0.4 + result * 0.4 + conf * 0.2);
      count++;
    }
    return count ? score / count : 5;
  },

  _bestGroupKey(trades, keyFn, metric = 'pnl', worst = false) {
    const groups = {};
    for (const t of trades) {
      const k = keyFn(t);
      if (!k || k === 'undefined') continue;
      if (!groups[k]) groups[k] = 0;
      groups[k] += parseFloat(t.net_profit) || 0;
    }
    const entries = Object.entries(groups);
    if (!entries.length) return '—';
    entries.sort((a, b) => worst ? a[1] - b[1] : b[1] - a[1]);
    return entries[0][0];
  },

  _dayName(dateStr) {
    if (!dateStr) return null;
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr).getDay()];
  },
};
