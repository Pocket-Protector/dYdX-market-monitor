<script lang="ts">
  import { page } from '$app/state';
  import PageShell from '$lib/components/layout/PageShell.svelte';
</script>

<PageShell>
  <div class="py-20 text-center">
    <p class="text-4xl font-bold text-zinc-400">{page.status}</p>
    <p class="mt-3 text-zinc-300">
      {page.error?.message ?? 'An unexpected error occurred.'}
    </p>
    <a href="/sla" class="mt-6 inline-block text-sm text-violet-300 hover:text-violet-200">
      ← Back to MM SLA
    </a>
  </div>
</PageShell>
