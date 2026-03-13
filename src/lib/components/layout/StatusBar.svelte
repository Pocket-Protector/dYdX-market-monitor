<script lang="ts">
  import { prefetchStatuses, lastPrefetchAt } from '$lib/stores/prefetch';
  import { page } from '$app/stores';

  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => { now = Date.now(); }, 10_000);
    return () => clearInterval(id);
  });

  function relativeTime(ts: number | null): string {
    if (!ts) return '';
    const s = Math.floor((now - ts) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  const isOnMmPage = $derived($page.url.pathname.startsWith('/mm/'));
  const visible = $derived(isOnMmPage && $prefetchStatuses.length > 0);
  const hasError = $derived($prefetchStatuses.some(s => s.status === 'error'));
  const allSettled = $derived($prefetchStatuses.every(s => s.status !== 'loading'));
</script>

{#if visible}
  <div class="fixed bottom-0 inset-x-0 z-40 flex items-center gap-4 border-t border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur text-[11px] text-zinc-500">

    <!-- API status -->
    <div class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-2 rounded-full {hasError ? 'bg-red-500' : 'bg-emerald-500'}"></span>
      <span class="{hasError ? 'text-red-400' : ''}">API</span>
    </div>

    <span class="text-zinc-700">·</span>

    <!-- All 4 tabs, always shown -->
    <div class="flex items-center gap-3">
      {#each $prefetchStatuses as { label, status, active }}
        <div class="flex items-center gap-1.5 {active ? 'opacity-40' : ''}">
          {#if status === 'loading'}
            <span class="inline-block h-2 w-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span class="text-purple-400">{label}</span>
          {:else if status === 'done'}
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span class="text-zinc-400">{label}</span>
          {:else if status === 'error'}
            <span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
            <span class="text-red-400">{label}</span>
          {:else}
            <span class="inline-block h-2 w-2 rounded-full bg-zinc-700"></span>
            <span>{label}</span>
          {/if}
        </div>
      {/each}
    </div>

    {#if $lastPrefetchAt && allSettled}
      <span class="text-zinc-700">·</span>
      <span>Updated {relativeTime($lastPrefetchAt)}</span>
    {/if}
  </div>
{/if}
