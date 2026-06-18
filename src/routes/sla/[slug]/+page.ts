import type { PageLoad } from './$types';
import type { SlaLiquidityResponse, SlaUptimeResponse, SlaConfigResponse } from '$lib/features/sla/types';

export const ssr = false;

const FETCH_TIMEOUT_MS = 30_000;

async function fetchSection(fetcher: typeof fetch, request: string): Promise<Response | null> {
  try {
    return await fetcher(request, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

function clampLeeway(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export const load: PageLoad = async ({ fetch, url, params, data }) => {
  const from = url.searchParams.get('from') ?? data.defaultFrom;
  const to = url.searchParams.get('to') ?? data.defaultTo;
  // Leeway relaxes the SLA size requirement by a % when scoring uptime (only affects /uptime).
  const leeway = clampLeeway(url.searchParams.get('leeway'));
  const rangeParams = new URLSearchParams({ from, to });
  const uptimeParams = new URLSearchParams({ from, to });
  if (leeway > 0) uptimeParams.set('leeway', String(leeway));

  const [liquidityRes, uptimeRes, configRes] = await Promise.all([
    fetchSection(fetch, `/api/sla/${params.slug}/liquidity?${rangeParams.toString()}`),
    fetchSection(fetch, `/api/sla/${params.slug}/uptime?${uptimeParams.toString()}`),
    fetchSection(fetch, `/api/sla/${params.slug}/config`)
  ]);

  let liquidityData: SlaLiquidityResponse | null = null;
  let liquidityError: string | null = null;
  let uptimeData: SlaUptimeResponse | null = null;
  let uptimeError: string | null = null;
  let configData: SlaConfigResponse | null = null;
  let configError: string | null = null;

  if (!liquidityRes) {
    liquidityError = 'Request timed out';
  } else if (!liquidityRes.ok) {
    liquidityError = `HTTP ${liquidityRes.status}`;
  } else {
    liquidityData = await liquidityRes.json();
  }

  if (!uptimeRes) {
    uptimeError = 'Request timed out';
  } else if (!uptimeRes.ok) {
    uptimeError = `HTTP ${uptimeRes.status}`;
  } else {
    uptimeData = await uptimeRes.json();
  }

  if (!configRes) {
    configError = 'Request timed out';
  } else if (!configRes.ok) {
    configError = `HTTP ${configRes.status}`;
  } else {
    configData = await configRes.json();
  }

  return { ...data, from, to, leeway, liquidityData, liquidityError, uptimeData, uptimeError, configData, configError };
};
