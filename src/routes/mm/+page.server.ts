import type { PageServerLoad } from './$types';
import { getMmConfigs } from '$lib/config/mms';

export const load: PageServerLoad = async () => {
  const mms = getMmConfigs();
  return { mms };
};
