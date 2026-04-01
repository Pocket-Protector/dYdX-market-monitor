<script lang="ts">
  import AddressDisplay from '$lib/shared/components/AddressDisplay.svelte';
  import { getMmHeaderActivityLabel } from '$lib/shared/mm-activity';
  import type { MmActivity } from '$lib/shared/types';

  const { address, from, to, activity }: {
    address: string;
    from: string;
    to: string;
    activity?: MmActivity;
  } = $props();

  const activityLabel = $derived.by(() => getMmHeaderActivityLabel(activity));
</script>

<div class="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <div class="text-xs font-medium tracking-widest text-zinc-500 uppercase">Market Maker</div>
    <AddressDisplay {address} />
    {#if activity}
      <div class="mt-1 text-xs text-zinc-500">{activityLabel}</div>
    {/if}
  </div>
  <div class="text-sm text-zinc-400">
    <span class="mono">{from}</span>
    <span class="text-zinc-600 mx-1">→</span>
    <span class="mono">{to}</span>
  </div>
</div>
