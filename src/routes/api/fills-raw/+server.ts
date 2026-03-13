/**
 * Streaming proxy: paginates the dYdX indexer and streams raw fills
 * page-by-page as NDJSON so the client gets real-time progress.
 *
 * Protocol (one JSON object per line):
 *   {"t":"p","sub":1,"page":1,"fills":[...]}   — page of fills
 *   {"t":"d","isCapped":false,"from":"…","to":"…"}  — done
 *   {"t":"e","error":"…"}                       — error
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMmBySlug } from '$lib/config/mms';
import type { IndexerFill } from '$lib/features/fills/types';

const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

interface IndexerFillsResponse {
  fills: IndexerFill[];
}

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  if (!slug) throw error(400, 'Missing slug');
  if (!from || !to) throw error(400, 'Missing from/to');

  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);

  const subaccounts = mm.subaccounts ?? [];
  if (subaccounts.length === 0) throw error(400, `No subaccounts for ${slug}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      try {
        const signal = AbortSignal.timeout(60_000);
        let isCapped = false;

        await Promise.all(
          subaccounts.map(async (subNum) => {
            const seen = new Set<string>();
            let cursor = `${to}T23:59:59.999Z`;
            const fromTs = `${from}T00:00:00.000Z`;

            for (let page = 0; page < MAX_PAGES; page++) {
              const pageUrl = new URL('https://indexer.dydx.trade/v4/fills');
              pageUrl.searchParams.set('address', mm.address);
              pageUrl.searchParams.set('subaccountNumber', String(subNum));
              pageUrl.searchParams.set('limit', String(PAGE_LIMIT));
              pageUrl.searchParams.set('createdBeforeOrAt', cursor);

              const res = await fetch(pageUrl.toString(), { signal });
              if (!res.ok) throw new Error(`Indexer ${res.status} for sub ${subNum}`);

              const body: IndexerFillsResponse = await res.json();
              if (!body.fills || body.fills.length === 0) break;

              const pageFills: IndexerFill[] = [];
              for (const fill of body.fills) {
                if (!seen.has(fill.id) && fill.createdAt >= fromTs) {
                  seen.add(fill.id);
                  pageFills.push(fill);
                }
              }

              if (pageFills.length > 0) {
                send({ t: 'p', sub: subNum, page: page + 1, fills: pageFills });
              }

              const oldest = body.fills[body.fills.length - 1];
              if (oldest.createdAt < fromTs) break;
              if (body.fills.length < PAGE_LIMIT) break;
              if (page === MAX_PAGES - 1) { isCapped = true; break; }

              cursor = oldest.createdAt;
            }
          })
        );

        send({ t: 'd', isCapped, from, to });
      } catch (e) {
        send({ t: 'e', error: String(e) });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache'
    }
  });
};
