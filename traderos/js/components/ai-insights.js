/* ══════════════════════════════════════════════
   TRADEROS — AI Insights Component
   js/components/ai-insights.js
══════════════════════════════════════════════ */

window.AIInsights = {
  /**
   * Fetch AI-powered insights using the Anthropic API.
   * Falls back to local Analytics.generateInsights() if API not available.
   */
  async fetchLive(trades, stats) {
    const summary = Analytics.getSummaryForAI ? Analytics.getSummaryForAI(trades) : { stats };
    try {
      const prompt = `You are a professional trading coach analyzing a trader's journal data. 
Based on the following trading statistics, provide 3-5 specific, actionable insights in JSON format.

Trading Stats:
- Total trades: ${stats.total_trades}
- Win rate: ${stats.win_rate?.toFixed(1)}%
- Profit factor: ${isFinite(stats.profit_factor) ? stats.profit_factor?.toFixed(2) : 'Infinity'}
- Average R:R: ${stats.avg_rr?.toFixed(2)}
- Max drawdown: ₹${stats.max_drawdown?.toFixed(0)}
- Best day: ${stats.best_day}
- Best hour: ${stats.best_hour}
- Win streak: ${stats.win_streak}
- Loss streak: ${stats.loss_streak}
- Expectancy: ₹${stats.expectancy?.toFixed(0)}
- Mistake frequency: ${stats.mistake_freq?.toFixed(0)}%
- Psychology score: ${stats.psychology_score}/100

Respond ONLY with a JSON array, no markdown, no explanation. Format:
[{"icon":"🎯","type":"Performance","sentiment":"positive","title":"Short title","text":"2-3 sentence insight with specific numbers from the data."}]
sentiment must be: positive, negative, neutral, or warning`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      console.warn('AI insights API call failed, using local insights:', e);
      return null;
    }
  },

  renderCards(insights) {
    if (!insights || !insights.length) {
      return `
        <div class="empty-state glass-card" style="grid-column:1/-1;padding:60px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;color:var(--text-muted);"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <h3>No insights yet</h3>
          <p>Log at least 5 trades to start seeing AI-powered insights about your trading patterns.</p>
        </div>
      `;
    }

    const sentimentBorder = {
      positive: 'var(--accent-secondary)',
      negative: 'var(--accent-red)',
      warning:  'var(--accent-amber)',
      neutral:  'var(--accent-primary)',
    };

    return insights.map(i => `
      <div class="glass-card animate-in" style="padding:22px 24px;border-left:4px solid ${sentimentBorder[i.sentiment] || sentimentBorder.neutral};">
        <div style="display:flex;gap:14px;align-items:flex-start;">
          <span style="font-size:1.8rem;flex-shrink:0;line-height:1;">${i.icon || '💡'}</span>
          <div>
            <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">${i.type}</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;">${i.title}</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.65;">${i.text}</div>
          </div>
        </div>
      </div>
    `).join('');
  },
};

// Extend Analytics with getSummaryForAI if not present
if (window.Analytics && !Analytics.getSummaryForAI) {
  Analytics.getSummaryForAI = function(trades) {
    const stats = this.compute(trades);
    return { stats, totalTrades: stats.total_trades };
  };
}
