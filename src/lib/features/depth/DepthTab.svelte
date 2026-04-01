<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import ProgressLoader from '$lib/shared/components/ProgressLoader.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import { getMmEmptyStateCopy } from '$lib/shared/mm-activity';

  type DepthMode = 'sla' | 'custom';
  type DepthView = 'combined' | 'all';

  interface DepthRow {
    ticker: string;
    minutesIncluded: number;
    medianBidFillBps: number | null;
    medianAskFillBps: number | null;
    medianCombinedFillBps: number | null;
  }

  interface SectionLevel {
    key: string;
    label: string;
    expectedUsd: number;
    expectedBps: number | null;
    measuredUsd: number;
  }

  interface SectionTicker {
    ticker: string;
    levels: string[];
    rows: Record<string, DepthRow | null>;
  }

  interface SlaSection {
    group: string;
    isFallback: boolean;
    levels: SectionLevel[];
    tickers: SectionTicker[];
  }

  interface RequestState {
    mode: DepthMode;
    ticker: string;
    usd: number;
    view: DepthView;
  }

  interface DepthPayload {
    hasConfiguredSla: boolean;
    mode: DepthMode;
    request: RequestState;
    view: DepthView;
    sections: SlaSection[];
  }

  interface LevelSummary {
    avgAskFillBps: number | null;
    avgBidFillBps: number | null;
    avgCombinedFillBps: number | null;
  }

  interface DisplaySection extends SlaSection {
    summaries: Record<string, LevelSummary>;
  }

  import type { MmActivity } from '$lib/shared/types';

  const {
    slug,
    from,
    to,
    usd: initialUsd,
    activity
  }: { slug: string; from: string; to: string; usd: number; activity?: MmActivity } = $props();

  const emptyState = $derived.by(() =>
    getMmEmptyStateCopy(activity, { message: 'No depth data for this period.' })
  );

  let draftUsdInput = $state('');
  let draftTicker = $state('');
  let draftMode = $state<DepthMode>('sla');
  let collapsedGroups = $state<Record<string, boolean>>({});
  let showBid = $state(false);
  let showAsk = $state(false);
  let pendingReason = $state<string | null>(null);
  let viewLoadError = $state<string | null>(null);
  let progressStartedAt = $state<number | null>(null);
  let progressNow = $state(Date.now());
  let progressKey = $state('');
  let combinedSnapshot = $state<DepthPayload | null>(null);
  const showCombined = true;

  const appliedTicker = $derived(($page.url.searchParams.get('ticker') ?? '').trim().toUpperCase());
  const appliedMode = $derived(($page.url.searchParams.get('depthMode') ?? 'sla') === 'custom' ? 'custom' : 'sla');
  const depthView = $derived<DepthView>(showBid || showAsk ? 'all' : 'combined');
  const visibleMetricCount = $derived((showBid ? 1 : 0) + (showAsk ? 1 : 0) + 1);

  $effect(() => {
    draftUsdInput = String(initialUsd);
  });

  $effect(() => {
    draftTicker = appliedTicker;
  });

  $effect(() => {
    draftMode = appliedMode;
  });

  function normalizeTicker(value: string): string {
    return value.trim().toUpperCase();
  }

  function parseUsd(value: string): number | null {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function fmtBps(value: number): string {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function fmtTargetUsd(value: number): string {
    if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `$${value.toFixed(0)}`;
  }

  function renderBps(value: number | null | undefined): string {
    if (value == null) return '\u2014';
    return value.toFixed(1);
  }

  function bpsClass(value: number | null | undefined, expected: number | null): string {
    if (value == null) return 'text-zinc-500';
    if (expected == null) return 'text-zinc-100';
    if (value <= expected) return 'text-emerald-400';
    if (value <= expected * 1.25) return 'text-amber-400';
    return 'text-red-400';
  }

  function matchesAppliedRequest(request: RequestState, view?: DepthView): boolean {
    if (view != null && request.view !== view) return false;
    return request.mode === appliedMode && request.ticker === appliedTicker && request.usd === initialUsd;
  }

  const draftUsd = $derived(parseUsd(draftUsdInput));
  const modeDirty = $derived(draftMode !== appliedMode);
  const tickerDirty = $derived(normalizeTicker(draftTicker) !== appliedTicker);

  function setMode(next: DepthMode) {
    draftMode = next;
  }

  function applyControls() {
    const nextTicker = normalizeTicker(draftTicker);
    const nextUsd = draftUsd ?? initialUsd;

    if (draftMode === 'custom' && draftUsd == null) {
      draftUsdInput = String(initialUsd);
      return;
    }

    if (!controlsDirty) return;

    pendingReason = 'Updating...';
    updateParams({
      depthMode: draftMode === 'sla' ? null : 'custom',
      ticker: nextTicker || null,
      usd: String(nextUsd)
    });
  }

  function onControlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') applyControls();
  }

  function toggleBid() {
    const nextShowBid = !showBid;
    const nextView: DepthView = nextShowBid || showAsk ? 'all' : 'combined';
    viewLoadError = null;
    if (nextView !== depthView && nextView === 'all') {
      pendingReason = 'Loading bid/ask...';
    }
    showBid = nextShowBid;
  }

  function toggleAsk() {
    const nextShowAsk = !showAsk;
    const nextView: DepthView = showBid || nextShowAsk ? 'all' : 'combined';
    viewLoadError = null;
    if (nextView !== depthView && nextView === 'all') {
      pendingReason = 'Loading bid/ask...';
    }
    showAsk = nextShowAsk;
  }

  const hasReusableCombinedSnapshot = $derived(
    combinedSnapshot != null && matchesAppliedRequest(combinedSnapshot.request, 'combined')
  );
  const includeCombinedInRequest = $derived(!(depthView === 'all' && hasReusableCombinedSnapshot));
  const depthKey = $derived(
    `/api/depth-sla?slug=${slug}&from=${from}&to=${to}&usd=${initialUsd}&mode=${appliedMode}&view=${depthView}&includeCombined=${includeCombinedInRequest ? '1' : '0'}${appliedTicker ? '&ticker=' + appliedTicker : ''}`
  );

  const { data, error: depthError, isLoading } = useSWR<DepthPayload>(
    () => depthKey,
    { refreshInterval: 60_000, dedupingInterval: 1_800_000 }
  );
  const hasConfiguredSla = $derived($data?.hasConfiguredSla ?? true);
  const amountInputEnabled = $derived(!hasConfiguredSla || draftMode === 'custom');
  const usdDirty = $derived(amountInputEnabled && draftUsd != null && draftUsd !== initialUsd);
  const invalidDraftUsd = $derived(amountInputEnabled && draftUsd == null);
  const controlsDirty = $derived(modeDirty || tickerDirty || usdDirty);
  const canApply = $derived(controlsDirty && !invalidDraftUsd);

  const hasMatchingPayload = $derived.by(() => {
    if (!$data) return false;
    return matchesAppliedRequest($data.request, depthView);
  });

  $effect(() => {
    if (hasMatchingPayload || ($depthError && !$isLoading)) pendingReason = null;
    if (hasMatchingPayload) viewLoadError = null;
  });

  $effect(() => {
    if (!$data) return;
    if (!matchesAppliedRequest($data.request, 'combined')) return;
    combinedSnapshot = $data;
  });

  const isPending = $derived($isLoading || pendingReason != null || !hasMatchingPayload);
  const structuralPending = $derived(
    depthView === 'all' && !hasMatchingPayload && !$depthError && ($isLoading || pendingReason != null)
  );
  const sections = $derived($data?.sections ?? []);
  const skeletonColumns = $derived(Math.max(4, 1 + visibleMetricCount * (sections[0]?.levels.length ?? 3)));
  const loadingWithFeedback = $derived(pendingReason != null || structuralPending);
  const uniqueMeasuredUsdCount = $derived.by(() => {
    const values = new Set<number>();
    for (const section of sections) {
      for (const level of section.levels) values.add(level.measuredUsd);
    }
    return Math.max(1, values.size);
  });
  const upstreamRequestCount = $derived(
    uniqueMeasuredUsdCount * (depthView === 'all' ? (includeCombinedInRequest ? 2 : 1) : 1)
  );
  const progressEstimateMs = $derived(
    pendingReason === 'Loading bid/ask...' ? (includeCombinedInRequest ? 12_000 : 7_000) : 6_000
  );
  const progressElapsedMs = $derived(progressStartedAt == null ? 0 : Math.max(0, progressNow - progressStartedAt));
  const progressElapsedLabel = $derived.by(() => {
    if (!loadingWithFeedback || progressStartedAt == null) return '';
    const totalSeconds = Math.max(1, Math.floor(progressElapsedMs / 1000));
    return `${totalSeconds}s elapsed`;
  });
  const progressLabel = $derived(
    pendingReason ?? (depthView === 'all' ? 'Loading bid/ask...' : 'Refreshing depth data...')
  );
  const progressDetail = $derived.by(() => {
    if (progressLabel === 'Loading bid/ask...') {
      if (progressElapsedMs >= 12_000) {
        return `Still waiting on ${upstreamRequestCount} depth snapshots from the upstream API.`;
      }
      if (includeCombinedInRequest) {
        return `Fetching ${upstreamRequestCount} depth snapshots across ${uniqueMeasuredUsdCount} size levels for bid, ask, and combined fills.`;
      }
      return `Fetching ${upstreamRequestCount} bid/ask depth snapshots across ${uniqueMeasuredUsdCount} size levels and reusing the combined fills already on the page.`;
    }

    return 'Applying the current size, ticker, and grouping settings.';
  });

  $effect(() => {
    if (!loadingWithFeedback) {
      progressStartedAt = null;
      progressKey = '';
      return;
    }

    const nextKey = `${progressLabel}:${depthView}:${appliedMode}:${appliedTicker}:${initialUsd}:${showBid}:${showAsk}`;
    if (nextKey !== progressKey) {
      progressKey = nextKey;
      progressStartedAt = Date.now();
    }
  });

  $effect(() => {
    if (!loadingWithFeedback) return;
    progressNow = Date.now();
    const id = setInterval(() => {
      progressNow = Date.now();
    }, 250);
    return () => clearInterval(id);
  });

  $effect(() => {
    if (depthView !== 'all') return;
    if ($isLoading) return;
    if (!$depthError) return;
    if (hasMatchingPayload) return;

    viewLoadError = 'Bid/ask view failed to load. Showing combined only.';
    showBid = false;
    showAsk = false;
    pendingReason = null;
  });

  const combinedSnapshotLookup = $derived.by(() => {
    const byGroup = new Map<string, Map<string, Map<string, DepthRow>>>();

    if (!hasReusableCombinedSnapshot || combinedSnapshot == null) return byGroup;

    for (const section of combinedSnapshot.sections) {
      const byTicker = new Map<string, Map<string, DepthRow>>();
      for (const entry of section.tickers) {
        const byLevel = new Map<string, DepthRow>();
        for (const [levelKey, row] of Object.entries(entry.rows)) {
          if (row) byLevel.set(levelKey, row);
        }
        byTicker.set(entry.ticker, byLevel);
      }
      byGroup.set(section.group, byTicker);
    }

    return byGroup;
  });

  const displaySections = $derived.by((): DisplaySection[] =>
    sections.map((section) => {
      const tickers = section.tickers.map((entry) => {
        const snapshotLevels = combinedSnapshotLookup.get(section.group)?.get(entry.ticker);

        return {
          ...entry,
          rows: Object.fromEntries(
            Object.entries(entry.rows).map(([levelKey, row]) => {
              if (!row) return [levelKey, null];
              if (row.medianCombinedFillBps != null) return [levelKey, row];

              const snapshotRow = snapshotLevels?.get(levelKey);
              if (snapshotRow?.medianCombinedFillBps == null) return [levelKey, row];

              return [
                levelKey,
                {
                  ...row,
                  medianCombinedFillBps: snapshotRow.medianCombinedFillBps,
                  minutesIncluded: Math.max(row.minutesIncluded, snapshotRow.minutesIncluded)
                }
              ];
            })
          ) as Record<string, DepthRow | null>
        };
      });

      return {
        ...section,
        tickers,
        summaries: Object.fromEntries(
          section.levels.map((level) => {
            const rows = tickers
              .filter((entry) => entry.levels.includes(level.key))
              .map((entry) => entry.rows[level.key])
              .filter((row): row is DepthRow => row != null);

            const bidValues = rows
              .map((row) => row.medianBidFillBps)
              .filter((value): value is number => value != null);
            const askValues = rows
              .map((row) => row.medianAskFillBps)
              .filter((value): value is number => value != null);
            const combinedValues = rows
              .map((row) => row.medianCombinedFillBps)
              .filter((value): value is number => value != null);

            return [
              level.key,
              {
                avgAskFillBps:
                  askValues.length > 0 ? askValues.reduce((sum, value) => sum + value, 0) / askValues.length : null,
                avgBidFillBps:
                  bidValues.length > 0 ? bidValues.reduce((sum, value) => sum + value, 0) / bidValues.length : null,
                avgCombinedFillBps:
                  combinedValues.length > 0
                    ? combinedValues.reduce((sum, value) => sum + value, 0) / combinedValues.length
                    : null
              }
            ];
          })
        ) as Record<string, LevelSummary>
      };
    })
  );

  $effect(() => {
    const groups = displaySections.map((section) => section.group);
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[group] = collapsedGroups[group] ?? true;
    }

    const keys = Object.keys(next);
    const prevKeys = Object.keys(collapsedGroups);
    const sameShape = keys.length === prevKeys.length && keys.every((key) => prevKeys.includes(key));
    const sameValues = sameShape && keys.every((key) => next[key] === collapsedGroups[key]);
    if (!sameValues) collapsedGroups = next;
  });

  function toggleGroup(group: string) {
    collapsedGroups = { ...collapsedGroups, [group]: !collapsedGroups[group] };
  }

  function isGroupCollapsed(group: string): boolean {
    return collapsedGroups[group] ?? true;
  }
