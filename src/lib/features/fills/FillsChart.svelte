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
  import type { FillsTimePoint } from './types';

  Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend);

  const {
    data,
    metric,
    breakdown
  }: {
    data: FillsTimePoint[];
    metric: 'volume' | 'fees' | 'count';
    breakdown: 'total' | 'maker' | 'taker';
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function fmtUsd(n: number) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  function fmtCount(n: number) {
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  function buildChartData(): ChartData {
    const datasets: ChartData['datasets'] = [];

    if (metric === 'volume') {
      if (breakdown === 'total' || breakdown === 'maker') {
        datasets.push({
          label: breakdown === 'total' ? 'Maker Volume' : 'Maker Volume',
          data: data.map((p) => ({ x: new Date(p.ts).getTime(), y: p.makerVolume })),
          borderColor: '#38bdf8',
          backgroundColor: '#38bdf822',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        });
      }
      if (breakdown === 'total' || breakdown === 'taker') {
        datasets.push({
          label: breakdown === 'total' ? 'Taker Volume' : 'Taker Volume',
          data: data.map((p) => ({ x: new Date(p.ts).getTime(), y: p.takerVolume })),
          borderColor: '#f472b6',
          backgroundColor: '#f472b622',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        });
      }
    } else if (metric === 'fees') {
      const color = breakdown === 'taker' ? '#fbbf24' : '#34d399';
      const feeData =
        breakdown === 'maker'
          ? data.map((p) => ({ x: new Date(p.ts).getTime(), y: p.netFees - (p.netFees - p.netFees) }))
          : data.map((p) => ({ x: new Date(p.ts).getTime(), y: p.netFees }));
      datasets.push({
        label: 'Net Fees',
        data: feeData,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3
      });
    } else {
      // count
      datasets.push({
        label: 'Fill Count',
        data: data.map((p) => ({ x: new Date(p.ts).getTime(), y: p.fillCount })),
        borderColor: '#a78bfa',
        backgroundColor: '#a78bfa22',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3
      });
    }

    return { datasets };
  }

  const FONT = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";

  onMount(() => {
    const yFmt =
      metric === 'count'
        ? (v: unknown) => fmtCount(Number(v))
        : (v: unknown) => fmtUsd(Number(v));

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
            ticks: { color: '#71717a', callback: yFmt, font: { family: FONT, size: 11 } }
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
    data; metric; breakdown;
    if (!chart) return;
    chart.data = buildChartData();
    chart.update();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="h-64 w-full rounded border border-zinc-800 bg-zinc-900/50 p-2">
  <canvas bind:this={canvas}></canvas>
</div>
