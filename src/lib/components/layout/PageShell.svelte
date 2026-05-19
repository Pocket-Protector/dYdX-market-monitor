<script lang="ts">
  import type { Snippet } from 'svelte';
  const { children, wide = false }: { children: Snippet; wide?: boolean } = $props();
</script>

<main class="mx-auto px-6 py-8 {wide ? 'max-w-none' : 'max-w-screen-xl'}">
  {@render children()}
</main>
