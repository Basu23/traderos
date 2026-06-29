/* ══════════════════════════════════════════════
   TRADEROS — Psychology Component
   js/components/psychology.js
══════════════════════════════════════════════ */

window.PsychologyPage = {
  render(containerId = 'page-psychology') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const trades   = DB.getAllTrades();
    const closed   = trades.filter(t => t.net_profit !== undefined);
    const emotions = {};
    const mistakes = {};

    for (const t of closed) {
      if (t.emotion_before) {
        if (!emotions[t.emotion_before]) emotions[t.emotion_before] = { count: 0, wins: 0, pnl: 0 };
        emotions[t.emotion_before].count++;
        emotions[t.emotion_before].pnl += parseFloat(t.net_profit) || 0;
        if (parseFloat(t.net_profit) > 0) emotions[t.emotion_before].wins++;
      }
      if (t.mistake && t.mistake !== '') {
        if (!mistakes[t.mistake]) mistakes[t.mistake] = 0;
        mistakes[t.mistake]++;
      }
    }

    const total = closed.length || 1;
    const emotionEntries  = Object.entries(emotions).sort((a,b) => b[1].count - a[1].count);
    const mistakeEntries  = Object.entries(mistakes).sort((a,b) => b[1] - a[1]);

    const avgConf = closed.length
      ? (closed.filter(t => t.confidence).reduce((s,t) => s + (parseFloat(t.confidence)||0), 0) /
         (closed.filter(t => t.confidence).length || 1)).toFixed(1)
      : '—';

    container.innerHTML = `
      <div class="page-header animate-in">
        <div class="page-header-left">
          <h2>Psychology</h2>
          <p>Understand your emotional patterns and trading mistakes.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;" class="animate-in">

        <!-- Emotion Breakdown -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:16px;">Emotion Before Trade</h3>
          ${emotionEntries.length ? emotionEntries.map(([em, data]) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:0.82rem;color:var(--text-secondary);">${em}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);">${data.count} trades &middot; ${Math.round(data.wins/data.count*100)}% win</span>
              </div>
              <div style="background:var(--bg-elevated);border-radius:100px;height:6px;overflow:hidden;">
                <div style="height:100%;border-radius:100px;background:${data.pnl>=0?'var(--accent-secondary)':'var(--accent-red)'};width:${Math.round(data.count/total*100)}%;transition:width 0.6s;"></div>
              </div>
            </div>
          `).join('') : '<p style="color:var(--text-muted);font-size:0.82rem;">No data yet.</p>'}
        </div>

        <!-- Mistake Frequency -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:16px;">Mistake Frequency</h3>
          ${mistakeEntries.length ? mistakeEntries.map(([m, count]) => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:0.82rem;color:var(--text-secondary);">${m}</span>
                <span style="font-size:0.78rem;color:var(--accent-red);">${count}x</span>
              </div>
              <div style="background:var(--bg-elevated);border-radius:100px;height:6px;overflow:hidden;">
                <div style="height:100%;border-radius:100px;background:rgba(255,77,109,0.7);width:${Math.round(count/total*100)}%;transition:width 0.6s;"></div>
              </div>
            </div>
          `).join('') : '<p style="color:var(--text-muted);font-size:0.82rem;">No mistakes recorded.</p>'}
        </div>

        <!-- Avg Confidence -->
        <div class="glass-card" style="padding:22px;">
          <h3 style="font-size:0.9rem;font-weight:700;margin-bottom:16px;">Confidence Stats</h3>
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:3rem;font-weight:800;color:var(--accent-primary);font-family:var(--font-display);">${avgConf}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Average Confidence / 10</div>
          </div>
          <div style="height:6px;background:var(--bg-elevated);border-radius:100px;overflow:hidden;margin-top:8px;">
            <div style="height:100%;background:var(--grad-primary);border-radius:100px;width:${parseFloat(avgConf)/10*100||0}%;transition:width 0.6s;"></div>
          </div>
        </div>

      </div>

      <!-- Psychology Chart -->
      <div class="glass-card chart-card animate-in" style="padding:20px;margin-top:16px;">
        <div style="font-size:0.9rem;font-weight:700;margin-bottom:16px;">Emotion vs. Average P&amp;L</div>
        <div style="height:240px;"><canvas id="psych-emotion-chart"></canvas></div>
      </div>
    `;

    setTimeout(() => TCharts.psychologyChart('psych-emotion-chart', closed), 60);
  },
};
