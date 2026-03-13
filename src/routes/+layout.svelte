<script lang="ts">
  import '../app.css';
  import { navigating } from '$app/stores';
  import Header from '$lib/components/layout/Header.svelte';
  import StatusBar from '$lib/components/layout/StatusBar.svelte';
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
  {#if $navigating}
    <div class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-violet-500/20">
      <div class="loading-bar h-full w-1/3 bg-violet-400"></div>
    </div>
  {/if}
  <Header />
  {@render children()}
  <StatusBar />
</div>
