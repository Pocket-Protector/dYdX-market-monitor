import type { z } from 'zod';
import type { UptimeTickerSchema } from './schemas';

export type UptimeTicker = z.infer<typeof UptimeTickerSchema>;
