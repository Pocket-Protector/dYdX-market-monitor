<script lang="ts">
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import PctCell from '$lib/shared/components/PctCell.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import ProgressLoader from '$lib/shared/components/ProgressLoader.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import type { UptimeTicker } from '$lib/shared/sla/types';

  interface UptimePayload {
    mm: string;
    from: string;
    to: string;
    tickSizeAdj: boolean;
    tickers: UptimeTicker[];
  }

  const {
    slug,
    from,
    to
  }: { slug: string; from: string; to: string } = $props();

  let showBid = $state(false);
  let showAsk = $state(false);
  let showCombined = $state(true);
  let collapsedGroups = $state<Record<string, boolean>>({});
  let progressStartedAt = $state<number | null>(null);
  let progressNow = $state(Date.now());
  let progressKey = $state('');

  const tickSizeAdj = $derived($page.url.searchParams.get('tickAdj') !== '0');

  function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  function toggleTickAdj() {
    updateParams({ tickAdj: tickSizeAdj ? '0' : '1' });
  }

  const uptimeKey = $derived(`/api/uptime/${slug}?from=${from}&to=${to}&tickSizeAdj=${tickSizeAdj}`);

  // Manual fetch instead of useSWR — sswr resolves the key once at mount
  // and never re-fetches when the key changes (e.g. tickSizeAdj toggle).
  let responseData = $state<UptimePayload | null>(null);
  let fetchError = $state<Error | null>(null);
  let isFetching = $state(false);

  $effect(() => {
    const requestKey = uptimeKey;
    let cancelled = false;
    const controller = new AbortController();
    isFetching = true;
    fetchError = null;

    fetch(requestKey, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: UptimePayload) => {
        if (!cancelled && uptimeKey === requestKey) {
          responseData = data;
          isFetching = false;
        }
      })
      .catch((err) => {
        if (!cancelled && uptimeKey === requestKey && !isAbortError(err)) {
          fetchError = err instanceof Error ? err : new Error(String(err));
          isFetching = false;
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  });

  // Background refresh every 60s
  $effect(() => {
    const requestKey = uptimeKey;
    let cancelled = false;
    let refreshInFlight = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (refreshInFlight) return;

      refreshInFlight = true;
      controller = new AbortController();

      try {
        const res = await fetch(requestKey, { signal: controller.signal });
        if (!res.ok) return;

        const data = (await res.json()) as UptimePayload;
        if (!cancelled && uptimeKey === requestKey) {
          responseData = data;
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.warn('uptime background refresh failed', error);
        }
      } finally {
        refreshInFlight = false;
        controller = null;
      }
    }

    const id = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
      controller?.abort();
    };
  });

  const freshData = $derived.by(() => {
    if (!responseData) return null;
    if (responseData.mm !== slug) return null;
    if (responseData.from !== from || responseData.to !== to) return null;
    if (responseData.tickSizeAdj !== tickSizeAdj) return null;
    return responseData;
  });

  const isPending = $derived(isFetching || !freshData);
  const showSkeleton = $derived(!fetchError && !freshData);
  const showRefreshOverlay = $derived(Boolean(freshData) && isPending);
  const progressEstimateMs = $derived(showSkeleton ? 6_000 : 3_500);
  const progressElapsedMs = $derived(progressStartedAt == null ? 0 : Math.max(0, progressNow - progressStartedAt));
  const progressElapsedLabel = $derived.by(() => {
    if (!isPending || progressStartedAt == null) return '';
    const totalSeconds = Math.max(1, Math.floor(progressElapsedMs / 1000));
    return `${totalSeconds}s elapsed`;
  });
  const progressLabel = $derived(showSkeleton ? 'Loading uptime data...' : 'Refreshing uptime data...');
  const progressDetail = $derived.by(() => {
    if (showSkeleton) {
      return `Computing uptime (tick adjustment ${tickSizeAdj ? 'on' : 'off'}). Estimate: about ${Math.ceil(progressEstimateMs / 1000)}s.`;
    }

    return 'Refreshing the current uptime snapshot in the background.';
  });

  $effect(() => {
    if (!isPending) {
      progressStartedAt = null;
      progressKey = '';
      return;
    }

    const nextKey = `${progressLabel}:${slug}:${from}:${to}:${tickSizeAdj}`;
    if (nextKey !== progressKey) {
      progressKey = nextKey;
      progressStartedAt = Date.now();
    }
  });

  $effect(() => {
    if (!isPending) return;
    progressNow = Date.now();
    const id = setInterval(() => {
      progressNow = Date.now();
    }, 250);
    return () => clearInterval(id);
  });

  const allLevels = $derived(
    freshData
      ? [...new Set(freshData.tickers.flatMap((t) => t.levels))].sort()
      : []
  );

  function groupRank(group: string): number {
    const match = group.match(/group\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  }

  const visibleMetricCount = $derived((showBid ? 1 : 0) + (showAsk ? 1 : 0) + (showCombined ? 1 : 0));
  const skeletonColumns = $derived(Math.max(5, 1 + visibleMetricCount * 4));

  const tickersByGroup = $derived(
    freshData
      ? (() => {
          const map = new Map<string, typeof freshData.tickers>();
          for (const t of freshData.tickers) {
            if (!map.has(t.group)) map.set(t.group, []);
            map.get(t.group)!.push(t);
          }

          const sortedGroups = [...map.keys()].sort((a, b) => {
            const rankDiff = groupRank(a) - groupRank(b);
            if (rankDiff !== 0) return rankDiff;
            return a.localeCompare(b);
          });

          return sortedGroups.map((group) => ({
            group,
            tickers: [...map.get(group)!].sort((a, b) => a.ticker.localeCompare(b.ticker))
          }));
        })()
      : []
  );

  function toggleGroup(group: string) {
    collapsedGroups = { ...collapsedGroups, [group]: !collapsedGroups[group] };
  }

  function isGroupCollapsed(group: string): boolean {
    return collapsedGroups[group] ?? true;
  }

  $effect(() => {
    const groups = tickersByGroup.map((x) => x.group);
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[group] = collapsedGroups[group] ?? true;
    }

    const keys = Object.keys(next);
    const prevKeys = Object.keys(collapsedGroups);
    const sameShape = keys.length === prevKeys.length && keys.every((k) => prevKeys.includes(k));
    const sameValues = sameShape && keys.every((k) => next[k] === collapsedGroups[k]);
    if (!sameValues) collapsedGroups = next;
  });
