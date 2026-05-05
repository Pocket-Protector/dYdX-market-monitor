<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    CategoryScale,
    Chart,
    type ChartData,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip
  } from 'chart.js';
  import { formatUsd } from '$lib/utils/format';
  import { MARKOUT_HORIZONS, type MarkoutHorizon } from './types';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

  interface ChartSeries {
    key: string;
    label: string;
    color: string;
    points: { horizon: MarkoutHorizon; value: number }[];
  }

  const { series }: { series: ChartSeries[] } = $props();

  let canvas = $state<HTMLCanvasElement | undefined>();
  let chart: Chart | null = null;

  const FONT = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";

  function buildData(): ChartData<'line', number[], string> {
    return {
      labels: [...MARKOUT_HORIZONS],
      datasets: series.map((item) => ({
        label: item.label,
        data: MARKOUT_HORIZONS.map((horizon) => item.points.find((point) => point.horizon === horizon)?.value ?? 0),
        borderColor: item.color,
        backgroundColor: `${item.color}22`,
        borderWidth: 1.7,
        pointRadius: 2,
        tension: 0.28
      }))
    };
  }

  function createChart() {
    if (!canvas) return;
    chart = new Chart(canvas, {
      type: 'line',
      data: buildData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: '#27272a' },
            ticks: { color: '#71717a', font: { family: FONT, size: 11 } }
          },
          y: {
            grid: { color: '#27272a' },
            ticks: {
              color: '#71717a',
              font: { family: FONT, size: 11 },
              callback: (value) => formatUsd(Number(value))
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            borderColor: '#3f3f46',
            borderWidth: 1,
            titleColor: '#fafafa',
            bodyColor: '#d4d4d8',
            titleFont: { family: FONT, size: 12 },
            bodyFont: { family: FONT, size: 11 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatUsd(context.parsed.y)}`
            }
          }
        }
      }
    });
  }

  onMount(() => {
    createChart();
  });

  $effect(() => {
    series;
    if (!chart) return;
    chart.data = buildData();
    chart.update();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
  <div class="h-80">
    <canvas bind:this={canvas}></canvas>
  </div>
  <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
    {#each series as item}
      <div class="flex items-center gap-2 text-zinc-400">
        <span class="h-2.5 w-2.5 rounded-full" style="background-color: {item.color}"></span>
        <span>{item.label}</span>
      </div>
    {/each}
  </div>
</div>
