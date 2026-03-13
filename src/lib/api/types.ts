import type { z } from 'zod';
import type { MmInfoSchema } from './schemas';

export type MmInfo = z.infer<typeof MmInfoSchema>;
