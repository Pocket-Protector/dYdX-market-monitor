<script lang="ts">
  import { shortTicker, formatCompact } from '$lib/utils/format';

  interface MarketRow {
    clobPairId: string;
    ticker: string;
    status: string;
    marketType: string;
    oraclePrice: number;
    volume24h: number;
    openInterestNotional: number;
    trades24h: number;
    nextFundingRate: number | null;
    tickSize: string;
    tickSpreadBps: number | null;
    priceChange24H: number;
  }

  type SizeMetric = 'volume24h' | 'openInterestNotional' | 'trades24h';
  type GroupMode = 'none' | 'type';

  interface Rect { x: number; y: number; w: number; h: number }

  interface TreemapItem {
    id: string;
    label: string;
    fullTicker: string;
    value: number;
    volume: number;
    oi: number;
    trades: number;
    type: string;
    isGroup: boolean;
    count?: number;
  }

  interface LayoutBox extends TreemapItem, Rect {}

  const { rows }: { rows: MarketRow[] } = $props();

  let sizeBy = $state<SizeMetric>('volume24h');
  let groupBy = $state<GroupMode>('none');
  let drillType = $state<string | null>(null);
  let containerW = $state(0);
  let containerH = $state(0);

  $effect(() => {
    if (groupBy === 'none') drillType = null;
  });

  const sizeLabels: Record<SizeMetric, string> = {
    volume24h: 'Volume',
    openInterestNotional: 'Open Interest',
    trades24h: 'Trades'
  };

  // --- Summary stats ---
  const stats = $derived.by(() => {
    const src = drillType ? rows.filter((r) => r.marketType === drillType) : rows;
    return {
      totalVolume: src.reduce((s, r) => s + r.volume24h, 0),
      totalOI: src.reduce((s, r) => s + r.openInterestNotional, 0),
      totalTrades: src.reduce((s, r) => s + r.trades24h, 0),
      count: src.length
    };
  });

  // --- Build treemap items based on current view ---
  const currentItems = $derived.by((): TreemapItem[] => {
    if (groupBy === 'type' && !drillType) {
      const groups = new Map<string, { volume: number; oi: number; trades: number; count: number }>();
      for (const r of rows) {
        const g = groups.get(r.marketType) ?? { volume: 0, oi: 0, trades: 0, count: 0 };
        g.volume += r.volume24h;
        g.oi += r.openInterestNotional;
        g.trades += r.trades24h;
        g.count++;
        groups.set(r.marketType, g);
      }
      return Array.from(groups.entries()).map(([type, g]) => ({
        id: type,
        label: type,
        fullTicker: type,
        value: sizeBy === 'volume24h' ? g.volume : sizeBy === 'openInterestNotional' ? g.oi : g.trades,
        volume: g.volume,
        oi: g.oi,
        trades: g.trades,
        type,
        isGroup: true,
        count: g.count
      }));
    }

    const src = drillType ? rows.filter((r) => r.marketType === drillType) : rows;
    return src
      .map((r) => ({
        id: r.clobPairId,
        label: shortTicker(r.ticker),
        fullTicker: r.ticker,
        value: r[sizeBy] as number,
        volume: r.volume24h,
        oi: r.openInterestNotional,
        trades: r.trades24h,
        type: r.marketType,
        isGroup: false
      }))
      .filter((i) => i.value > 0);
  });

  // --- Squarified treemap layout algorithm ---
  function worstRatio(areas: number[], w: number): number {
    const s = areas.reduce((a, b) => a + b, 0);
    if (s === 0 || w === 0) return Infinity;
    const s2 = s * s;
    const w2 = w * w;
    let worst = 0;
    for (const r of areas) {
      if (r <= 0) continue;
      const ratio = Math.max((w2 * r) / s2, s2 / (w2 * r));
      if (ratio > worst) worst = ratio;
    }
    return worst;
  }

  function placeRow(
    items: TreemapItem[],
    areas: number[],
    rect: Rect
  ): { boxes: LayoutBox[]; remaining: Rect } {
    const s = areas.reduce((a, b) => a + b, 0);
    const boxes: LayoutBox[] = [];

    if (rect.w >= rect.h) {
      const rowW = rect.h > 0 ? s / rect.h : 0;
      let y = rect.y;
      for (let i = 0; i < items.length; i++) {
        const h = rowW > 0 ? areas[i] / rowW : 0;
        boxes.push({ ...items[i], x: rect.x, y, w: rowW, h });
        y += h;
      }
      return { boxes, remaining: { x: rect.x + rowW, y: rect.y, w: rect.w - rowW, h: rect.h } };
    } else {
      const rowH = rect.w > 0 ? s / rect.w : 0;
      let x = rect.x;
      for (let i = 0; i < items.length; i++) {
        const w = rowH > 0 ? areas[i] / rowH : 0;
        boxes.push({ ...items[i], x, y: rect.y, w, h: rowH });
        x += w;
      }
      return { boxes, remaining: { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH } };
    }
  }

  function computeLayout(items: TreemapItem[], rect: Rect): LayoutBox[] {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    if (sorted.length === 0 || rect.w <= 0 || rect.h <= 0) return [];

    const total = sorted.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return [];

    const containerArea = rect.w * rect.h;
    const areas = sorted.map((i) => (i.value / total) * containerArea);

    const results: LayoutBox[] = [];
    let remaining = { ...rect };
    let idx = 0;

    while (idx < sorted.length && remaining.w > 0.5 && remaining.h > 0.5) {
      const shorter = Math.min(remaining.w, remaining.h);
      const rowItems: TreemapItem[] = [sorted[idx]];
      const rowAreas: number[] = [areas[idx]];
      idx++;

      while (idx < sorted.length) {
        const testAreas = [...rowAreas, areas[idx]];
        if (worstRatio(testAreas, shorter) <= worstRatio(rowAreas, shorter)) {
          rowItems.push(sorted[idx]);
          rowAreas.push(areas[idx]);
          idx++;
        } else {
          break;
        }
      }

      const { boxes, remaining: rem } = placeRow(rowItems, rowAreas, remaining);
      results.push(...boxes);
      remaining = rem;
    }

    return results;
  }

  // --- Derived layout ---
  const layout = $derived.by(() => {
    if (containerW < 1 || containerH < 1) return [];
    return computeLayout(currentItems, { x: 0, y: 0, w: containerW, h: containerH });
  });

  // --- Formatting helpers ---
  function fmtMetric(val: number, metric: SizeMetric): string {
    if (metric === 'trades24h') return val > 0 ? val.toLocaleString() : '—';
    return formatCompact(val);
  }

  function fmtTrades(val: number): string {
    return val > 0 ? val.toLocaleString() : '—';
  }

  function tooltipText(box: LayoutBox): string {
    const header = box.isGroup ? `${box.label} (${box.count} markets)` : box.fullTicker;
    return `${header}\nVol: ${formatCompact(box.volume)}\nOI: ${formatCompact(box.oi)}\nTrades: ${fmtTrades(box.trades)}`;
  }

  function boxBg(type: string, isGroup: boolean, isHovered: boolean): string {
    if (type === 'CROSS') {
      if (isHovered) return 'rgba(139, 92, 246, 0.35)';
      return isGroup ? 'rgba(139, 92, 246, 0.22)' : 'rgba(139, 92, 246, 0.18)';
    }
    if (isHovered) return 'rgba(56, 189, 248, 0.35)';
    return isGroup ? 'rgba(56, 189, 248, 0.22)' : 'rgba(56, 189, 248, 0.18)';
  }

  function boxBorder(type: string): string {
    return type === 'CROSS' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(56, 189, 248, 0.3)';
  }

  function textColor(type: string): string {
    return type === 'CROSS' ? 'text-violet-300' : 'text-sky-300';
  }

  function handleBoxClick(box: LayoutBox) {
    if (box.isGroup && groupBy === 'type') {
      drillType = box.id;
    }
  }

  let hoveredId = $state<string | null>(null);
  const GAP = 1;
