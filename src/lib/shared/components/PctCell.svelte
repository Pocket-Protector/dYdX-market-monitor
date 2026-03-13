<script lang="ts">
  const { value }: { value: number | null | undefined } = $props();

  function colorClass(v: number | null | undefined): string {
    if (v == null) return 'text-zinc-500';
    if (v >= 95) return 'text-emerald-400';
    if (v >= 70) return 'text-amber-400';
    return 'text-red-400';
  }

  function display(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${v.toFixed(1)}%`;
  }
</script>

<span class="mono {colorClass(value)}">{display(value)}</span>
