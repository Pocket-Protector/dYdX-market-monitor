<script lang="ts">
  import type { Snippet } from 'svelte';
  const { children }: { children: Snippet } = $props();
</script>

<main class="mx-auto max-w-screen-xl px-6 py-8">
  {@render children()}
</main>
