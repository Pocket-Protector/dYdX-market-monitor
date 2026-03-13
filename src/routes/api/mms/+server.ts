import { json } from '@sveltejs/kit';
import { apiFetch } from '$lib/api/client';
import { MmsResponseSchema } from '$lib/api/schemas';

export async function GET() {
  try {
    const raw = await apiFetch('/mms');
    const parsed = MmsResponseSchema.parse(raw);
    return json(parsed.data.mms);
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
}
