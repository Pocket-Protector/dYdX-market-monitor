<script lang="ts">
  import { browser } from '$app/environment';
  import { nicknamesStore, getNickname, setNickname, removeNickname } from '$lib/stores/nicknames';

  const { address }: { address: string } = $props();

  let editing = $state(false);
  let draft = $state('');
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  const nickname = $derived(getNickname($nicknamesStore, address));
  const truncated = $derived(
    address.length > 10
      ? address.slice(0, 8) + '…' + address.slice(-4)
      : address
  );

  async function copyAddress(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {}
  }

  function startEdit(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    draft = nickname ?? '';
    editing = true;
  }

  function save() {
    editing = false;
    const val = draft.trim();
    if (val) {
      setNickname(address, val);
    } else {
      removeNickname(address);
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      editing = false;
    }
  }

  function clearNickname(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    removeNickname(address);
    editing = false;
  }
</script>

{#if editing}
  <div class="flex items-center gap-1.5">
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      bind:value={draft}
      autofocus
      onblur={save}
      onkeydown={onKeydown}
      placeholder="Enter name…"
      class="w-40 rounded border border-violet-500/50 bg-zinc-900 px-2 py-0.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
    />
  </div>
{:else}
  <div class="flex items-center gap-2">
    <div class="flex flex-col">
      {#if nickname}
        <span class="text-2xl font-semibold text-zinc-100">{nickname}</span>
      {/if}
      <button
        onclick={copyAddress}
        title={copied ? 'Copied!' : `Click to copy: ${address}`}
        class="group/addr flex items-center gap-1 text-left transition-colors
          {nickname
            ? 'text-xs text-zinc-500 hover:text-zinc-300'
            : 'text-2xl font-semibold text-zinc-100 hover:text-violet-400'}"
      >
        <span class="mono">{copied ? 'Copied!' : truncated}</span>
        <svg
          class="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/addr:opacity-60"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>

    <button
      onclick={startEdit}
      title={nickname ? 'Edit nickname' : 'Set a local nickname'}
      class="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
    >
      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>

    {#if nickname}
      <button
        onclick={clearNickname}
        title="Remove nickname"
        class="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    {/if}
  </div>
{/if}
