# TraderOS — Personal AI-Powered Trading Journal

A single-user, premium dark-mode trading journal for Nifty/BankNifty/Sensex options trading.
Built with vanilla HTML/CSS/JS, Chart.js, and optional Supabase cloud sync.

---

## 1. What's in this folder

```
traderos/
├── index.html
├── app.js                  ← main app logic (router, pages, trade modal, controllers)
├── vercel.json
├── supabase_schema.sql     ← run this in Supabase if you want cloud sync
├── css/
│   ├── design-system.css   ← tokens/variables, must load first
│   ├── layout.css
│   ├── components.css
│   ├── login.css
│   ├── dashboard.css
│   ├── trade-form.css
│   └── analytics.css
└── js/
    ├── supabase/
    │   ├── database.js     ← window.DB — localStorage-first data layer
    │   └── config.js       ← window.SupabaseConfig — optional cloud sync
    ├── utils/
    │   ├── helpers.js       ← window.Helpers
    │   └── analytics.js     ← window.Analytics — all stat calculations
    ├── charts/
    │   └── charts.js        ← window.TCharts — all Chart.js renderers
    └── components/
        ├── toast.js         ← window.Utils + window.Icons
        ├── modal.js         ← (superseded by app.js's own TradeModal — see note below)
        ├── calendar.js       ← (superseded — see note below)
        ├── notes.js          ← (superseded — see note below)
        ├── psychology.js    ← window.PsychologyPage — actively used
        ├── screenshots.js   ← window.ScreenshotsManager / window.Screenshots — actively used
        └── ai-insights.js   ← window.AIInsights — actively used
```

---

## 2. Bugs I found and fixed before this would even load

You said not to ship placeholder code, so I actually traced every cross-file
reference instead of assuming it worked. Here's what was broken:

1. **`database.js` (`window.DB`) was never included in `index.html`.**
   Every single page — login, dashboard, trade modal, settings — calls `DB.*`.
   Without this script tag the app would throw immediately on load and the
   login screen would never even respond to a click. **Fixed**: added
   `<script src="js/supabase/database.js"></script>` before `config.js`.

2. **`app.js` calls `Screenshots.upload()` / `Screenshots.renderAll()`,
   but `screenshots.js` only defines `window.ScreenshotsManager` with a
   method called `renderGrid()`.** That's a silent `Screenshots is not
   defined` crash the moment you open the Screenshots page or try to
   upload one. **Fixed**: added `window.Screenshots = window.ScreenshotsManager`
   alias and a `renderAll()` method in `screenshots.js`.

3. **Missing `#sidebar-overlay` element.** `app.js` and `analytics.css`
   both reference it (for closing the mobile sidebar by tapping outside
   it), but the `<div>` didn't exist in `index.html`. Harmless on desktop,
   but on mobile the sidebar couldn't be dismissed by tapping the backdrop.
   **Fixed**: added the div.

4. **Duplicate/overlapping logic** — `app.js` actually contains its own
   complete implementations of `TradeModal`, `Login`, `Shell`, `Router`,
   `Pages`, `HistoryCtrl`, `NotesCtrl`, and `SettingsCtrl`. Three of the
   separately-uploaded "component" files (`modal.js`, `calendar.js`,
   `notes.js`) duplicate functionality that `app.js` already implements
   and actually uses instead (via JS scoping rules, `app.js`'s versions
   win for any unqualified reference). They're harmless to keep loaded —
   I left them in for now since removing them risks breaking something I
   haven't tested — but **functionally they're dead code**. If you want a
   leaner bundle later, those three files can be deleted along with their
   `<script>` tags, with no behavior change.

After these fixes I:
- Ran `node --check` on every JS file — all pass, zero syntax errors.
- Cross-referenced every `Object.method()` call in `app.js` against every
  file's actual exports (DB, Analytics, TCharts, Helpers, Utils, Icons,
  AIInsights, PsychologyPage, SupabaseConfig) — all match.
- Cross-referenced every `getElementById('...')` call in `app.js` against
  every `id="..."` in `index.html` — all 81 IDs now resolve.
- Verified every sidebar nav `data-page` value has a matching
  `id="page-..."` section for the router to activate.

The app is functionally complete and internally consistent as of this fix.

---

## 3. Running it locally

No build step — it's static files. From this folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL. Default passcode is **`trader123`** (change it
immediately in Settings → Security once you're in).

---

## 4. Data storage — how it actually works

**Local-first by design.** Every trade, note, screenshot, and setting is
written to `localStorage` first via `window.DB`. The app is fully
functional with zero backend setup — this matches the "for one user only,
on one device" brief.

**Optional cloud sync via Supabase.** If you fill in a Supabase URL + anon
key in Settings, `DB.saveTrade()` / `DB.deleteTrade()` will also push to a
`trades` table in the background (`_syncTrade`, `_deleteSyncTrade`), and
`DB.syncFromSupabase()` can pull everything back down. This is genuinely
optional — if you never set up Supabase, the app just silently skips the
sync calls (`if (!window.SupabaseConfig?.isConnected()) return;`) and
works entirely offline.

