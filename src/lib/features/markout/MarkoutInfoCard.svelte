<script lang="ts">
  const { title, lines, compact = false }: { title: string; lines: string[]; compact?: boolean } = $props();
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/75 p-4">
  <div class="flex items-center gap-2">
    <div class="h-2.5 w-2.5 rounded-full bg-violet-400"></div>
    <h2 class="text-sm font-semibold text-zinc-100">{title}</h2>
  </div>
  <div class="mt-3 grid gap-2 {compact ? 'md:grid-cols-2' : 'lg:grid-cols-2'}">
    {#each lines as line}
      <div class="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm leading-6 text-zinc-300">
        {line}
      </div>
    {/each}
  </div>
</section>
