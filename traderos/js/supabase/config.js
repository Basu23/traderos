/* ══════════════════════════════════════════════
   TRADEROS — Supabase Config
   js/supabase/config.js
══════════════════════════════════════════════ */

/**
 * TraderOS Supabase configuration.
 * Users can update via Settings > Supabase Configuration.
 * Credentials are stored in localStorage for persistence.
 */

window.SupabaseConfig = {
  url: localStorage.getItem('traderos_supabase_url') || '',
  key: localStorage.getItem('traderos_supabase_key') || '',
  client: null,

  /** Initialize or re-initialize the Supabase client */
  init(url, key) {
    if (!url || !key) return null;
    try {
      this.url = url;
      this.key = key;
      this.client = window.supabase.createClient(url, key);
      localStorage.setItem('traderos_supabase_url', url);
      localStorage.setItem('traderos_supabase_key', key);
      return this.client;
    } catch (e) {
      console.warn('Supabase init failed:', e);
      return null;
    }
  },

  /** Check if client is available */
  isConnected() {
    return !!this.client;
  },

  /** Auto-init on load if credentials exist */
  autoInit() {
    const url = localStorage.getItem('traderos_supabase_url');
    const key = localStorage.getItem('traderos_supabase_key');
    if (url && key) this.init(url, key);
  }
};

// Auto-initialize on script load
window.SupabaseConfig.autoInit();
