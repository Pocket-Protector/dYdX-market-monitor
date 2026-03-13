<script lang="ts">
  const {
    message = 'No data for this period.',
    hint = 'Try adjusting the time range or filters.'
  }: { message?: string; hint?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center py-14 text-center">
  <div class="mb-4 text-zinc-700">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" rx="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <line x1="9" y1="27" x2="9" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="15" y1="27" x2="15" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="27" x2="21" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="27" y1="27" x2="27" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="7" y1="9" x2="29" y2="9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 2"/>
    </svg>
  </div>
  <p class="text-sm font-medium text-zinc-400">{message}</p>
  <p class="mt-1 text-xs text-zinc-600">{hint}</p>
</div>
