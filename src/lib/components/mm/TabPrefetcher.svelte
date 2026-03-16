<script lang="ts">
  import { useSWR } from 'sswr';
  import { prefetchStatuses, lastPrefetchAt } from '$lib/stores/prefetch';
  import type { TabPrefetchStatus, PrefetchStatus } from '$lib/stores/prefetch';
  import { isAbortError, loadFillsData } from '$lib/features/fills/client';

  interface Props {
    slug: string;
    address: string;
    subaccounts: number[];
    from: string;
    to: string;
    bpsLeeway: number;
    bps: number;
    usd: number;
    activeTab: string;
  }
  const { slug, address, subaccounts, from, to, bpsLeeway, bps, usd, activeTab }: Props = $props();

  const OPT = { refreshInterval: 0, dedupingInterval: 1_800_000 } as const;
  const summaryKey = $derived(`/api/summary?slug=${slug}&from=${from}&to=${to}`);
  const uptimeKey = $derived(`/api/uptime/${slug}?from=${from}&to=${to}&bpsLeeway=${bpsLeeway}`);
  const liquidityKey = $derived(`/api/liquidity-sla?slug=${slug}&from=${from}&to=${to}&bps=${bps}&mode=sla`);
  const depthKey = $derived(`/api/depth-sla?slug=${slug}&from=${from}&to=${to}&usd=${usd}&mode=sla&view=combined`);

  const { data: _sd, isLoading: _sl, error: _se } = useSWR(() => summaryKey, OPT);
  const { data: _ud, isLoading: _ul, error: _ue } = useSWR(() => uptimeKey, OPT);
  const { data: _ld, isLoading: _ll, error: _le } = useSWR(() => liquidityKey, OPT);
  const { data: _dd, isLoading: _dl, error: _de } = useSWR(() => depthKey, OPT);

  let fillsStatus = $state<PrefetchStatus>('idle');
  const fillsKey = $derived(`/api/fills?slug=${slug}&from=${from}&to=${to}`);

  $effect(() => {
    if (activeTab === 'fills') {
      fillsStatus = 'idle';
      return;
    }

    const key = fillsKey;
    let cancelled = false;
    const controller = new AbortController();
    fillsStatus = 'loading';

    loadFillsData(key, {
      address,
      subaccounts,
      signal: controller.signal
    })
      .then(() => {
        if (!cancelled && fillsKey === key) fillsStatus = 'done';
      })
      .catch((error) => {
        if (cancelled || fillsKey !== key || isAbortError(error)) return;
        fillsStatus = 'error';
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  });

  function tabStatus(loading: boolean, err: unknown, d: unknown) {
    if (d)       return 'done'    as const;
    if (err)     return 'error'   as const;
    if (loading) return 'loading' as const;
    return       'idle'           as const;
  }

  $effect(() => {
    const statuses: TabPrefetchStatus[] = [
      { label: 'Summary',   status: tabStatus($_sl, $_se, $_sd), active: activeTab === 'summary'   },
      { label: 'Uptime',    status: tabStatus($_ul, $_ue, $_ud), active: activeTab === 'uptime'    },
      { label: 'Liquidity', status: tabStatus($_ll, $_le, $_ld), active: activeTab === 'liquidity' },
      { label: 'Depth',     status: tabStatus($_dl, $_de, $_dd), active: activeTab === 'depth'     },
      { label: 'Fills',     status: fillsStatus,                  active: activeTab === 'fills'     }
    ];
    prefetchStatuses.set(statuses);
    if (statuses.some(s => s.status === 'done') && statuses.every(s => s.status !== 'loading')) {
      lastPrefetchAt.set(Date.now());
    }
  });
</script>
