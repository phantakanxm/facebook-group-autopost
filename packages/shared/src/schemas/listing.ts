import { z } from 'zod';
import {
  LISTING_KINDS,
  PROPERTY_TYPES,
  MAX_PHOTOS_PER_LISTING,
} from '../constants.js';

const listingBaseSchema = z.object({
  listingKind: z.enum(LISTING_KINDS),
  propertyType: z.enum(PROPERTY_TYPES),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  priceBaht: z.number().int().min(0).max(9_999_999_999),
  location: z.string().min(1).max(500),
  squareMetres: z.number().int().min(1).max(100_000).nullable().optional(),

  content: z.string().min(1).max(63206),
  mediaFiles: z.array(z.string()).min(1).max(MAX_PHOTOS_PER_LISTING),

  scheduledAt: z.coerce.date(),
  jitterMinutes: z.number().int().min(0).max(120).default(15),
  groupIds: z.array(z.string()).min(1),

  batchDelayMinMs: z.number().int().min(60_000).max(24 * 3600_000).nullable().optional(),
  batchDelayMaxMs: z.number().int().min(60_000).max(24 * 3600_000).nullable().optional(),
});

export const listingCreateSchema = listingBaseSchema.superRefine((d, ctx) => {
  const hasMin = d.batchDelayMinMs != null && d.batchDelayMinMs !== undefined;
  const hasMax = d.batchDelayMaxMs != null && d.batchDelayMaxMs !== undefined;
  if (hasMin !== hasMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'batchDelayMinMs and batchDelayMaxMs must both be set or both omitted',
      path: ['batchDelayMinMs'],
    });
  }
  if (hasMin && hasMax && d.batchDelayMinMs! > d.batchDelayMaxMs!) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'batchDelayMinMs must be <= batchDelayMaxMs',
      path: ['batchDelayMinMs'],
    });
  }
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
