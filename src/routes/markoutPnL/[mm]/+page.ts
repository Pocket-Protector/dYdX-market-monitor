import type { PageLoad } from './$types';
import type {
  FundingMmResponse,
  MarkoutMmResponse,
  PnlMmResponse
} from '$lib/features/markout/types';

export const ssr = false;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson<T>(fetcher: typeof fetch, url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return { data: null, error: res.status === 404 ? '404' : `HTTP ${res.status}` };
    return { data: (await res.json()) as T, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

export const load: PageLoad = async ({ fetch, url, params, data }) => {
  // Reading url.searchParams registers them as SvelteKit dependencies so this
  // load re-runs automatically whenever view/from/to change in the URL.
  const view = url.searchParams.get('view') ?? data.view;
  const from = url.searchParams.get('from') ?? data.from;
  const to = url.searchParams.get('to') ?? data.to;

  let mmData: MarkoutMmResponse | null = null;
  let mmError: string | null = null;
  let pnlData: PnlMmResponse | null = null;
  let pnlError: string | null = null;
  let fundingData: FundingMmResponse | null = null;
  let fundingError: string | null = null;

  const [markoutResult, pnlResult, fundingResult] = await Promise.all([
    fetchJson<MarkoutMmResponse>(fetch, `/api/markout/mm/${params.mm}?view=${view}&from=${from}&to=${to}`),
    fetchJson<PnlMmResponse>(fetch, `/api/pnl/${params.mm}?from=${from}&to=${to}`),
    fetchJson<FundingMmResponse>(fetch, `/api/funding/${params.mm}?from=${from}&to=${to}`)
  ]);

  mmData = markoutResult.data;
  mmError = markoutResult.error;
  pnlData = pnlResult.data;
  pnlError = pnlResult.error;
  fundingData = fundingResult.data;
  fundingError = fundingResult.error;

  // Spread server load data so PageData includes meta, slug, from, to, etc.
  return { ...data, mmData, mmError, pnlData, pnlError, fundingData, fundingError };
};
