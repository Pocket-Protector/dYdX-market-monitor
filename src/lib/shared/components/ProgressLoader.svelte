<script lang="ts">
  let {
    label,
    detail = '',
    percent = 0,
    estimatedMs = null,
    elapsedMs = null,
    elapsed = '',
    compact = false
  }: {
    label: string;
    detail?: string;
    percent?: number;
    estimatedMs?: number | null;
    elapsedMs?: number | null;
    elapsed?: string;
    compact?: boolean;
  } = $props();

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(1, Math.round(ms / 1000));
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }

  const safePercent = $derived(Math.max(0, Math.min(100, percent)));
  const safeEstimatedMs = $derived(estimatedMs != null && estimatedMs > 0 ? estimatedMs : null);
  const safeElapsedMs = $derived(elapsedMs != null && elapsedMs >= 0 ? elapsedMs : null);
  const usesEstimate = $derived(safeEstimatedMs != null && safeElapsedMs != null);
  const overEstimate = $derived(Boolean(usesEstimate && safeElapsedMs! > safeEstimatedMs!));
  const displayPercent = $derived.by(() => {
    if (usesEstimate) {
      const ratio = safeElapsedMs! / safeEstimatedMs!;
      return Math.max(10, Math.min(100, Math.round(ratio * 100)));
    }
    return safePercent;
  });
  const footerLabel = $derived(
    usesEstimate
      ? overEstimate
        ? 'Longer than estimate'
        : 'Estimated progress'
      : displayPercent >= 100
        ? 'Finishing request'
        : 'Request in progress'
  );
  const footerMeta = $derived(
    safeEstimatedMs != null
      ? `~${formatDuration(safeEstimatedMs)} expected`
      : `${Math.round(displayPercent)}% shown`
  );
</script>

<div class={`rounded border border-violet-500/20 bg-zinc-900/85 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <div class={`font-medium text-violet-300 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</div>
      {#if detail}
        <div class={`mt-1 text-zinc-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>{detail}</div>
      {/if}
    </div>
    {#if elapsed}
      <div class="mono shrink-0 text-[11px] text-zinc-500">{elapsed}</div>
    {/if}
  </div>

  <div class={`mt-3 overflow-hidden rounded-full bg-zinc-800 ${compact ? 'h-1.5' : 'h-2'}`}>
    <div
      class={`h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400 transition-[width,opacity] duration-500 ease-out ${overEstimate ? 'animate-pulse opacity-85' : ''}`}
      style={`width: ${displayPercent}%`}
    ></div>
  </div>

  <div class="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
    <span>{footerLabel}</span>
    <span>{footerMeta}</span>
  </div>
</div>
