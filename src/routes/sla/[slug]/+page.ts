import type { PageLoad } from './$types';
import type { SlaLiquidityResponse, SlaUptimeResponse, SlaConfigResponse } from '$lib/features/sla/types';

export const ssr = false;

export const load: PageLoad = async ({ fetch, url, params, data }) => {
  const from = url.searchParams.get('from') ?? data.defaultFrom;
  const to = url.searchParams.get('to') ?? data.defaultTo;

  const [liquidityRes, uptimeRes, configRes] = await Promise.all([
    fetch(`/api/sla/${params.slug}/liquidity?from=${from}&to=${to}`),
    fetch(`/api/sla/${params.slug}/uptime?from=${from}&to=${to}`),
    fetch(`/api/sla/${params.slug}/config`)
  ]);

  let liquidityData: SlaLiquidityResponse | null = null;
  let liquidityError: string | null = null;
  let uptimeData: SlaUptimeResponse | null = null;
  let uptimeError: string | null = null;
  let configData: SlaConfigResponse | null = null;
  let configError: string | null = null;

  if (!liquidityRes.ok) {
    liquidityError = `HTTP ${liquidityRes.status}`;
  } else {
    liquidityData = await liquidityRes.json();
  }

  if (!uptimeRes.ok) {
    uptimeError = `HTTP ${uptimeRes.status}`;
  } else {
    uptimeData = await uptimeRes.json();
  }

  if (!configRes.ok) {
    configError = `HTTP ${configRes.status}`;
  } else {
    configData = await configRes.json();
  }

  return { ...data, from, to, liquidityData, liquidityError, uptimeData, uptimeError, configData, configError };
};