</script>

<div class="mb-4 space-y-2 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-xs text-zinc-400">
  <div class="leading-relaxed">
    <span class="font-medium text-zinc-300">Depth by liquidity</span>
    <span class="mx-1 text-zinc-700">&middot;</span>
    Tickers are grouped by SLA. Each group header shows the liquidity expected at each level, and the table
    shows the bid, ask, and combined fill bps for that amount.
  </div>
  <div class="leading-relaxed">
    {#if !hasConfiguredSla}
      No SLA configuration is available for this market maker. Use the amount control below to inspect fallback depth targets at <span class="mono text-zinc-300">{fmtTargetUsd(initialUsd)}</span>.
    {:else if appliedMode === 'custom'}
      Custom mode is on: each level keeps its SLA target, but the fill bps below are measured for
      <span class="mono text-zinc-300">{fmtTargetUsd(initialUsd)}</span>.
    {:else}
      SLA mode is on: the fill bps below are measured using each level&apos;s own expected liquidity target.
    {/if}
  </div>
  <div class="leading-relaxed">
    {#if depthView === 'all'}
      Bid, ask, and combined fill bps are loaded.
    {:else}
      Combined fill bps is loaded by default. Enable bid or ask if you want the one-sided fills too.
    {/if}
  </div>
  <div class="leading-relaxed">
    Lower bps means tighter fills. When an SLA bps target exists, green means the fill stayed inside target.
  </div>
  <div class="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5">
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
      <span class="text-emerald-400">inside target</span>
    </span>
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
      <span class="text-amber-400">near target</span>
    </span>
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-red-400"></span>
      <span class="text-red-400">above target</span>
    </span>
  </div>
</div>

<div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
  {#if hasConfiguredSla}
    <div class="flex items-center gap-1">
      <span class="text-xs text-zinc-500">Size:</span>
      <button
        type="button"
        onclick={() => setMode('sla')}
        class="rounded px-2 py-1 text-xs transition-colors {draftMode === 'sla'
          ? 'bg-violet-500/20 text-violet-400'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
      >SLA size</button>
      <button
        type="button"
        onclick={() => setMode('custom')}
        class="rounded px-2 py-1 text-xs transition-colors {draftMode === 'custom'
          ? 'bg-violet-500/20 text-violet-400'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
      >Custom size</button>
    </div>
  {/if}

  <label class="flex items-center gap-2 text-xs text-zinc-400">
    amount
    <input
      type="text"
      bind:value={draftUsdInput}
      disabled={!amountInputEnabled}
      onkeydown={onControlKeydown}
      class="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
    />
  </label>

  <div class="flex items-center gap-1">
    <span class="text-xs text-zinc-500">View:</span>
    <span class="rounded px-2 py-1 text-xs bg-violet-500/20 text-violet-400">combined</span>
    <button
      type="button"
      onclick={toggleBid}
      class="rounded px-2 py-1 text-xs transition-colors {showBid
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >bid</button>
    <button
      type="button"
      onclick={toggleAsk}
      class="rounded px-2 py-1 text-xs transition-colors {showAsk
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >ask</button>
  </div>

  <label class="flex items-center gap-2 text-xs text-zinc-400">
    Ticker
    <input
      type="text"
      bind:value={draftTicker}
      onkeydown={onControlKeydown}
      placeholder="all"
      class="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 uppercase focus:border-violet-500 focus:outline-none mono placeholder:normal-case placeholder:text-zinc-600"
    />
  </label>

  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={applyControls}
      disabled={!canApply}
      class="rounded border px-2.5 py-1 text-xs font-medium transition-colors {canApply
        ? 'border-violet-500/30 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
        : 'cursor-not-allowed border-zinc-800 text-zinc-600'}"
    >Apply</button>
    {#if pendingReason}
      <span class="text-xs text-violet-300">{pendingReason}</span>
    {:else if controlsDirty}
      <span class="text-xs text-amber-300">{invalidDraftUsd ? 'Enter a valid amount' : 'Pending changes'}</span>
    {/if}
  </div>
</div>

{#if $depthError && displaySections.length === 0}
  <ErrorBanner message="Failed to load depth data" />
{:else if ($isLoading && displaySections.length === 0) || structuralPending}
  <div class="space-y-3">
    {#if loadingWithFeedback}
      <ProgressLoader
        label={progressLabel}
        detail={progressDetail}
        estimatedMs={progressEstimateMs}
        elapsedMs={progressElapsedMs}
        elapsed={progressElapsedLabel}
      />
    {/if}
    <TableSkeleton rows={8} columns={skeletonColumns} />
  </div>
{:else if displaySections.length === 0}
  <EmptyState message={emptyState.message} hint={emptyState.hint} />
{:else}
  {#if $depthError}
    <div class="mb-3">
      <ErrorBanner message="Refresh failed. Showing cached depth data." />
    </div>
  {/if}
  {#if viewLoadError}
    <div class="mb-3">
      <ErrorBanner message={viewLoadError} />
    </div>
  {/if}

  <div class="relative space-y-4">
    {#each displaySections as section}
      <div class="rounded border border-zinc-800 bg-zinc-900/30">
        <button
          type="button"
          onclick={() => toggleGroup(section.group)}
          class="flex w-full items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-800/35 px-3 py-2 text-left"
        >
          <span class="flex items-center gap-2">
            <span class="mono inline-block w-3 text-zinc-400">{isGroupCollapsed(section.group) ? '+' : '-'}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">{section.group}</span>
            <span class="text-[10px] text-zinc-600">({section.tickers.length})</span>
          </span>
          {#if section.isFallback}
            <span class="text-[10px] uppercase tracking-wide text-zinc-500">Fallback</span>
          {/if}
        </button>

        {#if !isGroupCollapsed(section.group)}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th class="pb-2 pl-3 pr-4 pt-3 font-medium">Ticker</th>
                  {#each section.levels as level}
                    <th class="pb-2 pr-3 pt-3 font-medium text-center" colspan={visibleMetricCount}>
                      <div class="flex flex-col items-center gap-0.5">
                        <span>{level.label}</span>
                        {#if level.expectedBps != null}
                          <span class="text-[10px] font-normal text-zinc-500">
                            Expected {fmtTargetUsd(level.expectedUsd)} in {fmtBps(level.expectedBps)}bps
                          </span>
                        {:else}
                          <span class="text-[10px] font-normal text-zinc-500">
                            Default target {fmtTargetUsd(level.expectedUsd)}
                          </span>
                        {/if}
                        {#if level.measuredUsd !== level.expectedUsd}
                          <span class="text-[10px] font-normal text-zinc-600">
                            Showing fill for {fmtTargetUsd(level.measuredUsd)}
                          </span>
                        {/if}
                      </div>
                    </th>
                  {/each}
                </tr>
                <tr class="border-b border-zinc-800/50 text-xs text-zinc-600">
                  <th class="pb-2 pl-3 pr-4"></th>
                  {#each section.levels as _}
                    {#if showBid}
                      <th class="pb-2 pr-1 text-right font-normal">bid</th>
                    {/if}
                    {#if showAsk}
                      <th class="pb-2 pr-1 text-right font-normal">ask</th>
                    {/if}
                    {#if showCombined}
                      <th class="pb-2 pr-3 text-right font-normal">combined</th>
                    {/if}
                  {/each}
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-zinc-800/50 bg-zinc-800/20">
                  <td class="py-2 pl-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Group total</td>
                  {#each section.levels as level}
                    {@const summary = section.summaries[level.key]}
                    {#if showBid}
                      <td class="py-2 pr-1 text-right">
                        <span class="mono {bpsClass(summary.avgBidFillBps, level.expectedBps)}">{renderBps(summary.avgBidFillBps)}</span>
                      </td>
                    {/if}
                    {#if showAsk}
                      <td class="py-2 pr-1 text-right">
                        <span class="mono {bpsClass(summary.avgAskFillBps, level.expectedBps)}">{renderBps(summary.avgAskFillBps)}</span>
                      </td>
                    {/if}
                    {#if showCombined}
                      <td class="py-2 pr-3 text-right">
                        <span class="mono {bpsClass(summary.avgCombinedFillBps, level.expectedBps)}">{renderBps(summary.avgCombinedFillBps)}</span>
                      </td>
                    {/if}
                  {/each}
                </tr>
                {#each section.tickers as entry}
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td class="py-2 pl-3 pr-4 font-medium text-zinc-200">{entry.ticker}</td>
                    {#each section.levels as level}
                      {@const row = entry.rows[level.key]}
                      {#if entry.levels.includes(level.key) && row}
                        {#if showBid}
                          <td class="py-2 pr-1 text-right">
                            <span class="mono {bpsClass(row.medianBidFillBps, level.expectedBps)}">{renderBps(row.medianBidFillBps)}</span>
                          </td>
                        {/if}
                        {#if showAsk}
                          <td class="py-2 pr-1 text-right">
                            <span class="mono {bpsClass(row.medianAskFillBps, level.expectedBps)}">{renderBps(row.medianAskFillBps)}</span>
                          </td>
                        {/if}
                        {#if showCombined}
                          <td class="py-2 pr-3 text-right">
                            <span class="mono {bpsClass(row.medianCombinedFillBps, level.expectedBps)}">{renderBps(row.medianCombinedFillBps)}</span>
                          </td>
                        {/if}
                      {:else}
                        {#if showBid}
                          <td class="py-2 pr-1 text-right text-zinc-700">&ndash;</td>
                        {/if}
                        {#if showAsk}
                          <td class="py-2 pr-1 text-right text-zinc-700">&ndash;</td>
                        {/if}
                        {#if showCombined}
                          <td class="py-2 pr-3 text-right text-zinc-700">&ndash;</td>
                        {/if}
                      {/if}
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/each}

    {#if isPending}
      <div class="pointer-events-none absolute inset-0 rounded bg-zinc-900/55">
        <div class="absolute left-3 right-3 top-3 max-w-xl">
          {#if loadingWithFeedback}
            <ProgressLoader
              compact={true}
              label={progressLabel}
              detail={progressDetail}
              estimatedMs={progressEstimateMs}
              elapsedMs={progressElapsedMs}
              elapsed={progressElapsedLabel}
            />
          {:else}
            <div class="inline-flex rounded bg-zinc-900/90 px-2 py-1 text-xs text-violet-300">Refreshing...</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