</script>

<!-- Controls row -->
<div class="mb-4 flex flex-wrap items-center gap-3">
  <label class="flex items-center gap-2 text-xs text-zinc-400">
    Size by
    <select
      bind:value={sizeBy}
      class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
    >
      <option value="volume24h">Volume</option>
      <option value="openInterestNotional">Open Interest</option>
      <option value="trades24h">Trades</option>
    </select>
  </label>

  <label class="flex items-center gap-2 text-xs text-zinc-400">
    Group by
    <select
      bind:value={groupBy}
      class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
    >
      <option value="none">All Markets</option>
      <option value="type">Market Type</option>
    </select>
  </label>

  {#if drillType}
    <div class="flex items-center gap-1.5 text-xs">
      <button
        class="text-violet-400 hover:text-violet-300 transition-colors"
        onclick={() => (drillType = null)}
      >
        All Types
      </button>
      <span class="text-zinc-600">/</span>
      <span class="text-zinc-300">{drillType}</span>
    </div>
  {/if}
</div>

<!-- Summary stats -->
<div class="mb-4 flex flex-wrap gap-6 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
  <div>
    <span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Volume</span>
    <div class="mono text-sm text-zinc-100">{formatCompact(stats.totalVolume)}</div>
  </div>
  <div>
    <span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Open Interest</span>
    <div class="mono text-sm text-zinc-100">{formatCompact(stats.totalOI)}</div>
  </div>
  <div>
    <span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Trades</span>
    <div class="mono text-sm text-zinc-100">{fmtTrades(stats.totalTrades)}</div>
  </div>
  <div>
    <span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Markets</span>
    <div class="mono text-sm text-zinc-100">{stats.count}</div>
  </div>
  <div class="ml-auto self-center text-[10px] text-zinc-600">
    Sized by {sizeLabels[sizeBy]}
  </div>
</div>

<!-- Treemap -->
{#if currentItems.length === 0}
  <p class="py-12 text-center text-sm text-zinc-500">No data for the selected metric.</p>
{:else}
  <div
    class="relative w-full overflow-hidden rounded-lg border border-zinc-800"
    style="height: 560px"
    bind:clientWidth={containerW}
    bind:clientHeight={containerH}
  >
    {#each layout as box (box.id)}
      {@const bx = box.x + GAP}
      {@const by = box.y + GAP}
      {@const bw = Math.max(box.w - GAP * 2, 0)}
      {@const bh = Math.max(box.h - GAP * 2, 0)}
      {@const isHov = hoveredId === box.id}
      {#if box.isGroup}
        <button
          type="button"
          class="absolute overflow-hidden cursor-pointer text-left transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/70"
          style="left:{bx}px; top:{by}px; width:{bw}px; height:{bh}px;
            background:{boxBg(box.type, box.isGroup, isHov)};
            border: 1px solid {boxBorder(box.type)};"
          title={tooltipText(box)}
          onclick={() => handleBoxClick(box)}
          onmouseenter={() => (hoveredId = box.id)}
          onmouseleave={() => (hoveredId = null)}
        >
          <div class="flex h-full flex-col items-center justify-center gap-1 p-3">
            <span class="text-lg font-semibold {textColor(box.type)}">{box.label}</span>
            <span class="text-[10px] text-zinc-400">{box.count} markets</span>
            <div class="mt-1 flex gap-4 text-[10px] text-zinc-400">
              <span>Vol: <span class="mono text-zinc-300">{formatCompact(box.volume)}</span></span>
              <span>OI: <span class="mono text-zinc-300">{formatCompact(box.oi)}</span></span>
              <span>Trades: <span class="mono text-zinc-300">{fmtTrades(box.trades)}</span></span>
            </div>
            <span class="mt-1 text-[10px] text-zinc-600">Click to explore</span>
          </div>
        </button>
      {:else}
        <div
          class="absolute overflow-hidden cursor-default transition-colors duration-100"
          role="presentation"
          style="left:{bx}px; top:{by}px; width:{bw}px; height:{bh}px;
            background:{boxBg(box.type, box.isGroup, isHov)};
            border: 1px solid {boxBorder(box.type)};"
          title={tooltipText(box)}
          onmouseenter={() => (hoveredId = box.id)}
          onmouseleave={() => (hoveredId = null)}
        >
          {#if bw > 110 && bh > 58}
            <!-- Large box: ticker + all metrics -->
            <div class="flex h-full flex-col justify-between p-1.5">
              <span class="truncate text-xs font-medium {textColor(box.type)}">{box.label}</span>
              <div class="space-y-0.5">
                <div class="truncate text-[10px] text-zinc-400">Vol <span class="mono text-zinc-300">{formatCompact(box.volume)}</span></div>
                <div class="truncate text-[10px] text-zinc-400">OI <span class="mono text-zinc-300">{formatCompact(box.oi)}</span></div>
                <div class="truncate text-[10px] text-zinc-400">Tr <span class="mono text-zinc-300">{fmtTrades(box.trades)}</span></div>
              </div>
            </div>
          {:else if bw > 70 && bh > 38}
            <!-- Medium box: ticker + primary metric -->
            <div class="flex h-full flex-col justify-between p-1.5">
              <span class="truncate text-[11px] font-medium {textColor(box.type)}">{box.label}</span>
              <span class="truncate mono text-[10px] text-zinc-400">{fmtMetric(box.value, sizeBy)}</span>
            </div>
          {:else if bw > 36 && bh > 18}
            <!-- Small box: ticker only -->
            <div class="flex h-full items-center justify-center p-0.5">
              <span class="truncate text-[9px] font-medium {textColor(box.type)}">{box.label.split('-')[0]}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
