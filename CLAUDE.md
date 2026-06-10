# dYdX Market Monitor — Agent Guide

This document gives a future agent everything needed to navigate, extend, and
restructure this codebase confidently. Read it completely before writing any
code.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure — Current State](#2-project-structure--current-state)
3. [Auth & Access Control](#3-auth--access-control)
4. [Routing & Data Flow](#4-routing--data-flow)
5. [Key Patterns](#5-key-patterns)
6. [dYdX Indexer API Reference](#6-dydx-indexer-api-reference)
7. [Upstream Services & Environment Variables](#7-upstream-services--environment-variables)
8. [MM Config Reference](#8-mm-config-reference)
9. [Fills — Reference Implementation](#9-fills--reference-implementation)
10. [Known Limitations & Planned Work](#10-known-limitations--planned-work)
11. [Adding New Features](#11-adding-new-features)
12. [Hard Rules](#12-hard-rules)

Deferred bugs and audit findings live in `KNOWN-ISSUES.md` at the repo root.

---

## 1. Tech Stack

| Concern | Library / Version |
|---|---|
| Framework | SvelteKit 2.50 |
| Component model | Svelte **5 runes** (`$state`, `$derived`, `$effect`, `$props`) |
| Styling | Tailwind CSS 4 (Vite plugin — no `tailwind.config.js`) |
| Data fetching (client) | sswr (`useSWR`) |
| Schema validation | Zod |
| Charts | Chart.js + chartjs-adapter-date-fns |
| Deployment | Vercel (adapter-vercel on Vercel builds, adapter-auto locally) |
| Language | TypeScript strict |

**Svelte 5 runes — key rules:**
- All reactive state uses runes: `let x = $state(0)`, `const y = $derived(x + 1)`, `$effect(() => { ... })`
- Props: `const { foo, bar } = $props()` — no `export let`
- Store reads: `$store` is still valid (e.g., `$page.url.searchParams`)
- Never mix Options API (`export let`, `$:`, reactive statements) with runes in the same component

---

## 2. Project Structure — Current State

```
src/
  app.d.ts                    # Svelte app type declarations
  hooks.server.ts             # Auth gate — see §3
  routes/
    +page.svelte              # Home dashboard — cards linking to Markout PnL, SLA, Overview, Live Metrics
    +layout.svelte            # Root layout (sets dark background)
    login/
      +page.server.ts         # Login form action (rate limit, password check, cookie)
      +page.svelte            # Password entry form
    mm/
      +page.server.ts         # MM list server load
      +page.svelte            # MM list page (/mm) — nickname, address, 24h activity status
      [slug]/
        +page.server.ts       # Resolves MM config; sets from/to
        +page.svelte          # Main MM detail page (tabs + range selector)
    markets/
      +page.svelte            # Live market metrics (/markets) — table + treemap toggle, filters
    overview/
      +page.svelte            # Per-ticker market health dashboard (/overview) — 20+ column
                              # table, advanced filters, column visibility (localStorage)
    markoutPnL/
      +page.server.ts
      +page.svelte            # Global markout PnL table + horizon curve (2s–300s), CSV export
      [mm]/
        +page.server.ts, +page.ts
        +page.svelte          # Per-MM markout detail (summary + per-ticker rows)
    sla/
      +page.server.ts
      +page.svelte            # SLA compliance landing — all tracked MMs, date range
      +error.svelte           # Error boundary for SLA pages
      [slug]/
        +page.server.ts, +page.ts
        +page.svelte          # Per-MM SLA detail — uptime/liquidity/config tables, CSV export
    api/                      # See §4 for the full endpoint table
      mms/  summary/  uptime/[slug]/  liquidity/  liquidity-sla/  depth/  depth-sla/
      fills/  fills-raw/  markets/  overview/
      mm-quotes/{overview,detail}/  pairdepth/overview/
      trading-hours/{summary,detail}/  time-in-book/{overview,detail}/
      sla/  sla/[slug]/{,liquidity,uptime,config}/
      pnl/  pnl/[slug]/  funding/  funding/[slug]/
      markout/{series,overview,meta}/  markout/mm/[slug]/

  lib/
    server/
      auth.ts                  # Session tokens, password check, login rate limiting — see §3
    features/                  # Feature-based modules (types, schemas, components per feature)
      fills/
        types.ts               # IndexerFill, FillTickerRow, FillsTimePoint, FillsApiResponse
        schemas.ts             # FillsResponseSchema
        db.ts                  # IndexedDB cache for raw fills
        client.ts              # loadFillsData() — browser-side indexer pagination with
                               # streaming progress; checks IndexedDB first
        aggregator.ts          # Pure function: IndexerFill[] → FillsApiResponse
        FillsTab.svelte        # Main fills tab (reference implementation)
        FillsChart.svelte      # Time series line chart
      summary/
        types.ts, schemas.ts, SummaryTab.svelte
      uptime/
        UptimeTab.svelte
      liquidity/
        schemas.ts, LiquidityTab.svelte, LiquidityChart.svelte (unused)
      depth/
        schemas.ts, DepthTab.svelte, DepthChart.svelte (unused)
      markout/
        types.ts               # MarkoutHorizon (2s–300s), MarkoutView ('dydx'|'index'),
                               # MarkoutOverviewRow, MarkoutMmResponse, Pnl/FundingOverviewResponse
        schemas.ts             # MarkoutSeriesResponseSchema, MarkoutOverviewResponseSchema, ...
        MarkoutViewToggle.svelte
        MarkoutHorizonChart.svelte
        MarkoutInfoCard.svelte
        export.js              # CSV builders for global markout table
      mm-quotes/
        types.ts, schemas.ts   # MmQuotesOverviewTicker, MmQuotesDetailMm, ... (no components —
                               # consumed by /overview page)
      pairdepth/
        types.ts, schemas.ts   # PairDepthOverviewTicker, PairDepthWindow, ... (no components —
                               # consumed by /overview page)
      trading-hours/
        types.ts, schemas.ts   # TradingHoursSummaryTicker/Response, session keys (no components —
                               # consumed by /overview trading-hours expander)
      time-in-book/
        types.ts, schemas.ts   # TibMm/TibTicker/TibDetailResponse (no components —
                               # consumed by /overview MM-liquidity expander)
      sla/
        types.ts, schemas.ts   # SLATickerRow, SLAUptime/LiquidityResponse
        export.ts              # buildSlaUptimeCsv, buildSlaLiquidityCsv
    shared/                    # Cross-feature shared code
      types.ts                 # MmActivity
      mm-activity.ts           # fetchMmActivity() — paginates indexer /v4/fills for
                               # last-fill/volume/ticker-count; getMmTableActivityCopy()
      components/
        AddressDisplay.svelte  BpsCell.svelte  PctCell.svelte  UsdCell.svelte
        EmptyState.svelte  ErrorBanner.svelte  LoadingSpinner.svelte
        ProgressLoader.svelte  # Animated fake-progress bar
        DateRangeSelector.svelte # Calendar-based range picker (used by /overview, /sla,
                               # /markoutPnL); props: from, to, min, max, label,
                               # optional paramFromKey/paramToKey
        skeletons/
          ChartSkeleton.svelte  TableSkeleton.svelte
      sla/
        metadata.ts            # getSlaMetadata() — fetches SLA tier/group definitions
        schemas.ts             # UptimeTickerSchema, UptimeResponseSchema, LevelPctSchema
        types.ts               # UptimeTicker (shared across Summary, Uptime, Fills tabs)
    api/
      types.ts                 # MmInfo type only (feature types live in features/)
      schemas.ts               # MmInfoSchema, MmsResponseSchema only
      client.ts                # apiFetch() — server-side fetch wrapper with 8s cache
    config/
      mms.ts                   # MmConfig interface + getMmBySlug / getMmSubaccounts helpers
    components/
      layout/
        Header.svelte          # Top nav (/, /markets, /markoutPnL, /overview, /sla);
                               # publishes --app-header-h CSS var
        PageShell.svelte       # Page wrapper (max-w, padding; optional `wide` prop)
        StatusBar.svelte
      mm/
        MmHeader.svelte        # Address + date range display
        MmCard.svelte          # Card used on the MM list page
        TabPrefetcher.svelte   # Invisible component — fires SWR for all tabs on mount
        TimeRangeSelector.svelte # Global range selector (7d/30d currently disabled)
      markets/
        TreemapView.svelte
    stores/
      nicknames.ts             # User-editable address nicknames (localStorage)
      prefetch.ts              # Shared prefetch trigger store
    utils/
      dates.ts                 # Preset type + presetToFromTo + isCurrent24hRange
      format.ts                # Number/currency formatters
      params.ts                # updateParams — URL search param helper
      request-cache.ts         # In-memory server-side request dedup + mapWithConcurrency

mm-config.json               # MM address + subaccount config (committed, names kept anonymous)
KNOWN-ISSUES.md              # Deferred bugs / audit findings
```

### Dependency Rules

```
features/* → shared/*   ✓  allowed
features/* → lib/utils/* ✓  allowed
shared/*   → features/* ✗  NEVER
features/A → features/B ✗  NEVER
```

Features must never import from other features. All cross-cutting concerns
go in `shared/` or `lib/utils/`.

---

## 3. Auth & Access Control

The site is password-protected. A single shared password (env `SITE_PASSWORD`)
gates all **page** routes; `/api/*` is intentionally left open (decision made
2026-06: data is considered public).

**`src/hooks.server.ts`** — the gate:
- Exempt: `/login`, `/api/**`, `/_app/**`, `/favicon.ico`
- Everything else: `verifyToken(cookie)` or redirect to `/login?redirect=<path>`

**`src/lib/server/auth.ts`** — exports:

| Function | Purpose |
|---|---|
| `createToken()` | HMAC-SHA256 signed token `issuedAt.sig`, 30-day expiry |
| `verifyToken(token?)` | Timing-safe signature + age check |
| `checkPassword(input)` | Timing-safe compare against `SITE_PASSWORD` |
| `checkRateLimit(ip)` / `recordFailedAttempt(ip)` / `clearAttempts(ip)` | 5 failed attempts → 15-min lockout (in-memory, per-instance) |

Constants: `AUTH_COOKIE = 'auth'`, `SESSION_MAX_AGE_SECONDS = 30 days`.

**Login flow** (`src/routes/login/+page.server.ts`): rate-limit check by IP
(`x-forwarded-for` first, then `getClientAddress()`) → `checkPassword` →
set httpOnly/secure/lax cookie → redirect to sanitized `?redirect=` target.

---

## 4. Routing & Data Flow

### Pages

| Route | What it renders |
|---|---|
| `/` | Dashboard home — cards linking to the sections below (MM Performance card disabled) |
| `/mm` | MM list — nickname, address, 24h activity tone (good/warn/bad) via `fetchMmActivity()` |
| `/mm/[slug]` | MM detail — tabs: `summary, uptime, liquidity, depth, fills` |
| `/markets` | Live market metrics — table/treemap toggle, status/type/funding filters, search |
| `/overview` | Per-ticker market health — vol z-score, depth, slippage, MM count, sessions; advanced numeric filters (k/m/b shorthand), MM filter, column visibility persisted to localStorage |
| `/markoutPnL` | Global markout PnL table + horizon curve; view toggle (dYdX mid vs Index mid); CSV |
| `/markoutPnL/[mm]` | Per-MM markout detail |
| `/sla` | SLA compliance landing — all tracked MMs, date range |
| `/sla/[slug]` | Per-MM SLA detail — uptime/liquidity/config, CSV exports |
| `/login` | Password form |

### API routes

Upstream legend: **indexer** = dYdX indexer direct, **apiFetch** = internal
upstream via `$lib/api/client`, **API_BASE_URL** / **PAIRDEPTH_API_BASE_URL** =
external services via `$env/static/private` (plain `fetch`).

| Endpoint | Params | Upstream |
|---|---|---|
| `GET /api/markets` | — | indexer `/v4/perpetualMarkets` (15s cache) |
| `GET /api/overview` | — | indexer + apiFetch + CoinGecko (60s cache) |
| `GET /api/mm-quotes/overview` | — | apiFetch (30s cache) |
| `GET /api/mm-quotes/detail` | — | apiFetch (30s cache) |
| `GET /api/trading-hours/summary` | week (optional) | apiFetch (5min cache) |
| `GET /api/trading-hours/detail` | week (optional) | apiFetch (5min cache) |
| `GET /api/time-in-book/overview` | — | apiFetch (60s cache) |
| `GET /api/time-in-book/detail` | — | apiFetch (60s cache) |
| `GET /api/pairdepth/overview` | — | PAIRDEPTH_API_BASE_URL (30s cache) |
| `GET /api/mms` | — | apiFetch |
| `GET /api/summary` | slug, from, to, ticker | apiFetch |
| `GET /api/uptime/[slug]` | from, to, tickSizeAdj | apiFetch |
| `GET /api/liquidity` | slug, bps, side, from, to, bucket, ticker | apiFetch |
| `GET /api/liquidity-sla` | slug, from, to | apiFetch |
| `GET /api/depth` | slug, usd, side, from, to, bucket, ticker | apiFetch |
| `GET /api/depth-sla` | slug, from, to | apiFetch |
| `GET /api/fills` | slug, from, to | indexer `/v4/fills` paginated — aggregated; used by TabPrefetcher and as `loadFillsData` fallback |
| `GET /api/fills-raw` | slug, from, to | **legacy — no longer referenced by any client code** (FillsTab paginates the indexer directly in the browser via `fills/client.ts`) |
| `GET /api/sla` | — | API_BASE_URL |
| `GET /api/sla/[slug]{,/liquidity,/uptime,/config}` | from, to where applicable | API_BASE_URL |
| `GET /api/pnl{,/[slug]}` | view, from, to (forwarded) | API_BASE_URL |
| `GET /api/funding{,/[slug]}` | view, from, to (forwarded) | API_BASE_URL |
| `GET /api/markout/{series,overview,meta}` | horizon, view, from, to (forwarded) | API_BASE_URL |
| `GET /api/markout/mm/[slug]` | view, from, to (forwarded) | API_BASE_URL |

### MM detail page (`/mm/[slug]`)

```
+page.server.ts
  └── Reads mm-config.json via getMmBySlug(slug)
  └── Computes from/to from URL params (defaults: 24h ago → today)
  └── Returns { mm, from, to }

+page.svelte (client)
  └── Renders tab nav + TimeRangeSelector
  └── Renders TabPrefetcher (fires SWR for all tab keys on mount)
  └── Renders active tab component
  └── FillsTab rendered BEFORE isSupportedRange gate (fills works on any range)
  └── Other tabs: only rendered if isCurrent24hRange(from, to)
```

### Tab data fetching pattern (standard tabs)

All tabs except Fills follow this pattern:

```svelte
const key = $derived(`/api/${endpoint}?slug=${slug}&from=${from}&to=${to}`)
const { data, error, isLoading } = useSWR<T>(() => key, {
  refreshInterval: 60_000,
  dedupingInterval: 1_800_000
})
// Show skeleton while loading, stale data with overlay while refreshing
```

### Fills tab data fetching (special — see §9)

Fills uses a custom fetcher that checks IndexedDB before hitting the server.

---

## 5. Key Patterns

### 5.1 sswr stale-data problem & dataIsFresh

**The problem:** sswr retains the previous key's `$data` while fetching a new
key. If you render based on `$isLoading` alone, you will show stale data
for the new range immediately (before the fetch completes).

**The fix — `dataIsFresh` pattern:**

```ts
// After fetching, response includes the request params:
// { from, to, ...payload }

const dataIsFresh = $derived(
  Boolean($data && $data.from === fillsFrom && $data.to === fillsTo)
)
const showSkeleton = $derived(!dataIsFresh && !$error)
const showRefreshOverlay = $derived(dataIsFresh && $isLoading)
```

Rules:
- `showSkeleton = true` → range changed, no fresh data yet → full skeleton
- `showRefreshOverlay = true` → data is fresh but background refresh running → subtle overlay
- Never show table rows if `!dataIsFresh` — user would see old range's numbers

**Apply this pattern whenever:** The SWR key encodes date range params and
the component must not show stale data for the new range.

(Known gap: SummaryTab currently only checks `ticker`, not `from`/`to` —
see `KNOWN-ISSUES.md` #2.)

### 5.2 URL param state with updateParams

All UI state that should survive page reload (tab, range, filters) is stored
in URL search params:

```ts
import { updateParams } from '$lib/utils/params'

// Write — merges into current URL without navigation
updateParams({ tab: 'fills', fillsFrom: '2026-03-01', fillsTo: '2026-03-14' })

// Read — always derive from $page.url.searchParams
const activeTab = $derived($page.url.searchParams.get('tab') ?? 'summary')
```

Never store such state in `$state` variables directly — it won't survive
navigation or refresh.

### 5.3 SLA grouping pattern

Used in SummaryTab and FillsTab. The pattern:

1. Fetch uptime data (background, same range): `GET /api/uptime/[slug]?...`
2. Build `tickerGroupMap: Map<ticker, group>` from `uptimeData.tickers`
3. Toggle `groupEnabled` via a URL param (e.g., `summaryGroup`, `fillsGroup`)
4. `groupedSections` is `$derived` — groups rows, computes group-level aggregates
5. `collapsedGroups` is `$state<Record<string, boolean>>` — initialised `true`
   (all collapsed) via `$effect` that watches `groupedSections`

```ts
// Initialise all groups as collapsed, preserve existing collapse state
$effect(() => {
  if (!groupedSections) { collapsedGroups = {}; return }
  const next: Record<string, boolean> = {}
  for (const { group } of groupedSections) {
    next[group] = collapsedGroups[group] ?? true  // default: collapsed
  }
  // only update if shape/values changed (avoids infinite loop)
  if (!shallowEqual(next, collapsedGroups)) collapsedGroups = next
})
```

### 5.4 Sortable table pattern

```ts
let sortCol = $state<'ticker' | 'volume' | ...>('volume')
let sortDir = $state<'asc' | 'desc'>('desc')

function toggleSort(col: typeof sortCol) {
  if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
  else { sortCol = col; sortDir = col === 'ticker' ? 'asc' : 'desc' }
}

const sorted = $derived([...$data.rows].sort((a, b) => {
  const mul = sortDir === 'asc' ? 1 : -1
  if (sortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker)
  const av = (a[sortCol] ?? -Infinity) as number
  const bv = (b[sortCol] ?? -Infinity) as number
  return mul * (av - bv)
}))
```

In the template, sort indicators: `{#if sortCol === col}<span>{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}`

### 5.5 Chart.js setup

Reference: `FillsChart.svelte` and `MarkoutHorizonChart.svelte`.

- Always `import { Chart, ... } from 'chart.js'` and `Chart.register(...)` manually (no auto-import)
- `import 'chartjs-adapter-date-fns'` for time axis
- Canvas in `onMount`, destroyed in `onDestroy`
- Dark theme: background `transparent`, grid `rgba(255,255,255,0.06)`, ticks `#71717a`
- Font: `"IBM Plex Sans", system-ui, sans-serif` (loaded via app.html or global CSS)
- Update chart reactively: `$effect(() => { if (chart) { chart.data = ...; chart.update('none') } })`

### 5.6 apiFetch (server-side only)

```ts
import { apiFetch } from '$lib/api/client'
// Wraps internal API calls from server routes
// Adds 8-second in-memory dedup cache keyed by URL
// NOT used in fills routes — fills fetches the dYdX indexer directly
// NOT used by sla/pnl/funding/markout routes — those hit API_BASE_URL with plain fetch
```

### 5.7 Progress loader

`ProgressLoader.svelte` props: `{ estimatedMs: number, active: boolean }`

Internally runs a `setInterval` that advances from 0 → 88% linearly over
`estimatedMs`, then snaps to 100% when `active` becomes `false`.

Use it for operations with no real progress signal (e.g., multi-page indexer
pagination). Set `estimatedMs` based on observed latency:
- 24h: ~3 000 ms
- 7d: ~7 000 ms
- 14d / 30d: ~8 000 ms (capped at 20 pages regardless)

---

## 6. dYdX Indexer API Reference

Base URL: `https://indexer.dydx.trade`

### Fills endpoint

```
GET /v4/fills
  ?address=dydx1...
  &subaccountNumber=1
  &limit=500
  &createdBeforeOrAt=2026-03-14T23:59:59.999Z
```

**Pagination (cursor-based):**
- No page numbers, no total count in response
- Pass `createdBeforeOrAt=<oldest_fill.createdAt>` for each subsequent page
- Stop conditions:
  1. `body.fills.length === 0` — no more fills
  2. `oldest.createdAt < fromTs` — we've gone past the requested range
  3. `body.fills.length < PAGE_LIMIT` — last page
  4. `page === MAX_PAGES - 1` — cap reached (set `isCapped = true`)
- Current cap: `MAX_PAGES = 20`, `PAGE_LIMIT = 500` → max 10 000 fills/subaccount

**Fill object schema:**

```ts
interface IndexerFill {
  id: string               // UUID
  side: 'BUY' | 'SELL'
  liquidity: 'MAKER' | 'TAKER'
  type: string             // Usually 'LIMIT'
  market: string           // e.g. 'ETH-USD'
  price: string            // Decimal string
  size: string             // Decimal string
  fee: string              // Decimal string — NEGATIVE = maker rebate earned
  createdAt: string        // ISO 8601, e.g. '2026-03-14T12:34:56.789Z'
  subaccountNumber: number
  // Optional fields (newer fills only):
  positionSizeBefore?: string
  entryPriceBefore?: string
  positionSideBefore?: string
}
```

**Volume calculation:** `volume = parseFloat(price) * parseFloat(size)`

**Fee sign convention:**
- Negative fee → maker rebate (MM earned money)
- Positive fee → taker fee (MM paid money)
- `netFees = sum(fees)` — negative total means net rebate earned

**No server-side market filter** — all fills for the address/subaccount are
returned. Filter `market` client-side if needed.

---

## 7. Upstream Services & Environment Variables

| Env var | Kind | Used by | Purpose |
|---|---|---|---|
| `SESSION_SECRET` | dynamic/private | `lib/server/auth.ts` | HMAC key for session tokens (≥16 chars, required) |
| `SITE_PASSWORD` | dynamic/private | `lib/server/auth.ts` | Shared site password (required) |
| `API_BASE_URL` | static/private | sla, pnl, funding, markout API routes | Internal analytics API base URL |
| `PAIRDEPTH_API_BASE_URL` | static/private | pairdepth API route | PairDepth service base URL |

`.env` is gitignored; set the same vars in Vercel project settings for deploys.

Upstreams summary: dYdX indexer (markets, fills, mm-activity), internal
analytics API via `apiFetch` (summary/uptime/liquidity/depth/mm-quotes/
overview), `API_BASE_URL` service (sla/pnl/funding/markout), CoinGecko
(overview trending/listings).

---

## 8. MM Config Reference

**File:** `mm-config.json` — committed to the public repo. Names must stay anonymous —
use generic slugs like `mm-01`, `mm-02`, etc. Never put real firm names here. The real
slug → firm name mapping is maintained privately outside the repo (e.g. a private
spreadsheet). The slugs `mm1`, `mm2`, `mm3` are locked for backwards compatibility
and must not be renamed. New entries use the `mm-NN` format (e.g. `mm-04`).

Current state (2026-06): ~20 entries — legacy `mm1`/`mm2`/`mm3` plus
`mm-01` … `mm-19`.

```json
[
  {
    "slug": "mm1",
    "name": "MM1",
    "address": "dydx1javmgpng0a2dpdpmnqpt0qxw67laaay26yymnp",
    "subaccounts": [1, 2]
  },
  {
    "slug": "mm-04",
    "name": "MM-04",
    "address": "dydx1q869gyjwanxhw5xdgfg67pg3y8gjeuzth6u6zl",
    "subaccounts": [0]
  }
]
```

**Helpers in `src/lib/config/mms.ts`:**

```ts
getMmBySlug(slug: string): MmConfig | undefined
getMmSubaccounts(slug: string): number[]
```

**Scale reference (as of 2026-03):**
- mm1 subaccounts [1, 2]: ~4 000 fills/24h combined → ~8 pages per sub
- mm3 subaccount [0]: lower volume

---

## 9. Fills — Reference Implementation

The Fills feature is the most complete and complex tab. Study it before
building any new tabs.

### Files

| File | Role |
|---|---|
| `src/lib/features/fills/client.ts` | `loadFillsData()` — IndexedDB check, then browser-side indexer pagination with streaming progress callback; caches + aggregates |
| `src/routes/api/fills/+server.ts` | Server-side aggregated endpoint — used by TabPrefetcher and as fallback |
| `src/routes/api/fills-raw/+server.ts` | **Legacy, unreferenced** — candidate for deletion |
| `src/lib/features/fills/types.ts` | `IndexerFill`, `FillTickerRow`, `FillsTimePoint`, `FillsApiResponse` |
| `src/lib/features/fills/schemas.ts` | `FillsResponseSchema` — Zod schema for fills response |
| `src/lib/features/fills/db.ts` | IndexedDB cache for raw fills (`getFillsCache`, `setFillsCache`, `hasFreshFillsCache`) |
| `src/lib/features/fills/aggregator.ts` | Pure function: raw fills → `FillsApiResponse` |
| `src/lib/features/fills/FillsTab.svelte` | Main tab — orchestrates all of the above |
| `src/lib/features/fills/FillsChart.svelte` | Time series line chart |

### Architecture: browser-direct pagination + client-side aggregation

```
browser → IndexedDB hit? → yes: aggregate client-side, done
                         → no:  browser paginates indexer /v4/fills directly
                               (per subaccount, streaming page-count progress
                                into FillsTab's fetchProgress $state)
                               → cache raw fills in IndexedDB
                               → aggregate client-side
                               → render
```

Benefits:
- Repeat visits for historical ranges (to < today) are instant — skip the
  network entirely
- Aggregation logic can change without re-fetching from the indexer
- 7-day TTL for historical data (immutable); 5-min TTL for live (today's fills)
- Real per-page progress instead of a fake progress bar

### SWR wiring in FillsTab (current)

```ts
// FillsTab receives the page-wide global range as props — it no longer has
// its own fillsFrom/fillsTo URL params.
const { slug, address, subaccounts, from, to } = $props()

const fillsKey = $derived(`/api/fills?slug=${slug}&from=${from}&to=${to}`)

async function fillsFetcher(key: string): Promise<FillsApiResponse> {
  return loadFillsData(key, {
    address,
    subaccounts,
    onProgress: (next) => { if (key === fillsKey) fetchProgress = next }
  })
}

const { data, error, isLoading } = useSWR<FillsApiResponse>(
  () => fillsKey,
  { fetcher: fillsFetcher, refreshInterval: 60_000, dedupingInterval: 5 * 60_000 }
)
```

### dataIsFresh in FillsTab

```ts
const dataIsFresh = $derived(
  Boolean($data && $data.from === from && $data.to === to)
)
```

This is the **critical correctness guard**. Every data-reading derived value
(`filteredRows`, summary cards, etc.) must check `dataIsFresh` before
accessing `$data` — otherwise sswr's stale retained data will be displayed
for the new range.

### Time series bucketing

- Range ≤ 7 days → hourly buckets (`YYYY-MM-DDTHH:00:00.000Z`)
- Range > 7 days → daily buckets (`YYYY-MM-DD`)

Computed in `fillsAggregator.ts`: `hourBucket()` and `dayBucket()`.

---

## 10. Known Limitations & Planned Work

See `KNOWN-ISSUES.md` for tracked bugs (FillsChart maker-fee breakdown,
SummaryTab freshness check, API hardening items).

### Global time range gating

The global `TimeRangeSelector` currently disables 7d and 30d for all tabs
except Fills, showing a "Coming soon" banner. The gate is in `+page.svelte`:

```svelte
{:else if !isSupportedRange}
  <!-- Coming soon -->
```

Where `isSupportedRange = isCurrent24hRange(from, to)`. As other tabs are
upgraded to handle wider ranges, this gate should be removed or made per-tab.

**Fills bypasses this gate** — it renders before the `isSupportedRange` check.
It now reads the global `from`/`to` props directly (the older internal
`fillsFrom`/`fillsTo` URL params were removed).

### isCapped warning

When the indexer pagination hits the 20-page cap (10 000 fills/subaccount),
`isCapped = true` is returned. FillsTab shows a warning banner. For very
active MMs on 30d ranges, this is expected. Consider increasing `MAX_PAGES`
if needed (at cost of latency).

### TabPrefetcher fills key

`TabPrefetcher.svelte` prefetches fills using `/api/fills` (aggregated
endpoint) with the global 24h range, not `/api/fills-raw`. This means the
prefetch does not populate the IndexedDB cache. It only warms the sswr
in-memory cache. This is a minor inconsistency — acceptable for now.

### Trading sessions & time-in-book on /overview — now real

Both formerly-dummy panels on `/overview` are wired to the live `API_BASE_URL`
service (same host as mm-quotes):

- **Trading-hours expander** (per ticker): `GET /api/trading-hours/summary` →
  one row per UTC session (the five live sessions; `wholeWeek` is intentionally
  omitted) showing median quoted USD liquidity + a client-computed **Liq-vs-peak
  %** (each session's liquidity as a share of the ticker's busiest session, so
  heavy vs light sessions read at a glance). The real API only exposes liquidity
  + coverage per session (NOT spread/depth/slippage — those columns were removed).
  Clicking a session row drills into a per-MM breakdown for that session via
  `GET /api/trading-hours/detail` (per-MM quoted liquidity, own coverage %, and
  share-of-session bar, sorted by liquidity).
- **Time-in-book column** (per MM, inside the MM-liquidity expander):
  `GET /api/time-in-book/detail` → joined by `${ticker}::${mmSlug}` to show that
  MM's median + p90 repricing time on that exact ticker (rolling last 24h).
  `null` median → "—". Percentiles are histogram-approximate (±~10%).

`null ≠ 0` for both feeds — render `null` as "—", never coerce to 0.

---

## 11. Adding New Features

### How to add a new feature

1. Create `src/lib/features/<name>/` with:
   - `types.ts` — feature-specific TypeScript interfaces
   - `schemas.ts` — Zod schemas (must mirror types)
   - `<Name>Tab.svelte` — main component (if it's a tab)
   - Any feature-specific utils (db, aggregator, etc.)
2. Create the API route in `src/routes/api/<name>/+server.ts` — keep it thin,
   import business logic from the feature module
3. Register the tab in `src/routes/mm/[slug]/+page.svelte`
4. Add prefetch key in `TabPrefetcher.svelte` if applicable
5. Run `npm run check` + `npm run build`

### Import rules

- Feature code imports from `$lib/shared/*` and `$lib/utils/*` — allowed
- Feature code NEVER imports from another feature
- Shared code NEVER imports from features
- API routes import from features for types/schemas, from `$lib/api/client`
  for upstream fetching, from `$lib/config/mms` for MM resolution,
  from `$lib/server/*` for auth

---

## 12. Hard Rules

1. **Svelte 5 runes only.** No `export let`, no `$:`, no reactive statements.
   Every new component uses `$state`, `$derived`, `$effect`, `$props`.

2. **sswr dataIsFresh check.** Any tab that fetches data keyed by date range
   must implement the `dataIsFresh = $data.from === requestedFrom` pattern
   before rendering data rows. Never render `$data` if it might be stale.

3. **URL-synced state.** Any user-controlled state that should survive refresh
   (tabs, range, filters, sort order) must be read from `$page.url.searchParams`
   and written via `updateParams()`. Do not use component-local `$state` for
   this kind of state.

4. **API routes never import from components.** Routes can import from
   `$lib/config/*`, `$lib/api/*`, `$lib/utils/*`, `$lib/server/*`. Never from
   components.

5. **No new files unless necessary.** Before creating a new file, check if an
   existing utility covers the need. Prefer editing over creating.

6. **Tailwind only for styles.** No separate CSS files; all styling via
   Tailwind utility classes. Tailwind 4 is configured via
   `@import "tailwindcss"` in `app.css` — no config file needed.
   Exception: inline `style=""` is allowed only for values that are genuinely
   dynamic per-datum (e.g. treemap tile positioning, progress-bar width,
   data-driven colors) and cannot be expressed as Tailwind classes.

7. **Zod schemas mirror types.** Every public API response type in `types.ts`
   must have a corresponding Zod schema in `schemas.ts`. Runtime validation is
   optional (only parse at trust boundaries), but the schema must exist.

8. **Test with `npm run check` before finishing.** This runs `svelte-check`
   (TypeScript + Svelte type errors). Zero errors expected. Also run
   `npm run build` to catch any SSR/bundling issues.

9. **Never commit secrets.** `.env` stays gitignored; `mm-config.json` stays
   anonymous (slugs only, no firm names).
