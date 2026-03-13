<script lang="ts">
  import { page } from '$app/stores';

  const onMm = $derived($page.url.pathname.startsWith('/mm'));
  const onMarkets = $derived($page.url.pathname.startsWith('/markets'));
</script>

<header class="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
  <div class="mx-auto flex max-w-screen-xl items-stretch gap-8 px-6">

    <!-- Wordmark -->
    <a href="/" data-sveltekit-preload-data="hover" class="flex items-center gap-2.5 py-3.5">
      <!-- Pulse / chart icon -->
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="18" height="18" rx="4" stroke="#8b5cf6" stroke-width="1.25" fill="none"/>
        <polyline points="3,13 6,9 9,11 12,5 15,8 17,7" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="17" cy="7" r="1.5" fill="#a78bfa"/>
      </svg>
      <span class="text-[13px] leading-none tracking-wide">
        <span class="font-light text-zinc-400">dYdX</span><span class="font-semibold text-zinc-100"> Monitor</span>
      </span>
    </a>

    <!-- Nav -->
    <nav class="flex items-stretch gap-0.5">
      <a
        href="/mm"
        data-sveltekit-preload-data="hover"
        class="relative flex items-center px-3 text-[13px] transition-colors {onMm
          ? 'text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300'}"
      >
        MM Performance
        {#if onMm}
          <span class="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full bg-violet-500"></span>
        {/if}
      </a>
      <a
        href="/markets"
        class="relative flex items-center px-3 text-[13px] transition-colors {onMarkets
          ? 'text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300'}"
      >
        Live Metrics
        {#if onMarkets}
          <span class="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full bg-violet-500"></span>
        {/if}
      </a>
    </nav>

  </div>
</header>
