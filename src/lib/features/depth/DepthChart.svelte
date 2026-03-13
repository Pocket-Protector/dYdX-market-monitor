<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip,
    Legend,
    type ChartData
  } from 'chart.js';
  import 'chartjs-adapter-date-fns';

  Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend);

  interface SeriesPoint {
    timestamp: string;
    medianBidFillBps?: number | null;
    medianAskFillBps?: number | null;
    medianCombinedFillBps?: number | null;
  }

  interface TickerData {
    ticker: string;
    series: SeriesPoint[];
  }

  const { data }: { data: { results: TickerData[] } } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const COLORS = [
    '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
    '#fb7185', '#60a5fa', '#e879f9', '#2dd4bf', '#f97316'
  ];

  function buildChartData(): ChartData {
    const datasets: ChartData['datasets'] = [];
    data.results.forEach((ticker, i) => {
      const color = COLORS[i % COLORS.length];
      const hasBid = ticker.series.some((s) => s.medianBidFillBps != null);
      const hasAsk = ticker.series.some((s) => s.medianAskFillBps != null);
      const hasCombined = ticker.series.some((s) => s.medianCombinedFillBps != null);

      if (hasBid) {
        datasets.push({
          label: `${ticker.ticker} bid`,
          data: ticker.series.map((s) => ({ x: new Date(s.timestamp).getTime(), y: s.medianBidFillBps ?? 0 })),
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        });
      }
      if (hasAsk) {
        datasets.push({
          label: `${ticker.ticker} ask`,
          data: ticker.series.map((s) => ({ x: new Date(s.timestamp).getTime(), y: s.medianAskFillBps ?? 0 })),
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.3
        });
      }
      if (hasCombined && !hasBid && !hasAsk) {
        datasets.push({
          label: ticker.ticker,
          data: ticker.series.map((s) => ({ x: new Date(s.timestamp).getTime(), y: s.medianCombinedFillBps ?? 0 })),
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        });
      }
    });
    return { datasets };
  }

  const FONT = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: buildChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            grid: { color: '#2c2c32' },
            ticks: { color: '#71717a', maxTicksLimit: 8, font: { family: FONT, size: 11 } }
          },
          y: {
            grid: { color: '#2c2c32' },
            ticks: { color: '#71717a', callback: (v) => `${v}bps`, font: { family: FONT, size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: '#a1a1aa', boxWidth: 12, font: { size: 11, family: FONT } } },
          tooltip: {
            backgroundColor: '#1b1b1f',
            borderColor: '#2c2c32',
            borderWidth: 1,
            titleColor: '#f4f4f5',
            bodyColor: '#a1a1aa',
            titleFont: { family: FONT, size: 12 },
            bodyFont: { family: FONT, size: 11 }
          }
        }
      }
    });
  });

  $effect(() => {
    data;
    if (!chart) return;
    chart.data = buildChartData();
    chart.update();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="h-64 w-full rounded border border-zinc-800 bg-zinc-900/50 p-2">
  <canvas bind:this={canvas}></canvas>
</div>
