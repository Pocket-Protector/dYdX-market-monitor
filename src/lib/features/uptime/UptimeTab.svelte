<script lang="ts">
  import { onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { useSWR } from 'sswr';
  import { updateParams } from '$lib/utils/params';
  import PctCell from '$lib/shared/components/PctCell.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import type { UptimeTicker } from '$lib/shared/sla/types';

  interface UptimePayload {
    mm: string;
    from: string;
    to: string;
    bpsLeeway: number;
    tickers: UptimeTicker[];
  }

  const {
    slug,
    from,
    to,
    bpsLeeway
  }: { slug: string; from: string; to: string; bpsLeeway: number } = $props();

  let leeway = $state(0);
  let loadedKey = $state<string | null>(null);
  let isApplyingLeeway = $state(false);
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  let showBid = $state(false);
  let showAsk = $state(false);
  const showCombined = true;
  let collapsedGroups = $state<Record<string, boolean>>({});

  const activeLeeway = $derived(parseFloat($page.url.searchParams.get('leeway') ?? String(bpsLeeway)));

  $effect(() => {
    leeway = Number.isFinite(activeLeeway) ? activeLeeway : bpsLeeway;
  });

  function onLeewayInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    leeway = Number.isFinite(val) ? val : 0;

    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitLeeway();
      commitTimer = null;
    }, 250);
  }

  function commitLeeway() {
    const normalized = Math.max(0, Math.min(0.5, Math.round(leeway * 20) / 20));
    leeway = normalized;

    if (normalized === activeLeeway) {
      isApplyingLeeway = false;
      return;
    }

    isApplyingLeeway = true;
    const next = normalized.toFixed(2).replace(/\.?0+$/, '');
    updateParams({ leeway: next });
  }

  function flushLeewayCommit() {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
    commitLeeway();
  }

  onDestroy(() => {
    if (commitTimer) clearTimeout(commitTimer);
  });

  const uptimeKey = $derived(`/api/uptime/${slug}?from=${from}&to=${to}&bpsLeeway=${activeLeeway}`);

  const { data, error, isLoading } = useSWR<UptimePayload>(
    () => uptimeKey,
    { refreshInterval: 60_000, dedupingInterval: 1_800_000 }
  );

  $effect(() => {
    if ($data) {
      loadedKey = uptimeKey;
      if (loadedKey === uptimeKey) isApplyingLeeway = false;
    }
  });

  const isPending = $derived($isLoading || loadedKey !== uptimeKey || isApplyingLeeway);

  const allLevels = $derived(
    $data
      ? [...new Set($data.tickers.flatMap((t) => t.levels))].sort()
      : []
  );

  function groupRank(group: string): number {
    const match = group.match(/group\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  }

  const visibleMetricCount = $derived((showBid ? 1 : 0) + (showAsk ? 1 : 0) + 1);

  const tickersByGroup = $derived(
    $data
      ? (() => {
          const map = new Map<string, typeof $data.tickers>();
          for (const t of $data.tickers) {
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
    return Boolean(collapsedGroups[group]);
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
  <label class="text-xs text-zinc-400">
    bps leeway:
    <input
      type="range"
      min="0"
      max="0.5"
      step="0.05"
      value={leeway}
      oninput={onLeewayInput}
      onchange={flushLeewayCommit}
      onmouseup={flushLeewayCommit}
      onkeyup={(e) => e.key === 'Enter' && flushLeewayCommit()}
      class="ml-2 w-32 accent-violet-500"
    />
    <span class="mono ml-1 text-zinc-300">{(leeway * 100).toFixed(0)}%</span>
  </label>

  <div class="flex items-center gap-1">
    <span class="text-xs text-zinc-500">View:</span>
    <span class="rounded px-2 py-1 text-xs bg-violet-500/20 text-violet-400">combined</span>
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

{#if $error && !$data}
  <ErrorBanner message="Failed to load uptime data" />
{:else if !$data && $isLoading}
  <TableSkeleton rows={8} columns={6} />
{:else if !$data}
  <EmptyState message="No uptime data available." />
{:else if $data.tickers.length === 0}
  <EmptyState message="No tickers in SLA for this period." hint="Check that SLA configuration is set for this market maker." />
{:else}
  <div class="relative">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500">
            <th class="pb-2 pr-4 font-medium">Ticker</th>
            {#each allLevels as lvl}
              <th class="pb-2 pr-2 font-medium text-center" colspan={visibleMetricCount}>
                {lvl.toUpperCase()}
              </th>
            {/each}
          </tr>
          <tr class="border-b border-zinc-800/50 text-xs text-zinc-600">
            <th class="pb-1 pr-4"></th>
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
          {#each tickersByGroup as { group, tickers }}
            <tr class="border-b border-zinc-700/60 bg-zinc-800/25">
              <td class="py-1 pl-2 text-xs font-semibold tracking-wide text-zinc-500">
                <button
                  type="button"
                  onclick={() => toggleGroup(group)}
                  class="flex w-full items-center gap-2 text-left hover:text-zinc-300"
                >
                  <span class="mono inline-block w-3 text-zinc-400">{isGroupCollapsed(group) ? '+' : '-'}</span>
                  <span>{group}</span>
                  <span class="text-[10px] text-zinc-600">({tickers.length})</span>
                </button>
              </td>
              {#each allLevels as lvl}
                {@const thresh = tickers[0]?.thresholds?.[lvl]}
                <td class="py-1 pr-2 text-center text-[10px] text-zinc-500" colspan={visibleMetricCount}>
                  {#if thresh}
                    ${(thresh.usd / 1000).toFixed(0)}k / {thresh.bpsEffective}bps
                  {/if}
                </td>
              {/each}
            </tr>
            {#if !isGroupCollapsed(group)}
              {#each tickers as ticker}
              <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td class="py-2 pr-4 font-medium text-zinc-200">{ticker.ticker}</td>
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
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if isPending}
      <div class="pointer-events-none absolute inset-0 rounded bg-zinc-900/55">
        <div class="absolute right-3 top-3 rounded bg-zinc-900/90 px-2 py-1 text-xs text-violet-300">
          Refreshing...
        </div>
      </div>
    {/if}
  </div>
{/if}
