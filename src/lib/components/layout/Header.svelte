<script lang="ts">
  import { page } from '$app/stores';

  const onMarkets = $derived($page.url.pathname.startsWith('/markets'));
  const onMarkout = $derived($page.url.pathname.startsWith('/markoutPnL'));
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
      <span class="relative flex cursor-not-allowed items-center px-3 text-[13px] text-zinc-600 opacity-50 select-none">
        MM Performance
      </span>
      <a
        href="/markoutPnL"
        data-sveltekit-preload-data="hover"
        class="relative flex items-center px-3 text-[13px] transition-colors {onMarkout
          ? 'text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300'}"
      >
        Markout PnL
        {#if onMarkout}
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
