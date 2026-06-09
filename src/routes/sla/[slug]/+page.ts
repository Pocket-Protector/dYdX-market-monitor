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

export const load: PageLoad = async ({ fetch, url, params, data }) => {
  const from = url.searchParams.get('from') ?? data.defaultFrom;
  const to = url.searchParams.get('to') ?? data.defaultTo;
  const rangeParams = new URLSearchParams({ from, to });

  const [liquidityRes, uptimeRes, configRes] = await Promise.all([
    fetchSection(fetch, `/api/sla/${params.slug}/liquidity?${rangeParams.toString()}`),
    fetchSection(fetch, `/api/sla/${params.slug}/uptime?${rangeParams.toString()}`),
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

  return { ...data, from, to, liquidityData, liquidityError, uptimeData, uptimeError, configData, configError };
};
