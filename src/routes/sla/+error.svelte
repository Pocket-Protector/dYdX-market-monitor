<script lang="ts">
  import { page } from '$app/state';
  import PageShell from '$lib/components/layout/PageShell.svelte';

  function retry() {
    location.reload();
  }
</script>

<PageShell>
  <div class="py-20 text-center">
    <p class="text-4xl font-bold text-zinc-400">{page.status}</p>
    <p class="mt-3 text-zinc-300">
      {page.error?.message ?? 'An unexpected error occurred.'}
    </p>
    <div class="mt-6 flex justify-center gap-3">
      <button
        type="button"
        onclick={retry}
        class="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/25"
      >
        Retry
      </button>
      <a href="/sla" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-violet-300 hover:text-violet-200">
        Back to MM SLA
      </a>
    </div>
  </div>
</PageShell>
