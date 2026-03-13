<script lang="ts">
  let {
    label,
    detail = '',
    percent = 0,
    elapsed = '',
    compact = false
  }: {
    label: string;
    detail?: string;
    percent?: number;
    elapsed?: string;
    compact?: boolean;
  } = $props();

  const clampedPercent = $derived(Math.max(0, Math.min(100, percent)));
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
      class="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400 transition-[width] duration-300 ease-out"
      style={`width: ${clampedPercent}%`}
    ></div>
  </div>

  <div class="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
    <span>{Math.round(clampedPercent)}%</span>
    <span>{clampedPercent >= 90 ? 'Waiting on API' : 'Request in progress'}</span>
  </div>
</div>
