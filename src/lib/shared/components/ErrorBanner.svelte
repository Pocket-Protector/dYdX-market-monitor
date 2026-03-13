<script lang="ts">
  const { message }: { message: string } = $props();
</script>

<div class="rounded border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
  {message}
</div>
