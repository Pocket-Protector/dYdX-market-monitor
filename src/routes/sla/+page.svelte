<script lang="ts">
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import DateRangeSelector from '$lib/shared/components/DateRangeSelector.svelte';
  import { formatUsd } from '$lib/utils/format';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const today = new Date().toISOString().slice(0, 10);
</script>

<PageShell>
  <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-zinc-100">MM SLA</h1>
      <p class="mt-1 text-sm text-zinc-400">SLA compliance overview for all tracked market makers.</p>
    </div>
    <DateRangeSelector
      from={data.from}
      to={data.to}
      min={data.minDate}
      max={today}
      label="Time duration"
    />
  </div>

  <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
          <th class="px-4 py-3">MM</th>
          <th class="px-4 py-3 text-right">Total Avg Liquidity Quoted</th>
          <th class="px-4 py-3 text-right">First Tracking Date</th>
          <th class="px-4 py-3 text-right">Latest Data Point</th>
        </tr>
      </thead>
      <tbody>
        {#each data.rows as row}
          <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
            <td class="px-4 py-3">
              <a
                href={`/sla/${row.mmSlug}`}
                class="font-medium text-violet-300 hover:text-violet-200"
              >
                {row.displayName}
              </a>
            </td>
            <td class="mono px-4 py-3 text-right text-zinc-100">
              {formatUsd(row.totalAvgLiquidityQuotedUsd)}
            </td>
            <td class="mono px-4 py-3 text-right text-zinc-300">
              {row.firstTrackingDate}
            </td>
            <td class="mono px-4 py-3 text-right text-zinc-300">
              {new Date(row.latestDataPoint).toLocaleString()}
            </td>
          </tr>
        {/each}
        {#if data.rows.length === 0}
          <tr>
            <td colspan="4" class="px-4 py-8 text-center text-sm text-zinc-500">
              No data available for the selected range.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</PageShell>
