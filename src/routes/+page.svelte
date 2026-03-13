<script lang="ts">
  import PageShell from '$lib/components/layout/PageShell.svelte';
</script>

<PageShell>
  <div class="mb-8">
    <h1 class="text-2xl font-semibold text-zinc-100">Dashboard</h1>
    <p class="mt-1 text-sm text-zinc-400">dYdX market maker analytics</p>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/mm"
      data-sveltekit-preload-data="hover"
      class="group rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-violet-500/50 hover:bg-zinc-800/50"
    >
      <div class="mb-2 text-xs font-medium tracking-widest text-zinc-500 uppercase">Section</div>
      <div class="text-lg font-semibold text-zinc-100 group-hover:text-violet-400 transition-colors">
        MM Performance
      </div>
      <p class="mt-2 text-sm text-zinc-400">
        Uptime, liquidity, spread and depth analytics per market maker
      </p>
    </a>
    <a
      href="/markets"
      class="group rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-violet-500/50 hover:bg-zinc-800/50"
    >
      <div class="mb-2 text-xs font-medium tracking-widest text-zinc-500 uppercase">Section</div>
      <div class="text-lg font-semibold text-zinc-100 group-hover:text-violet-400 transition-colors">
        Live Metrics
      </div>
      <p class="mt-2 text-sm text-zinc-400">
        Real-time perpetual market data — prices, volume, funding rates and tick spreads
      </p>
    </a>
  </div>
</PageShell>
