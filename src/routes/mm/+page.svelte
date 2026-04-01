<script lang="ts">
  import { browser } from '$app/environment';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import { fetchMmActivity, getMmTableActivityCopy } from '$lib/shared/mm-activity';
  import type { MmActivity } from '$lib/shared/types';
  import { getNickname, nicknamesStore } from '$lib/stores/nicknames';
  import { formatUsd } from '$lib/utils/format';
  import { mapWithConcurrency } from '$lib/utils/request-cache';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  function createActivityState(loading: boolean): MmActivity {
    return {
      lastFillAt: null,
      lastMakerFillAt: null,
      lastFillInRangeAt: null,
      lastMakerFillInRangeAt: null,
      makerVolumeInRange: 0,
      makerTickerCountInRange: 0,
      loading
    };
  }

  function truncateAddress(address: string): string {
    return address.length > 10 ? address.slice(0, 8) + '...' + address.slice(-4) : address;
  }

  function trailing24hRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: to.toISOString()
    };
  }

  function toneClass(tone: 'neutral' | 'good' | 'warn' | 'bad'): string {
    if (tone === 'good') return 'text-emerald-300';
    if (tone === 'warn') return 'text-amber-300';
    if (tone === 'bad') return 'text-red-300';
    return 'text-zinc-300';
  }

  type SortCol = 'makerVolume' | 'makerTickers';

  let activityBySlug = $state<Record<string, MmActivity>>({});
  let sortCol = $state<SortCol>('makerVolume');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'desc';
    }
  }

  const rows = $derived.by(() =>
    {
      const baseRows = data.mms.map((mm, index) => {
      const activity = activityBySlug[mm.slug] ?? createActivityState(true);
      const activityCopy = getMmTableActivityCopy(activity);
      return {
        index,
        mm,
        href: `/mm/${mm.slug}`,
        nickname: getNickname($nicknamesStore, mm.address),
        shortAddress: truncateAddress(mm.address),
        activity,
        activityCopy,
        activityToneClass: toneClass(activityCopy.tone),
        makerVolumeLabel: activity.loading ? '...' : formatUsd(activity.makerVolumeInRange),
        makerTickerLabel: activity.loading ? '...' : String(activity.makerTickerCountInRange)
      };
      });

      return [...baseRows].sort((a, b) => {
        const av = sortCol === 'makerVolume'
          ? a.activity.makerVolumeInRange
          : a.activity.makerTickerCountInRange;
        const bv = sortCol === 'makerVolume'
          ? b.activity.makerVolumeInRange
          : b.activity.makerTickerCountInRange;

        if (av !== bv) return (sortDir === 'asc' ? 1 : -1) * (av - bv);
        return a.index - b.index;
      });
    }
  );

  $effect(() => {
    if (!browser) return;

    const controller = new AbortController();
    let cancelled = false;

    const nextState: Record<string, MmActivity> = {};
    for (const mm of data.mms) {
      nextState[mm.slug] = createActivityState(true);
    }
    activityBySlug = nextState;
    const range = trailing24hRange();

    void mapWithConcurrency(data.mms, 4, async (mm) => {
      try {
        const activity = await fetchMmActivity(
          mm.address,
          mm.subaccounts,
          range.from,
          range.to,
          controller.signal
        );
        if (cancelled) return;
        activityBySlug = { ...activityBySlug, [mm.slug]: activity };
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        activityBySlug = { ...activityBySlug, [mm.slug]: createActivityState(false) };
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  });
</script>

<PageShell>
  <div class="mb-8">
    <h1 class="text-2xl font-semibold text-zinc-100">MM Performance</h1>
    <p class="mt-1 text-sm text-zinc-400">Market maker analytics and SLA compliance</p>
  </div>

  {#if data.mms.length === 0}
    <div class="rounded border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-400">
      No market makers configured. Create <code class="font-mono">mm-config.json</code> from the example file.
    </div>
  {:else}
    <div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="bg-zinc-900/95 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
              <th rowspan="2" class="w-[20rem] border-b border-r border-zinc-800 px-4 py-3 align-bottom">MM</th>
              <th colspan="3" class="border-b border-zinc-800 px-4 py-3 text-center">Last 24 Hours</th>
            </tr>
            <tr class="bg-zinc-900/95 text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              <th class="border-b border-zinc-800 px-4 py-3">Last maker</th>
              <th class="border-b border-zinc-800 px-4 py-3">
                <button
                  type="button"
                  title="Total maker fill volume in the trailing 24h"
                  onclick={() => toggleSort('makerVolume')}
                  class="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                >
                  Volume
                  <span class="{sortCol === 'makerVolume' ? 'text-violet-400' : 'text-zinc-700'}">
                    {sortCol === 'makerVolume' ? (sortDir === 'asc' ? '^' : 'v') : '+-'}
                  </span>
                </button>
              </th>
              <th class="border-b border-zinc-800 px-4 py-3">
                <button
                  type="button"
                  title="Number of unique tickers with maker fill volume"
                  onclick={() => toggleSort('makerTickers')}
                  class="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                >
                  Tickers
                  <span class="{sortCol === 'makerTickers' ? 'text-violet-400' : 'text-zinc-700'}">
                    {sortCol === 'makerTickers' ? (sortDir === 'asc' ? '^' : 'v') : '+-'}
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class="group border-b border-zinc-800/80 last:border-b-0">
                <td class="p-0 align-middle">
                  <a
                    href={row.href}
                    data-sveltekit-preload-data="hover"
                    class="block min-h-[84px] px-4 py-4 transition-colors group-hover:bg-zinc-800/35 group-focus-within:bg-zinc-800/35"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-base font-semibold text-zinc-100 transition-colors group-hover:text-violet-400">
                        {row.nickname ?? row.mm.name}
                      </span>
                      {#if row.nickname}
                        <span class="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                          {row.mm.name}
                        </span>
                      {/if}
                    </div>
                    <div class="mt-1 mono text-xs text-zinc-500" title={row.mm.address}>
                      {row.shortAddress}
                    </div>
                  </a>
                </td>
                <td class="p-0 align-middle">
                  <a
                    href={row.href}
                    data-sveltekit-preload-data="hover"
                    class="flex min-h-[84px] items-center justify-between gap-4 px-4 py-4 transition-colors group-hover:bg-zinc-800/35 group-focus-within:bg-zinc-800/35"
                  >
                    <div class="min-w-0">
                      <div class="truncate text-sm {row.activityToneClass}">
                        {row.activityCopy.primary}
                      </div>
                      {#if row.activityCopy.secondary}
                        <div class="mt-1 text-xs text-zinc-500">{row.activityCopy.secondary}</div>
                      {/if}
                    </div>
                  </a>
                </td>
                <td class="p-0 align-middle">
                  <a
                    href={row.href}
                    data-sveltekit-preload-data="hover"
                    class="flex min-h-[84px] items-center px-4 py-4 transition-colors group-hover:bg-zinc-800/35 group-focus-within:bg-zinc-800/35"
                  >
                    <div>
                      <div class="mono text-sm font-medium {row.activity.makerVolumeInRange > 0 ? 'text-zinc-100' : 'text-zinc-500'}">
                        {row.makerVolumeLabel}
                      </div>
                    </div>
                  </a>
                </td>
                <td class="p-0 align-middle">
                  <a
                    href={row.href}
                    data-sveltekit-preload-data="hover"
                    class="flex min-h-[84px] items-center justify-between gap-4 px-4 py-4 transition-colors group-hover:bg-zinc-800/35 group-focus-within:bg-zinc-800/35"
                  >
                    <div>
                      <div class="mono text-sm font-medium {row.activity.makerTickerCountInRange > 0 ? 'text-zinc-100' : 'text-zinc-500'}">
                        {row.makerTickerLabel}
                      </div>
                    </div>
                    <span class="shrink-0 text-xs font-medium text-zinc-600 transition-colors group-hover:text-violet-400">
                      Open ->
                    </span>
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</PageShell>
