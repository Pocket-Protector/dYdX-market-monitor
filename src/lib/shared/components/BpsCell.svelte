<script lang="ts">
  const { value }: { value: number | null | undefined } = $props();
</script>

{#if value == null}
  <span class="text-zinc-500">—</span>
{:else}
  <span class="mono text-zinc-100">{value.toFixed(1)}</span>
{/if}
