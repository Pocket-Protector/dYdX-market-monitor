import type { z } from 'zod';
import type { SummaryRowSchema } from './schemas';

export type SummaryRow = z.infer<typeof SummaryRowSchema>;
