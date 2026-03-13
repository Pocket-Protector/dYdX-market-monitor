<script lang="ts">
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MmCard from '$lib/components/mm/MmCard.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
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
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.mms as mm}
        <MmCard {mm} />
      {/each}
    </div>
  {/if}
</PageShell>
