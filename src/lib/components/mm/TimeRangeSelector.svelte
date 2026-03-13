<script lang="ts">
  import { updateParams } from '$lib/utils/params';
  import { presetToFromTo, type Preset } from '$lib/utils/dates';

  const { from, to }: { from: string; to: string } = $props();

  const tooltip = 'Coming soon';

  const presets: { label: string; value: Preset; enabled: boolean }[] = [
    { label: '24h', value: '24h', enabled: true },
    { label: '7d', value: '7d', enabled: false },
    { label: '30d', value: '30d', enabled: false }
  ];

  function applyPreset(preset: Preset, enabled: boolean) {
    if (!enabled) return;
    const range = presetToFromTo(preset);
    updateParams({ from: range.from, to: range.to });
  }

  function isActive(preset: Preset): boolean {
    const range = presetToFromTo(preset);
    return range.from === from && range.to === to;
  }
</script>

<div class="flex items-center gap-2">
  <span class="text-xs text-zinc-500">Range:</span>

  {#each presets as preset}
    <button
      title={!preset.enabled ? tooltip : undefined}
      aria-disabled={!preset.enabled}
      onclick={() => applyPreset(preset.value, preset.enabled)}
      class="rounded px-2 py-1 text-xs font-medium transition-colors {preset.enabled
        ? (isActive(preset.value)
            ? 'bg-violet-500/20 text-violet-400'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800')
        : 'cursor-not-allowed text-zinc-600 bg-zinc-900/40'}"
    >
      {preset.label}
    </button>
  {/each}

  <div class="ml-2 flex items-center gap-1" title={tooltip}>
    <input
      type="date"
      value={from}
      disabled
      class="cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-500"
    />
    <span class="text-zinc-600">-></span>
    <input
      type="date"
      value={to}
      disabled
      class="cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-500"
    />
  </div>
</div>
