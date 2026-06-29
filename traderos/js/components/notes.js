/* ══════════════════════════════════════════════
   TRADEROS — Notes Component
   js/components/notes.js
══════════════════════════════════════════════ */

window.NotesManager = {
  _editing: null,
  _filter:  'all',

  setFilter(f) {
    this._filter = f;
    // Re-render notes page if active
    const grid = document.getElementById('notes-grid');
    if (grid) grid.innerHTML = this.renderCards();
    // Update filter buttons
    document.querySelectorAll('[data-note-filter]').forEach(b => {
      b.className = `btn ${b.dataset.noteFilter === f ? 'btn-primary' : 'btn-ghost'} btn-sm`;
    });
  },

  renderCards() {
    const notes    = DB.getNotes();
    const filter   = this._filter;
    const filtered = notes.filter(n => filter === 'all' || n.type === filter);

    if (!filtered.length) {
      return `
        <div class="empty-state glass-card" style="grid-column:1/-1;padding:50px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;color:var(--text-muted);"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <h3>No journal entries</h3>
          <p>Start writing your trading reflections.</p>
          <button class="btn btn-primary" style="margin-top:8px;" onclick="NotesManager.openNew()">New Entry</button>
        </div>
      `;
    }

    return filtered.map(n => `
      <div class="glass-card animate-in" style="padding:18px 20px;transition:all 0.25s;cursor:default;"
           onmouseover="this.style.borderColor='var(--border-default)';this.style.transform='translateY(-2px)'"
           onmouseout="this.style.borderColor='var(--border-subtle)';this.style.transform=''">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-size:0.88rem;font-weight:700;color:var(--text-primary);">${n.title || 'Untitled'}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">
              ${Utils.formatDate(n.updated_at,'relative')}
              <span style="margin:0 4px;">·</span>
              <span style="background:rgba(108,99,255,0.12);color:var(--accent-primary);padding:1px 7px;border-radius:100px;font-weight:600;">${n.type || 'daily'}</span>
            </div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="NotesManager.edit('${n.id}')" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="NotesManager.delete('${n.id}')" title="Delete"
                    style="color:var(--text-muted);"
                    onmouseover="this.style.background='rgba(255,77,109,0.1)';this.style.color='var(--accent-red)'"
                    onmouseout="this.style.background='';this.style.color='var(--text-muted)'">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.65;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">
          ${n.content ? n.content.replace(/\n/g, '<br>') : ''}
        </div>
      </div>
    `).join('');
  },

  openNew() {
    this._editing = null;
    document.getElementById('note-title').value   = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-type').value    = 'daily';
    this._showModal('New Journal Entry');
  },

  edit(id) {
    const note = DB.getNotes().find(n => n.id === id);
    if (!note) return;
    this._editing = id;
    document.getElementById('note-title').value   = note.title   || '';
    document.getElementById('note-content').value = note.content || '';
    document.getElementById('note-type').value    = note.type    || 'daily';
    this._showModal('Edit Journal Entry');
  },

  save() {
    const title   = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const type    = document.getElementById('note-type').value;
    if (!content) { Utils.toast('Write something first', 'warning'); return; }
    DB.saveNote({ id: this._editing || undefined, title: title || 'Untitled', content, type });
    this._hideModal();
    // Refresh grid
    const grid = document.getElementById('notes-grid');
    if (grid) grid.innerHTML = this.renderCards();
    Utils.toast('Journal entry saved', 'success');
  },

  delete(id) {
    if (!confirm('Delete this journal entry?')) return;
    DB.deleteNote(id);
    const grid = document.getElementById('notes-grid');
    if (grid) grid.innerHTML = this.renderCards();
    Utils.toast('Entry deleted', 'info');
  },

  _showModal(title) {
    const modal = document.getElementById('note-editor-modal');
    const t     = document.getElementById('note-modal-title');
    if (modal) modal.classList.remove('hidden');
    if (modal) modal.classList.add('open');
    if (t)     t.textContent = title;
  },

  _hideModal() {
    const modal = document.getElementById('note-editor-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('open'); }
    this._editing = null;
  },
};

// Alias for backward compat with app.js which uses NotesPage
window.NotesPage = window.NotesManager;
