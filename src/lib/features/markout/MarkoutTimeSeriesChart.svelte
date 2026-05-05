<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    Chart,
    type ChartData,
    type Plugin,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Tooltip,
    Filler
  } from 'chart.js';
  import 'chartjs-adapter-date-fns';
  import { formatUsd } from '$lib/utils/format';

  Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

  interface ChartPoint {
    ts: string;
    value: number;
  }

  interface ChartSeries {
    key: string;
    label: string;
    color: string;
    trackedFrom: string | null;
    points: ChartPoint[];
  }

  const { series }: { series: ChartSeries[] } = $props();

  let canvas = $state<HTMLCanvasElement | undefined>();
  let chart: Chart | null = null;
  let hiddenKeys = $state<string[]>([]);

  const FONT = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
  const MAX_POINTS_PER_SERIES = 180;

  function samplePoints(points: ChartPoint[]): ChartPoint[] {
    if (points.length <= MAX_POINTS_PER_SERIES) return points;
    const step = Math.ceil(points.length / MAX_POINTS_PER_SERIES);
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
  }

  const sampledSeries = $derived(
    series.map((item) => ({
      ...item,
      points: samplePoints(item.points)
    }))
  );
  const visibleSeries = $derived(sampledSeries.filter((item) => !hiddenKeys.includes(item.key)));
  const lateStarters = $derived(visibleSeries.filter((item) => item.trackedFrom));
  const hasAnyPoints = $derived(sampledSeries.some((item) => item.points.length > 0));
  const yBounds = $derived.by(() => {
    const values = visibleSeries.flatMap((item) =>
      item.points.map((point: ChartPoint) => point.value)
    );
    const min = values.length > 0 ? Math.min(...values, 0) : 0;
    const max = values.length > 0 ? Math.max(...values, 0) : 0;
    const span = Math.max(max - min, Math.abs(max), Math.abs(min), 1);
    const pad = span * 0.08;
    return { min: min - pad, max: max + pad };
  });

  function toggleSeries(key: string) {
    hiddenKeys = hiddenKeys.includes(key)
      ? hiddenKeys.filter((item) => item !== key)
      : [...hiddenKeys, key];
  }

  function formatTrackedDate(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  const startMarkerPlugin: Plugin<'line'> = {
    id: 'markout-start-markers',
    afterDatasetsDraw(chart) {
      const xScale = chart.scales.x;
      const { ctx, chartArea } = chart;
      if (!xScale || !chartArea) return;

      ctx.save();
      ctx.lineWidth = 2;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const placedLabels: { left: number; right: number; top: number; bottom: number }[] = [];

      for (const item of lateStarters) {
        if (!item.trackedFrom) continue;
        const x = xScale.getPixelForValue(new Date(item.trackedFrom).getTime());
        if (!Number.isFinite(x) || x < chartArea.left || x > chartArea.right) continue;

        const label = `${item.label} start`;
        const textWidth = ctx.measureText(label).width;
        const boxWidth = Math.ceil(textWidth) + 10;
        const boxHeight = 16;
        const labelLeft = Math.min(x + 10, chartArea.right - boxWidth - 2);
        let labelTop = chartArea.top + 6;

        while (placedLabels.some((box) =>
          labelLeft < box.right &&
          labelLeft + boxWidth > box.left &&
          labelTop < box.bottom &&
          labelTop + boxHeight > box.top
        )) {
          labelTop += boxHeight + 4;
        }

        if (labelTop + boxHeight > chartArea.bottom - 4) {
          labelTop = Math.max(chartArea.top + 6, chartArea.bottom - boxHeight - 6);
        }

        placedLabels.push({
          left: labelLeft,
          right: labelLeft + boxWidth,
          top: labelTop,
          bottom: labelTop + boxHeight
        });

        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(labelLeft, labelTop, boxWidth, boxHeight);
        ctx.strokeStyle = item.color;
        ctx.strokeRect(labelLeft, labelTop, boxWidth, boxHeight);
        ctx.fillStyle = item.color;
        ctx.fillText(label, labelLeft + 5, labelTop + 3);
      }

      ctx.restore();
    }
  };

  function buildData(): ChartData<'line'> {
    return {
      datasets: [
        ...sampledSeries.map((item) => ({
          label: item.label,
          data: item.points.map((point: ChartPoint) => ({
            x: new Date(point.ts).getTime(),
            y: point.value
          })),
          borderColor: item.color,
          backgroundColor: `${item.color}22`,
          borderWidth: 1.7,
          pointRadius: 0,
          tension: 0.28,
          order: 2,
          hidden: hiddenKeys.includes(item.key)
        })),
        ...lateStarters.map((item) => ({
          label: `${item.label} tracked from ${formatTrackedDate(item.trackedFrom!)}`,
          data: [
            { x: new Date(item.trackedFrom!).getTime(), y: yBounds.min },
            { x: new Date(item.trackedFrom!).getTime(), y: yBounds.max }
          ],
          borderColor: item.color,
          backgroundColor: `${item.color}2e`,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          order: 1
        }))
      ]
    };
  }

  function createChart() {
    if (!canvas) return;
    chart = new Chart(canvas, {
      type: 'line',
      data: buildData(),
      plugins: [startMarkerPlugin],
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'time',
            grid: { color: '#27272a' },
            ticks: { color: '#71717a', maxTicksLimit: 8, font: { family: FONT, size: 11 } }
          },
          y: {
            min: yBounds.min,
            max: yBounds.max,
            grid: {
              color: (context) => (Number(context.tick.value) === 0 ? '#f59e0b' : '#27272a'),
              lineWidth: (context) => (Number(context.tick.value) === 0 ? 1.6 : 1)
            },
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
    sampledSeries;
    hiddenKeys = hiddenKeys.filter((key) => sampledSeries.some((item) => item.key === key));
  });

  $effect(() => {
    visibleSeries;
    yBounds;
    if (!chart) return;
    chart.data = buildData();
    if (chart.options.scales?.y) {
      chart.options.scales.y.min = yBounds.min;
      chart.options.scales.y.max = yBounds.max;
    }
    chart.update();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
  {#if hasAnyPoints}
    <div class="h-80">
      <canvas bind:this={canvas}></canvas>
    </div>
    {#if lateStarters.length > 0}
      <div class="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
        <div class="text-[11px] font-medium uppercase tracking-wide text-amber-300">Late tracking start markers</div>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          {#each lateStarters as item}
            <div class="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-zinc-300">
              <span class="h-2.5 w-2.5 rounded-full" style="background-color: {item.color}"></span>
              <span class="font-medium text-zinc-100">{item.label}</span>
              <span class="text-zinc-500">tracked from {formatTrackedDate(item.trackedFrom!)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {#each sampledSeries as item}
        <button
          type="button"
          onclick={() => toggleSeries(item.key)}
          class="flex items-center gap-2 rounded border px-2.5 py-1.5 transition-colors {hiddenKeys.includes(item.key)
            ? 'border-zinc-800 bg-zinc-950/40 text-zinc-600'
            : 'border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'}"
        >
          <span class="h-2.5 w-2.5 rounded-full" style="background-color: {item.color}"></span>
          <span class={hiddenKeys.includes(item.key) ? 'line-through opacity-60' : ''}>{item.label}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="flex h-80 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
      No sample points exist for the selected chart range.
    </div>
  {/if}
</div>
