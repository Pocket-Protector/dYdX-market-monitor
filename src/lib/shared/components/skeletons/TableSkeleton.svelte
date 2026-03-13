<script lang="ts">
  const { rows = 8, columns = 5 }: { rows?: number; columns?: number } = $props();

  const rowIndexes = $derived(Array.from({ length: rows }, (_, i) => i));
  const colIndexes = $derived(Array.from({ length: columns }, (_, i) => i));
</script>

<div class="space-y-2">
  <div
    class="grid gap-3 border-b border-zinc-800 pb-2"
    style={`grid-template-columns: repeat(${columns}, minmax(0, 1fr));`}
  >
    {#each colIndexes as col}
      <div class="skeleton h-3 rounded" style={`width: ${col === 0 ? '65%' : '80%'};`}></div>
    {/each}
  </div>

  {#each rowIndexes as row}
    <div
      class="grid gap-3 py-1.5"
      style={`grid-template-columns: repeat(${columns}, minmax(0, 1fr));`}
    >
      {#each colIndexes as col}
        <div class="skeleton h-4 rounded" style={`width: ${col === 0 ? '70%' : '88%'};`}></div>
      {/each}
    </div>
  {/each}
</div>
