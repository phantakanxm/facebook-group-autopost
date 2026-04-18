import { z } from 'zod';

const pairMinMax = (min: number, max: number) =>
  z.object({
    min: z.number().int().min(0).max(3_600_000),
    max: z.number().int().min(0).max(3_600_000),
  }).default({ min, max }).refine((v) => v.min <= v.max, {
    message: 'min must be <= max',
  });

export const settingUpdateSchema = z.object({
  delayBetweenGroups: pairMinMax(180_000, 600_000),
  delayBeforePost: pairMinMax(1_000, 3_000),
  delayAfterFocus: pairMinMax(500, 1_500),
  retryDelay: pairMinMax(60_000, 180_000),
  maxRetryPerGroup: z.number().int().min(0).max(10).default(2),
  stopAfterConsecutiveFailures: z.number().int().min(1).max(20).default(3),
  enableMouseMove: z.boolean().default(true),
  enableScrollBeforePost: z.boolean().default(true),
  enableJitter: z.boolean().default(true),
});

export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;
