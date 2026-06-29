/* ══════════════════════════════════════════════
   TRADEROS — Screenshots Component
   js/components/screenshots.js
══════════════════════════════════════════════ */

window.ScreenshotsManager = {
  upload(input) {
    const files = [...input.files];
    if (!files.length) return;
    let done = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        DB.saveScreenshot({ name: file.name, data: e.target.result, date: new Date().toISOString() });
        done++;
        if (done === files.length) {
          // Re-render screenshots page if active
          if (typeof Pages !== 'undefined') Pages.renderScreenshots();
          Utils.toast(`${done} screenshot(s) uploaded`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });
  },

  preview(src, name) {
    const lb  = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) {
      img.src = src;
      img.alt = name || 'Screenshot';
      lb.classList.remove('hidden');
    }
  },

  delete(id) {
    if (!confirm('Delete this screenshot?')) return;
    DB.deleteScreenshot(id);
    if (typeof Pages !== 'undefined') Pages.renderScreenshots();
    Utils.toast('Screenshot deleted', 'success');
  },

  renderAll() { return this.renderGrid(); },

  renderGrid() {
    const screenshots = DB.getScreenshots();
    if (!screenshots.length) {
      return `
        <div class="empty-state glass-card" style="grid-column:1/-1;padding:60px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;color:var(--text-muted);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <h3>No screenshots yet</h3>
          <p>Upload your trade setup and exit chart screenshots.</p>
        </div>
      `;
    }

    return screenshots.map(s => `
      <div class="glass-card" style="overflow:hidden;transition:all 0.25s;border:1px solid var(--border-subtle);"
           onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='var(--accent-primary)'"
           onmouseout="this.style.transform='';this.style.borderColor='var(--border-subtle)'">
        <div style="aspect-ratio:16/9;overflow:hidden;background:var(--bg-elevated);cursor:pointer;"
             onclick="ScreenshotsManager.preview('${s.data}','${s.name}')">
          <img src="${s.data}" alt="${s.name}"
               style="width:100%;height:100%;object-fit:cover;transition:transform 0.3s;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'">
        </div>
        <div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.78rem;font-weight:600;color:var(--text-primary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${Utils.formatDate(s.date, 'short')}</div>
          </div>
          <button style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--text-muted);transition:all 0.15s;border:none;background:none;cursor:pointer;"
                  onmouseover="this.style.background='rgba(255,77,109,0.1)';this.style.color='var(--accent-red)'"
                  onmouseout="this.style.background='none';this.style.color='var(--text-muted)'"
                  onclick="ScreenshotsManager.delete('${s.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  },
};

// Alias for app.js which calls Screenshots.upload() / Screenshots.renderAll()
window.Screenshots = window.ScreenshotsManager;
