<script lang="ts">
  const { height = 'h-64' }: { height?: string } = $props();
</script>

<div class={`w-full rounded border border-zinc-800 bg-zinc-900/40 p-2 ${height}`}>
  <div class="skeleton h-full w-full rounded"></div>
</div>
