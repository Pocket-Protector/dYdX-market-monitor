import { z } from 'zod';

export const MmInfoSchema = z.object({
  address: z.string(),
  name: z.string(),
  subaccounts: z.array(z.number())
});

export const MmsResponseSchema = z.object({
  data: z.object({
    mms: z.array(MmInfoSchema)
  })
});
