/* ══════════════════════════════════════════════
   TRADEROS — Calendar Component
   js/components/calendar.js
══════════════════════════════════════════════ */

window.CalendarPage = {
  _month: new Date().getMonth(),
  _year:  new Date().getFullYear(),

  render(containerId = 'calendar-widget') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const trades = DB.getAllTrades();
    const calData = {};
    for (const t of trades) {
      if (!t.date) continue;
      if (!calData[t.date]) calData[t.date] = { pnl: 0, count: 0 };
      calData[t.date].pnl   += parseFloat(t.net_profit) || 0;
      calData[t.date].count += 1;
    }

    TCharts.calendarHeatmap(containerId, trades);
  },
};
