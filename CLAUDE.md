# dYdX Market Monitor — Agent Guide

This document gives a future agent everything needed to navigate, extend, and
restructure this codebase confidently. Read it completely before writing any
code.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure — Current State](#2-project-structure--current-state)
3. [Routing & Data Flow](#3-routing--data-flow)
4. [Key Patterns](#4-key-patterns)
5. [dYdX Indexer API Reference](#5-dydx-indexer-api-reference)
6. [MM Config Reference](#6-mm-config-reference)
7. [Fills — Reference Implementation](#7-fills--reference-implementation)
8. [Known Limitations & Planned Work](#8-known-limitations--planned-work)
9. [Proposed Feature-Based Restructure](#9-proposed-feature-based-restructure)
10. [Hard Rules](#10-hard-rules)

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
| Deployment | Vercel (adapter-vercel) |
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
  routes/
    +page.svelte              # Home page → redirects to /mm
    +layout.svelte            # Root layout (sets dark background)
    mm/
      +page.server.ts         # MM list server load
      +page.svelte            # MM list page (/mm)
      [slug]/
        +page.server.ts       # Resolves MM config; sets from/to
        +page.svelte          # Main MM detail page (tabs + range selector)
    markets/
      +page.svelte            # Live market treemap (/markets)
    api/
      mms/+server.ts          # GET /api/mms — list of MMs
      summary/+server.ts      # GET /api/summary?slug&from&to&ticker
      uptime/[slug]/+server.ts # GET /api/uptime/[slug]?from&to&tickSizeAdj
      liquidity/+server.ts    # GET /api/liquidity?slug&from&to&bps
      liquidity-sla/+server.ts
      depth/+server.ts        # GET /api/depth?slug&from&to&usd
      depth-sla/+server.ts
      fills/+server.ts        # GET /api/fills?slug&from&to (aggregated, kept for prefetcher)
      fills-raw/+server.ts    # GET /api/fills-raw?slug&from&to (raw IndexerFill[])
      markets/+server.ts      # GET /api/markets

  lib/
    features/                  # Feature-based modules (types, schemas, components per feature)
      fills/
        types.ts               # IndexerFill, FillTickerRow, FillsTimePoint, FillsApiResponse
        schemas.ts             # FillsResponseSchema
        db.ts                  # IndexedDB cache for raw fills
        aggregator.ts          # Pure function: IndexerFill[] → FillsApiResponse
        FillsTab.svelte        # Main fills tab (reference implementation)
        FillsChart.svelte      # Time series line chart
      summary/
        types.ts               # SummaryRow
        schemas.ts             # SummaryRowSchema, SummaryResponseSchema
        SummaryTab.svelte      # Summary tab component
      uptime/
        UptimeTab.svelte       # Uptime tab component
      liquidity/
        schemas.ts             # LiquidityRowSchema, LiquidityResponseSchema
        LiquidityTab.svelte    # Liquidity tab component
        LiquidityChart.svelte  # Liquidity chart (currently unused)
      depth/
        schemas.ts             # DepthRowSchema, DepthResponseSchema
        DepthTab.svelte        # Depth tab component
        DepthChart.svelte      # Depth chart (currently unused)
    shared/                    # Cross-feature shared code
      components/
        AddressDisplay.svelte
        BpsCell.svelte
        EmptyState.svelte
        ErrorBanner.svelte
        LoadingSpinner.svelte
        PctCell.svelte
        ProgressLoader.svelte  # Animated fake-progress bar
        UsdCell.svelte
        skeletons/
          ChartSkeleton.svelte
          TableSkeleton.svelte
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
        Header.svelte
        PageShell.svelte       # Page wrapper (max-w, padding)
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
      dates.ts                 # Preset type + presetToFromTo + helpers
      format.ts                # Number/currency formatters
      params.ts                # updateParams — URL search param helper
      request-cache.ts         # In-memory server-side request deduplication

mm-config.json               # MM address + subaccount config
mm-config.example.json       # Copy of above, committed for reference
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

## 3. Routing & Data Flow

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

### Fills tab data fetching (special — see §7)

Fills uses a custom fetcher that checks IndexedDB before hitting the server.

---

## 4. Key Patterns

### 4.1 sswr stale-data problem & dataIsFresh

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

### 4.2 URL param state with updateParams

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

### 4.3 SLA grouping pattern

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

### 4.4 Sortable table pattern

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

### 4.5 Chart.js setup

Reference: `FillsChart.svelte` and `LiquidityChart.svelte`.

- Always `import { Chart, ... } from 'chart.js'` and `Chart.register(...)` manually (no auto-import)
- `import 'chartjs-adapter-date-fns'` for time axis
- Canvas in `onMount`, destroyed in `onDestroy`
- Dark theme: background `transparent`, grid `rgba(255,255,255,0.06)`, ticks `#71717a`
- Font: `"IBM Plex Sans", system-ui, sans-serif` (loaded via app.html or global CSS)
- Update chart reactively: `$effect(() => { if (chart) { chart.data = ...; chart.update('none') } })`

### 4.6 apiFetch (server-side only)

```ts
import { apiFetch } from '$lib/api/client'
// Wraps internal API calls from server routes
// Adds 8-second in-memory dedup cache keyed by URL
// NOT used in fills routes — fills fetches the dYdX indexer directly
```

### 4.7 Progress loader

`ProgressLoader.svelte` props: `{ estimatedMs: number, active: boolean }`

Internally runs a `setInterval` that advances from 0 → 88% linearly over
`estimatedMs`, then snaps to 100% when `active` becomes `false`.

Use it for operations with no real progress signal (e.g., multi-page indexer
pagination). Set `estimatedMs` based on observed latency:
- 24h: ~3 000 ms
- 7d: ~7 000 ms
- 14d / 30d: ~8 000 ms (capped at 20 pages regardless)

---

## 5. dYdX Indexer API Reference

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

## 6. MM Config Reference

**File:** `mm-config.json` (gitignored in production; `mm-config.example.json` committed)

```json
[
  {
    "slug": "mm1",
    "name": "MM1 S1",
    "address": "dydx1javmgpng0a2dpdpmnqpt0qxw67laaay26yymnp",
    "subaccounts": [1, 2]
  },
  {
    "slug": "mm3",
    "name": "MM3",
    "address": "dydx10hpl83hamwz0pxvjlanh5rcas3mdgf8xk7g7ra",
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

## 7. Fills — Reference Implementation

The Fills feature is the most complete and complex tab. Study it before
building any new tabs.

### Files

| File | Role |
|---|---|
| `src/routes/api/fills-raw/+server.ts` | Thin proxy — paginates indexer, returns raw `IndexerFill[]` |
| `src/routes/api/fills/+server.ts` | Aggregated endpoint (kept for TabPrefetcher compatibility) |
| `src/lib/features/fills/types.ts` | `IndexerFill`, `FillTickerRow`, `FillsTimePoint`, `FillsApiResponse` |
| `src/lib/features/fills/schemas.ts` | `FillsResponseSchema` — Zod schema for fills response |
| `src/lib/features/fills/db.ts` | IndexedDB cache for raw fills |
| `src/lib/features/fills/aggregator.ts` | Pure function: raw fills → `FillsApiResponse` |
| `src/lib/features/fills/FillsTab.svelte` | Main tab — orchestrates all of the above |
| `src/lib/features/fills/FillsChart.svelte` | Time series line chart |

### Architecture: why raw + client-side aggregation

```
Old:  browser → /api/fills → server paginates + aggregates → browser renders
New:  browser → IndexedDB hit? → yes: aggregate client-side, done
                              → no:  /api/fills-raw → server paginates only
                                    → cache raw fills in IndexedDB
                                    → aggregate client-side
                                    → render
```

Benefits:
- Repeat visits for historical ranges (to < today) are instant — skip the
  server entirely
- Aggregation logic can change without re-fetching from the indexer
- 7-day TTL for historical data (immutable); 5-min TTL for live (today's fills)

### Custom SWR fetcher in FillsTab

```ts
async function fillsFetcher(key: string): Promise<FillsApiResponse> {
  const cacheKey = `${slug}:${fillsFrom}:${fillsTo}`
  const cached = await getFillsCache(cacheKey)
  if (cached) return aggregateFills(cached.fills, cached.from, cached.to, cached.isCapped)

  const res = await fetch(key)  // key = '/api/fills-raw?slug=...&from=...&to=...'
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json()  // { fills, isCapped, from, to }

  await setFillsCache(cacheKey, raw)
  return aggregateFills(raw.fills, raw.from, raw.to, raw.isCapped)
}

const fillsKey = $derived(`/api/fills-raw?slug=${slug}&from=${fillsFrom}&to=${fillsTo}`)
const { data, error, isLoading } = useSWR<FillsApiResponse>(
  () => fillsKey,
  { fetcher: fillsFetcher, refreshInterval: 60_000, dedupingInterval: 1_800_000 }
)
```

### FillsTab URL params

| Param | Default | Meaning |
|---|---|---|
| `fillsFrom` | today - 1d | Start date YYYY-MM-DD |
| `fillsTo` | today | End date YYYY-MM-DD |
| `fillsGroup` | `'sla'` | `'sla'` or `'none'` |
| `fillsPreset` | `'24h'` | Active preset button highlight |

### dataIsFresh in FillsTab

```ts
const dataIsFresh = $derived(
  Boolean($data && $data.from === fillsFrom && $data.to === fillsTo)
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

## 8. Known Limitations & Planned Work

### Global time range gating

The global `TimeRangeSelector` currently disables 7d and 30d for all tabs
except Fills, showing a "Coming soon" banner. The gate is in `+page.svelte`:

```svelte
{:else if !isSupportedRange}
  <!-- Coming soon -->
```

Where `isSupportedRange = isCurrent24hRange(from, to)`. As other tabs are
upgraded to handle wider ranges, this gate should be removed or made per-tab.

**Fills bypasses this gate** — it renders before the `isSupportedRange` check
and manages its own internal range (separate from the global range).

**Future improvement:** Fills should eventually read from the global range
selector. Currently it ignores the global `from`/`to` (passed as props for
SLA group lookup only) and uses its own `fillsFrom`/`fillsTo` from URL params.

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

---

## 9. Adding New Features

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
  for upstream fetching, from `$lib/config/mms` for MM resolution

---

## 10. Hard Rules

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
   `$lib/config/*`, `$lib/api/*`, `$lib/utils/*`. Never from components.

5. **No new files unless necessary.** Before creating a new file, check if an
   existing utility covers the need. Prefer editing over creating.

6. **Tailwind only for styles.** No inline `style=""` attributes, no separate
   CSS files. All styling via Tailwind utility classes. Tailwind 4 is configured
   via `@import "tailwindcss"` in `app.css` — no config file needed for
   standard utilities.

7. **Zod schemas mirror types.** Every public API response type in `types.ts`
   must have a corresponding Zod schema in `schemas.ts`. Runtime validation is
   optional (only parse at trust boundaries), but the schema must exist.

8. **Test with `npm run check` before finishing.** This runs `svelte-check`
   (TypeScript + Svelte type errors). Zero errors expected. Also run
   `npm run build` to catch any SSR/bundling issues.