</script>

<div class="mb-4 flex flex-wrap items-center gap-3">
  <div class="flex items-center gap-1.5 text-xs text-zinc-400">
    <span>Tick size adj:</span>
    <button
      onclick={toggleTickAdj}
      class="rounded px-2.5 py-1 text-xs font-medium transition-colors {tickSizeAdj
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >{tickSizeAdj ? 'on' : 'off'}</button>
  </div>

  <div class="flex items-center gap-1">
    <span class="text-xs text-zinc-500">View:</span>
    <button
      onclick={() => (showCombined = !showCombined)}
      class="rounded px-2 py-1 text-xs transition-colors {showCombined
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >combined</button>
    <button
      onclick={() => (showBid = !showBid)}
      class="rounded px-2 py-1 text-xs transition-colors {showBid
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >bid</button>
    <button
      onclick={() => (showAsk = !showAsk)}
      class="rounded px-2 py-1 text-xs transition-colors {showAsk
        ? 'bg-violet-500/20 text-violet-400'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
    >ask</button>
  </div>
</div>

{#if fetchError && !freshData}
  <ErrorBanner message="Failed to load uptime data" />
{:else if showSkeleton}
  <div class="space-y-3">
    <ProgressLoader
      label={progressLabel}
      detail={progressDetail}
      estimatedMs={progressEstimateMs}
      elapsedMs={progressElapsedMs}
      elapsed={progressElapsedLabel}
    />
    <TableSkeleton rows={8} columns={skeletonColumns} />
  </div>
{:else if !freshData}
  <EmptyState message="No uptime data available." />
{:else if freshData.tickers.length === 0}
  <EmptyState message="No tickers in SLA for this period." hint="Check that SLA configuration is set for this market maker." />
{:else}
  <div class="relative space-y-4">
    {#each tickersByGroup as { group, tickers }}
      <div class="rounded border border-zinc-800 bg-zinc-900/30">
        <button
          type="button"
          onclick={() => toggleGroup(group)}
          class="flex w-full items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-800/35 px-3 py-2 text-left"
        >
          <span class="flex items-center gap-2">
            <span class="mono inline-block w-3 text-zinc-400">{isGroupCollapsed(group) ? '+' : '-'}</span>
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">{group}</span>
            <span class="text-[10px] text-zinc-600">({tickers.length})</span>
          </span>
        </button>

        {#if !isGroupCollapsed(group)}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th class="pb-2 pl-3 pr-4 pt-3 font-medium">Ticker</th>
                  {#if tickSizeAdj}
                    <th class="pb-2 pr-3 pt-3 text-right font-medium">Tick Adj</th>
                  {/if}
                  {#each allLevels as lvl}
                    <th class="pb-2 pr-2 pt-3 font-medium text-center" colspan={visibleMetricCount}>
                      {lvl.toUpperCase()}
                    </th>
                  {/each}
                </tr>
                <tr class="border-b border-zinc-800/50 text-xs text-zinc-600">
                  <th class="pb-1 pl-3 pr-4"></th>
                  {#if tickSizeAdj}
                    <th class="pb-1 pr-3"></th>
                  {/if}
                  {#each allLevels as _}
                    {#if showBid}
                      <th class="pb-1 pr-1 text-right font-normal">bid</th>
                    {/if}
                    {#if showAsk}
                      <th class="pb-1 pr-1 text-right font-normal">ask</th>
                    {/if}
                    {#if showCombined}
                      <th class="pb-1 pr-2 text-right font-normal">combined</th>
                    {/if}
                  {/each}
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-zinc-800/50 bg-zinc-800/20">
                  <td class="py-2 pl-3 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Thresholds</td>
                  {#if tickSizeAdj}
                    <td class="py-2 pr-3"></td>
                  {/if}
                  {#each allLevels as lvl}
                    {@const thresh = tickers[0]?.thresholds?.[lvl]}
                    <td class="py-2 pr-2 text-center text-[10px] text-zinc-500" colspan={visibleMetricCount}>
                      {#if thresh}
                        ${(thresh.usd / 1000).toFixed(0)}k / {thresh.bps}bps
                      {/if}
                    </td>
                  {/each}
                </tr>
                {#each tickers as ticker}
                  {@const tickSpread = ticker.thresholds[ticker.levels[0]]?.tickSpreadBps}
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td class="py-2 pl-3 pr-4 font-medium text-zinc-200">{ticker.ticker}</td>
                    {#if tickSizeAdj}
                      <td class="py-2 pr-3 text-right text-xs text-zinc-400">
                        {#if tickSpread != null}
                          {tickSpread.toFixed(2)} bps
                        {:else}
                          <span class="text-zinc-700">-</span>
                        {/if}
                      </td>
                    {/if}
                    {#each allLevels as lvl}
                      {@const lkey = lvl.toLowerCase() as 'l1' | 'l2' | 'l3' | 'l4'}
                      {@const levelData = ticker.summary[lkey]}
                      {#if ticker.levels.includes(lvl) && levelData}
                        {#if showBid}
                          <td class="py-2 pr-1 text-right"><PctCell value={levelData.bidPct} /></td>
                        {/if}
                        {#if showAsk}
                          <td class="py-2 pr-1 text-right"><PctCell value={levelData.askPct} /></td>
                        {/if}
                        {#if showCombined}
                          <td class="py-2 pr-2 text-right"><PctCell value={levelData.combinedPct} /></td>
                        {/if}
                      {:else}
                        {#if showBid}
                          <td class="py-2 pr-1 text-right text-zinc-700">-</td>
                        {/if}
                        {#if showAsk}
                          <td class="py-2 pr-1 text-right text-zinc-700">-</td>
                        {/if}
                        {#if showCombined}
                          <td class="py-2 pr-2 text-right text-zinc-700">-</td>
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

    {#if showRefreshOverlay}
      <div class="pointer-events-none absolute inset-0 rounded bg-zinc-900/55">
        <div class="absolute left-3 right-3 top-3 max-w-xl">
          <ProgressLoader
            compact={true}
            label={progressLabel}
            detail={progressDetail}
            estimatedMs={progressEstimateMs}
            elapsedMs={progressElapsedMs}
            elapsed={progressElapsedLabel}
          />
        </div>
      </div>
    {/if}
  </div>
{/if}