**To enable Supabase sync:**

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL Editor → paste the contents of `supabase_schema.sql` → Run.
3. Go to Project Settings → API, copy your **Project URL** and **anon
   public key**.
4. In TraderOS → Settings → Supabase Configuration, paste both in and
   click Save. You should see "✓ Connected to Supabase."

Note: this uses the anon key with row-level security wide open
(`using (true)`), which is fine because this is a single-user app and the
URL/key only live in your own browser's localStorage — just don't commit
them to a public repo or share the project's API keys.

---

## 5. AI Insights — one limitation to know about

`ai-insights.js` calls `https://api.anthropic.com/v1/messages` **directly
from the browser with no API key attached**. This will fail in production
(Anthropic's API requires an `x-api-key` header, and you should never put
a real API key in client-side code anyway — anyone could open devtools and
steal it).

This is not a bug that breaks the app — `app.js` already wraps the call in
a `.catch(()=>null)` and falls back to `Analytics.generateInsights()`,
which is a solid local rule-based insights engine (pattern detection on
win rate by hour/day/strategy, streak analysis, etc.) that runs entirely
client-side with your own trade data. **So AI Insights works today, just
using the local engine, not a live Claude call.**

If you want genuinely AI-generated insights (an LLM reading your stats and
writing custom commentary), you need a tiny serverless proxy so your API
key never reaches the browser. Since you're deploying on Vercel, the
cleanest path is a Vercel Serverless Function:

```js
// api/insights.js  (Vercel auto-detects this as a serverless function)
export default async function handler(req, res) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();
  res.status(response.status).json(data);
}
```

Then add `ANTHROPIC_API_KEY` in Vercel → Project Settings → Environment
Variables, and change the `fetch` URL in `js/components/ai-insights.js`
from `https://api.anthropic.com/v1/messages` to `/api/insights`. I didn't
make this change myself since it requires your own API key and a decision
on whether you want to spend API credits on this — happy to wire it up if
you want it.

---

## 6. Deploying to Vercel

**Option A — Vercel CLI (fastest):**

```bash
npm i -g vercel
cd traderos
vercel --prod
```

Follow the prompts (link to a new project, accept defaults — it's a
static site, no build command needed).

**Option B — GitHub + Vercel dashboard:**

```bash
cd traderos
git init
git add .
git commit -m "TraderOS initial deploy"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

Then on [vercel.com](https://vercel.com) → New Project → Import the repo.
Framework preset: **Other**. Build command: leave blank. Output directory:
leave blank (root). Deploy.

Either way, you'll get a `https://your-project.vercel.app` URL. The whole
app — login, dashboard, trade entry, analytics, charts — works immediately
since there's no server-side requirement for the core features.

---

## 7. Changing your passcode

Default is `trader123`. Change it in **Settings → Security** the first
time you log in — don't leave the default in a publicly-reachable
deployment, since there's no rate-limiting on login attempts (this is a
single-user, client-side-only auth check, appropriate for personal use but
not hardened against brute force).

---

## 8. What's actually implemented (everything from the brief)

- ✅ Passcode login with remember-me + session persistence + logout
- ✅ Dashboard with 20 KPI cards (P&L breakdowns, win rate, RR, streaks,
  drawdown, psychology score, etc.)
- ✅ 3 one-click strategy buttons (renamed in Settings)
- ✅ Full Add/Edit Trade modal — all fields from the brief including the
  extra ones you asked for (setup/exit screenshots, entry/exit reason,
  market structure, session, auto-calculated P&L/risk/reward/RR)
- ✅ Trade History — search, filter, sort, edit, delete, pagination,
  CSV export/import
- ✅ Analytics page — win rate, profit factor, expectancy, drawdown,
  strategy/day/hour/index/direction/emotion/mistake breakdowns
- ✅ 13+ chart types via Chart.js (equity curve, calendar heatmap,
  win/loss pie, RR distribution, drawdown curve, psychology chart, etc.)
- ✅ Screenshot upload, fullscreen lightbox preview, delete
- ✅ Daily/weekly/monthly journal notes with rich text
- ✅ Settings — passcode change, strategy renaming, capital/risk settings,
  Supabase config, backup/restore (full JSON export/import), danger zone
- ✅ AI Insights — local rule-based engine by default, live-LLM-ready if
  you wire up the serverless proxy above
- ✅ Offline-first localStorage with optional Supabase background sync

---

## 9. If something breaks after you start customizing

Most likely failure mode going forward will be the same class of bug I
found above: a function in one file calling a method name that doesn't
exist in another. Quick way to check yourself:

```bash
grep -oE '\b[A-Z][A-Za-z]*\.[a-zA-Z_]+' app.js | sed 's/\..*//' | sort -u
```

That lists every global object `app.js` calls — cross-check each against
the file that's supposed to define it.
