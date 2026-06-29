/* ══════════════════════════════════════════════
   TRADEROS — Trade Modal (FIXED & WIRED)
══════════════════════════════════════════════ */

window.TradeModal = {
  _editId: null,

  open(id = null) {
    this._editId = id || null;
    const overlay = document.getElementById('trade-modal-overlay');
    if (!overlay) return;

    this._buildStrategyButtons();

    if (id) {
      const trade = DB.getTradeById(id);
      if (trade) this._populate(trade);
    } else {
      this._reset();
    }

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const title = document.getElementById('modal-title');
    if (title) title.textContent = id ? 'Edit Trade' : 'Add Trade';

    this._bindCalcs();
    if (window.lucide) lucide.createIcons();
  },

  close() {
    document.getElementById('trade-modal-overlay')?.classList.add('hidden');
    document.body.style.overflow = '';
    this._editId = null;
  },

  _buildStrategyButtons() {
    const group = document.getElementById('strategy-group');
    if (!group) return;
    const strats = DB.getStrategies();
    group.innerHTML = strats.map(s =>
      `<button type="button" class="toggle-btn" data-value="${s.id}">${s.name}</button>`
    ).join('');
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  _reset() {
    document.getElementById('trade-form')?.reset();
    const now = new Date();
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    s('trade-date', now.toISOString().split('T')[0]);
    s('trade-time', `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    s('trade-charges', DB.getSettings().broker_charges || 0);
    s('trade-confidence', 5);
    const cd = document.getElementById('confidence-display');
    if (cd) cd.textContent = '5';
    document.querySelectorAll('.btn-toggle-group .toggle-btn').forEach(b => b.classList.remove('active'));
    ['setup-preview','exit-preview'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const sn = document.getElementById('setup-screenshot'); if (sn) { sn.value = ''; delete sn.dataset.imgData; }
    const en = document.getElementById('exit-screenshot');  if (en) { en.value = ''; delete en.dataset.imgData; }
    const ssn = document.getElementById('setup-screenshot-name'); if (ssn) ssn.textContent = 'Choose image';
    const esn = document.getElementById('exit-screenshot-name');  if (esn) esn.textContent = 'Choose image';
    document.getElementById('trade-id').value = '';
    // Clear calculated fields
    ['trade-pnl','trade-risk','trade-reward','trade-rr'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.className = el.className.replace(/positive|negative/g,'').trim(); }
    });
  },

  _populate(t) {
    const s = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    document.getElementById('trade-id').value = t.id || '';
    s('trade-date', t.date); s('trade-time', t.time);
    s('trade-entry', t.entry); s('trade-exit', t.exit);
    s('trade-stoploss', t.stoploss); s('trade-target', t.target);
    s('trade-qty', t.quantity); s('trade-capital', t.capital_used);
    s('trade-charges', t.broker_charges); s('trade-pnl', t.net_profit);
    s('trade-rr', t.rr); s('trade-holding', t.holding_time);
    s('trade-session', t.session);
    s('trade-emotion-before', t.emotion_before); s('trade-emotion-after', t.emotion_after);
    s('trade-confidence', t.confidence || 5); s('trade-mistake', t.mistake);
    s('trade-lesson', t.lesson); s('trade-notes', t.notes);
    s('trade-tags', Array.isArray(t.tags) ? t.tags.join(', ') : (t.tags || ''));
    s('trade-entry-reason', t.entry_reason); s('trade-exit-reason', t.exit_reason);
    s('trade-market-structure', t.market_structure);
    const cd = document.getElementById('confidence-display');
    if (cd) cd.textContent = t.confidence || 5;
    this._setToggle('index-group', t.index);
    this._setToggle('direction-group', t.direction);
    this._setToggle('strategy-group', t.strategy_id);
    this._setToggle('market-structure-group', t.market_structure);
    if (t.setup_screenshot) this._showPreview('setup-preview', t.setup_screenshot, 'setup-screenshot-name');
    if (t.exit_screenshot)  this._showPreview('exit-preview',  t.exit_screenshot,  'exit-screenshot-name');
    const pnlEl = document.getElementById('trade-pnl');
    if (pnlEl && t.net_profit != null) {
      pnlEl.classList.toggle('positive', parseFloat(t.net_profit) > 0);
      pnlEl.classList.toggle('negative', parseFloat(t.net_profit) < 0);
    }
  },

  _setToggle(gid, value) {
    const g = document.getElementById(gid);
    if (!g || !value) return;
    g.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value));
  },

  _bindCalcs() {
    const slider = document.getElementById('trade-confidence');
    const disp   = document.getElementById('confidence-display');
    if (slider && disp) slider.oninput = () => { disp.textContent = slider.value; };

    ['trade-entry','trade-exit','trade-stoploss','trade-target','trade-qty','trade-charges'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => this._recalculate();
    });

    // Session auto-detect
    document.getElementById('trade-time')?.addEventListener('change', e => {
      const session = Helpers.detectSession(e.target.value);
      const sel = document.getElementById('trade-session');
      if (sel) sel.value = session;
    });

    // Screenshot handlers
    const ssi = document.getElementById('setup-screenshot');
    const esi = document.getElementById('exit-screenshot');
    if (ssi) ssi.onchange = () => this._handleScreenshot(ssi, 'setup-preview', 'setup-screenshot-name');
    if (esi) esi.onchange = () => this._handleScreenshot(esi, 'exit-preview',  'exit-screenshot-name');

    // Toggle groups
    ['index-group','direction-group','market-structure-group'].forEach(gid => {
      document.getElementById(gid)?.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById(gid).querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    });
  },

  _recalculate() {
    const g  = id => parseFloat(document.getElementById(id)?.value) || 0;
    const entry = g('trade-entry'), exit = g('trade-exit'), sl = g('trade-stoploss'),
          target = g('trade-target'), qty = g('trade-qty'), charges = g('trade-charges');

    if (entry && exit && qty) {
      const net = parseFloat(((exit - entry) * qty - charges).toFixed(2));
      const pnlEl = document.getElementById('trade-pnl');
      if (pnlEl) {
        pnlEl.value = net;
        pnlEl.classList.toggle('positive', net > 0);
        pnlEl.classList.toggle('negative', net < 0);
      }
    }
    if (entry && sl && qty) {
      const risk = Math.abs((entry - sl) * qty);
      const riskEl = document.getElementById('trade-risk');
      if (riskEl) riskEl.value = risk.toFixed(2);
      if (target) {
        const reward = Math.abs((target - entry) * qty);
        const rwEl = document.getElementById('trade-reward');
        if (rwEl) rwEl.value = reward.toFixed(2);
        if (risk > 0) {
          const rrEl = document.getElementById('trade-rr');
          if (rrEl) rrEl.value = (reward / risk).toFixed(2);
        }
      }
    }
  },

  _handleScreenshot(input, previewId, nameId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      input.dataset.imgData = e.target.result;
      this._showPreview(previewId, e.target.result, nameId);
    };
    reader.readAsDataURL(file);
  },

  _showPreview(previewId, src, nameId) {
    const el = document.getElementById(previewId);
    const nm = document.getElementById(nameId);
    if (el) el.innerHTML = `<img src="${src}" alt="Screenshot" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border-default);margin-top:8px;">`;
    if (nm) nm.textContent = '✓ Image loaded';
  },

  save() {
    const g  = id => (document.getElementById(id)?.value || '').trim();
    const gf = id => parseFloat(document.getElementById(id)?.value) || null;

    const date  = g('trade-date');
    const entry = gf('trade-entry');
    if (!date)  { Utils.toast('Please enter a trade date', 'warning'); return; }
    if (!entry) { Utils.toast('Please enter an entry price', 'warning'); return; }

    const getToggle = gid => document.getElementById(gid)?.querySelector('.toggle-btn.active')?.dataset.value || '';

    const holdingStr = g('trade-holding');
    let holding_time_min = 0;
    if (holdingStr) {
      const hm = holdingStr.match(/(\d+)\s*h/i);
      const mm = holdingStr.match(/(\d+)\s*m/i);
      if (hm) holding_time_min += parseInt(hm[1]) * 60;
      if (mm) holding_time_min += parseInt(mm[1]);
      if (!hm && !mm) holding_time_min = parseInt(holdingStr) || 0;
    }

    const tagsRaw = g('trade-tags');
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const editId = document.getElementById('trade-id')?.value || this._editId;

    const trade = {
      id:               editId || undefined,
      date,
      time:             g('trade-time'),
      index:            getToggle('index-group'),
      direction:        getToggle('direction-group'),
      strategy_id:      getToggle('strategy-group'),
      market_structure: getToggle('market-structure-group') || g('trade-market-structure'),
      entry,
      exit:             gf('trade-exit'),
      stoploss:         gf('trade-stoploss'),
      target:           gf('trade-target'),
      quantity:         gf('trade-qty'),
      capital_used:     gf('trade-capital'),
      broker_charges:   gf('trade-charges'),
      net_profit:       gf('trade-pnl'),
      rr:               gf('trade-rr'),
      holding_time:     holdingStr,
      holding_time_min,
      session:          g('trade-session'),
      emotion_before:   g('trade-emotion-before'),
      emotion_after:    g('trade-emotion-after'),
      confidence:       parseFloat(document.getElementById('trade-confidence')?.value) || 5,
      mistake:          g('trade-mistake'),
      lesson:           g('trade-lesson'),
      notes:            g('trade-notes'),
      tags,
      entry_reason:     g('trade-entry-reason'),
      exit_reason:      g('trade-exit-reason'),
      setup_screenshot: document.getElementById('setup-screenshot')?.dataset.imgData || null,
      exit_screenshot:  document.getElementById('exit-screenshot')?.dataset.imgData  || null,
    };

    DB.saveTrade(trade);
    this.close();
    App.refresh();
    Utils.toast(editId ? 'Trade updated ✓' : 'Trade saved ✓', 'success');
  },
};
