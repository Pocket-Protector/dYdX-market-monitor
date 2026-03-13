<script lang="ts">
  import type { MmConfig } from '$lib/config/mms';
  import { nicknamesStore, getNickname } from '$lib/stores/nicknames';

  const { mm }: { mm: MmConfig } = $props();

  const nickname = $derived(getNickname($nicknamesStore, mm.address));
  const truncated = $derived(
    mm.address.length > 10
      ? mm.address.slice(0, 8) + '…' + mm.address.slice(-4)
      : mm.address
  );
</script>

<a
  href="/mm/{mm.slug}"
  data-sveltekit-preload-data="hover"
  class="group flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-violet-500/50 hover:bg-zinc-800/50"
>
  <div class="mb-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
    Market Maker
  </div>
  <div class="text-lg font-semibold text-zinc-100 group-hover:text-violet-400 transition-colors">
    {#if nickname}
      <span>{nickname}</span>
      <span class="block text-xs font-normal text-zinc-500 mono">{truncated}</span>
    {:else}
      <span class="mono" title={mm.address}>{truncated}</span>
    {/if}
  </div>
  <div class="mt-4 text-sm text-zinc-400">
    View performance →
  </div>
</a>
