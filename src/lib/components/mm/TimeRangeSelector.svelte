<script lang="ts">
  import { updateParams } from '$lib/utils/params';
  import { presetToFromTo, type Preset } from '$lib/utils/dates';

  const { from, to }: { from: string; to: string } = $props();

  const comingSoonTooltip = 'Coming soon. Only the current 24h range is enabled right now.';

  const presets: { label: string; value: Preset; enabled: boolean }[] = [
    { label: 'Today', value: '24h', enabled: true },
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
    return range.from === from && range.to.slice(0, 10) === to.slice(0, 10);
  }

  function getPresetTooltip(preset: { value: Preset; enabled: boolean }): string | undefined {
    if (!preset.enabled) return comingSoonTooltip;
    if (preset.value !== '24h') return undefined;

    const range = presetToFromTo('24h');
    return `Shows data from midnight ${range.from} up to right now.`;
  }
</script>

<div class="flex items-center gap-2">
  <span class="text-xs text-zinc-500">Range:</span>

  {#each presets as preset}
    <button
      title={getPresetTooltip(preset)}
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

  <div class="ml-2 flex items-center gap-1" title="Custom date selection coming soon.">
    <input
      type="date"
      value={from}
      disabled
      class="cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-500"
    />
    <span class="text-zinc-600">-></span>
    <input
      type="date"
      value={to.slice(0, 10)}
      disabled
      class="cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-xs text-zinc-500"
    />
  </div>
</div>
