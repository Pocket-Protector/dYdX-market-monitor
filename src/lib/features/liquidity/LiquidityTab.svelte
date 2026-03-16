<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import UsdCell from '$lib/shared/components/UsdCell.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';

  type LiquidityMode = 'sla' | 'custom';

  interface FlatRow {
    ticker: string;
    minutesIncluded: number;
    medianBidLiqUsd: number | null;
    medianAskLiqUsd: number | null;
  }

  interface SectionLevel {
    key: string;
    label: string;
    usd: number;
    expectedBps: number;
    measuredBps: number;
  }

  interface SectionTicker {
    ticker: string;
    levels: string[];
    rows: Record<string, FlatRow | null>;
  }

  interface SlaSection {
    group: string;
    isFallback: boolean;
    levels: SectionLevel[];
    tickers: SectionTicker[];
  }

  interface RequestState {
    bps: number;
    mode: LiquidityMode;
    ticker: string;
  }

  interface SlaPayload {
    mode: LiquidityMode;
    request: RequestState;
    sections: SlaSection[];
  }

  interface LevelSummary {
    avgCoveragePct: number | null;
    totalAskUsd: number | null;
    totalBidUsd: number | null;
  }

  interface DisplaySection extends SlaSection {
    summaries: Record<string, LevelSummary>;
  }

  const {
    slug,
    from,
    to,
    bps: initialBps
  }: { slug: string; from: string; to: string; bps: number } = $props();

  let draftTicker = $state('');
  let draftBpsInput = $state('');
  let draftMode = $state<LiquidityMode>('sla');
  let collapsedGroups = $state<Record<string, boolean>>({});
  let isApplying = $state(false);

  const appliedTicker = $derived(($page.url.searchParams.get('ticker') ?? '').trim().toUpperCase());
  const appliedMode = $derived(($page.url.searchParams.get('liquidityMode') ?? 'sla') === 'custom' ? 'custom' : 'sla');

  $effect(() => {
    draftTicker = appliedTicker;
  });

  $effect(() => {
    draftBpsInput = fmtBps(initialBps);
  });

  $effect(() => {
    draftMode = appliedMode;
  });

  function normalizeTicker(value: string): string {
    return value.trim().toUpperCase();
  }

  function parseBps(value: string): number | null {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100) / 100;
  }

  function fmtBps(value: number): string {
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function fmtTargetUsd(value: number): string {
    if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `$${value.toFixed(0)}`;
  }

  function coverage(
    bid: number | null | undefined,
    ask: number | null | undefined,
    required: number
  ): number | null {
    if (bid == null || ask == null) return null;
    return (bid + ask) / 2 / required;
  }

  function coverageClass(ratio: number | null): string {
    if (ratio == null) return 'text-zinc-500';
    if (ratio >= 1.0) return 'text-emerald-400';
    if (ratio >= 0.75) return 'text-amber-400';
    return 'text-red-400';
  }

  function fmtPct(ratio: number | null): string {
    if (ratio == null) return '\u2014';
    return (ratio * 100).toFixed(0) + '%';
  }

  const draftBps = $derived(parseBps(draftBpsInput));
  const modeDirty = $derived(draftMode !== appliedMode);
  const tickerDirty = $derived(normalizeTicker(draftTicker) !== appliedTicker);
  const bpsDirty = $derived(draftMode === 'custom' && draftBps != null && draftBps !== initialBps);
  const invalidDraftBps = $derived(draftMode === 'custom' && draftBps == null);
  const controlsDirty = $derived(modeDirty || tickerDirty || bpsDirty);
  const canApply = $derived(controlsDirty && !invalidDraftBps);

  function setMode(next: LiquidityMode) {
    draftMode = next;
  }

  function applyControls() {
    const nextTicker = normalizeTicker(draftTicker);
    const nextBps = draftBps ?? initialBps;

    if (draftMode === 'custom' && draftBps == null) {
      draftBpsInput = fmtBps(initialBps);
      return;
    }

    if (!controlsDirty) return;

    isApplying = true;
    updateParams({
      bps: fmtBps(nextBps),
      liquidityMode: draftMode === 'sla' ? null : 'custom',
      ticker: nextTicker || null
    });
  }

  function onControlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') applyControls();
  }

  const slaKey = $derived(
    `/api/liquidity-sla?slug=${slug}&from=${from}&to=${to}&bps=${initialBps}&mode=${appliedMode}${appliedTicker ? '&ticker=' + appliedTicker : ''}`
  );

  const { data, error: slaError, isLoading } = useSWR<SlaPayload>(
    () => slaKey,
    { refreshInterval: 60_000, dedupingInterval: 1_800_000 }
  );

  const hasMatchingPayload = $derived.by(() => {
    if (!$data) return false;
    return (
      $data.request.bps === initialBps &&
      $data.request.mode === appliedMode &&
      $data.request.ticker === appliedTicker
    );
  });

  $effect(() => {
    if (hasMatchingPayload || ($slaError && !$isLoading)) isApplying = false;
  });

  const isPending = $derived($isLoading || isApplying || !hasMatchingPayload);
  const sections = $derived($data?.sections ?? []);

  const displaySections = $derived.by((): DisplaySection[] =>
    sections.map((section) => ({
      ...section,
      summaries: Object.fromEntries(
        section.levels.map((level) => {
          const rows = section.tickers
            .filter((entry) => entry.levels.includes(level.key))
            .map((entry) => entry.rows[level.key])
            .filter((row): row is FlatRow => row != null);

          const bidValues = rows
            .map((row) => row.medianBidLiqUsd)
            .filter((value): value is number => value != null);
          const askValues = rows
            .map((row) => row.medianAskLiqUsd)
            .filter((value): value is number => value != null);
          const coverageValues = rows
            .map((row) => coverage(row.medianBidLiqUsd, row.medianAskLiqUsd, level.usd))
            .filter((value): value is number => value != null);

          return [
            level.key,
            {
              avgCoveragePct:
                coverageValues.length > 0
                  ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length
                  : null,
              totalAskUsd:
                askValues.length > 0 ? askValues.reduce((sum, value) => sum + value, 0) : null,
              totalBidUsd:
                bidValues.length > 0 ? bidValues.reduce((sum, value) => sum + value, 0) : null
            }
          ];
        })
      ) as Record<string, LevelSummary>
    }))
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
    <span class="font-medium text-zinc-300">Liquidity by spread</span>
    <span class="mx-1 text-zinc-700">&middot;</span>
    Tickers are grouped by SLA. Each group header shows the liquidity expected at each level, and the table
    shows how much bid and ask liquidity was actually available inside that spread.
  </div>
  <div class="leading-relaxed">
    {#if appliedMode === 'custom'}
      Custom mode is on: every group is still compared against its SLA target, but the actual liquidity is measured
      inside <span class="mono text-zinc-300">{fmtBps(initialBps)}bps</span>.
    {:else}
      SLA mode is on: the actual liquidity is measured inside the same bps spread that the SLA level expects.
    {/if}
  </div>
  <div class="leading-relaxed">
    <span class="font-medium text-zinc-300">Coverage %</span> = average of bid &amp; ask divided by the expected amount.
  </div>
  <div class="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5">
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
      <span class="text-emerald-400">&ge; 100%</span> - meets target
    </span>
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
      <span class="text-amber-400">75-99%</span> - near target
    </span>
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full bg-red-400"></span>
      <span class="text-red-400">&lt; 75%</span> - below target
    </span>
  </div>
</div>

<div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
  <div class="flex items-center gap-1">
    <span class="text-xs text-zinc-500">Spread:</span>
    <button
      type="button"
      onclick={() => setMode('sla')}
      class="rounded px-2 py-1 text-xs transition-colors {draftMode === 'sla'
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >SLA bps</button>
    <button
      type="button"
      onclick={() => setMode('custom')}
      class="rounded px-2 py-1 text-xs transition-colors {draftMode === 'custom'
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >Custom bps</button>
  </div>

  <label class="flex items-center gap-2 text-xs text-zinc-400">
    bps
    <input
      type="text"
      bind:value={draftBpsInput}
      inputmode="decimal"
      disabled={draftMode !== 'custom'}
      onkeydown={onControlKeydown}
      class="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
    />
  </label>

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
    {#if isApplying}
      <span class="text-xs text-violet-300">Updating…</span>
    {:else if controlsDirty}
      <span class="text-xs text-amber-300">{invalidDraftBps ? 'Enter a valid bps' : 'Pending changes'}</span>
    {/if}
  </div>
</div>

{#if $slaError && displaySections.length === 0}
  <ErrorBanner message="Failed to load liquidity data" />
{:else if $isLoading && displaySections.length === 0}
  <TableSkeleton rows={8} columns={7} />
{:else if displaySections.length === 0}
  <EmptyState message="No liquidity data for this period." />
{:else}
  {#if $slaError}
    <div class="mb-3">
      <ErrorBanner message="Refresh failed. Showing cached data." />
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
                    <th class="pb-2 pr-3 pt-3 font-medium text-center" colspan="3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span>{level.label}</span>
                        <span class="text-[10px] font-normal text-zinc-500">
                          Expected {fmtTargetUsd(level.usd)} in {fmtBps(level.expectedBps)}bps
                        </span>
                        {#if level.measuredBps !== level.expectedBps}
                          <span class="text-[10px] font-normal text-zinc-600">
                            Showing liquidity in {fmtBps(level.measuredBps)}bps
                          </span>
                        {/if}
                      </div>
                    </th>
                  {/each}
                </tr>
                <tr class="border-b border-zinc-800/50 text-xs text-zinc-600">
                  <th class="pb-2 pl-3 pr-4"></th>
                  {#each section.levels as _}
                    <th class="pb-2 pr-1 text-right font-normal">bid</th>
                    <th class="pb-2 pr-1 text-right font-normal">ask</th>
                    <th class="pb-2 pr-3 text-right font-normal">coverage</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-zinc-800/50 bg-zinc-800/20">
                  <td class="py-2 pl-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Group total</td>
                  {#each section.levels as level}
                    {@const summary = section.summaries[level.key]}
                    <td class="py-2 pr-1 text-right"><UsdCell value={summary.totalBidUsd} /></td>
                    <td class="py-2 pr-1 text-right"><UsdCell value={summary.totalAskUsd} /></td>
                    <td class="py-2 pr-3 text-right mono text-xs font-medium {coverageClass(summary.avgCoveragePct)}">
                      {fmtPct(summary.avgCoveragePct)}
                    </td>
                  {/each}
                </tr>
                {#each section.tickers as entry}
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td class="py-2 pl-3 pr-4 font-medium text-zinc-200">{entry.ticker}</td>
                    {#each section.levels as level}
                      {@const row = entry.rows[level.key]}
                      {#if entry.levels.includes(level.key) && row}
                        {@const ratio = coverage(row.medianBidLiqUsd, row.medianAskLiqUsd, level.usd)}
                        <td class="py-2 pr-1 text-right"><UsdCell value={row.medianBidLiqUsd} /></td>
                        <td class="py-2 pr-1 text-right"><UsdCell value={row.medianAskLiqUsd} /></td>
                        <td class="py-2 pr-3 text-right mono text-xs font-medium {coverageClass(ratio)}">
                          {fmtPct(ratio)}
                        </td>
                      {:else}
                        <td class="py-2 pr-1 text-right text-zinc-700">&ndash;</td>
                        <td class="py-2 pr-1 text-right text-zinc-700">&ndash;</td>
                        <td class="py-2 pr-3 text-right text-zinc-700">&ndash;</td>
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
        <div class="absolute right-3 top-3 rounded bg-zinc-900/90 px-2 py-1 text-xs text-violet-300">
          Refreshing...
        </div>
      </div>
    {/if}
  </div>
{/if}
