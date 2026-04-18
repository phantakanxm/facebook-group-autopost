import { z } from 'zod';
import { CAMPAIGN_STATUSES, MEDIA_TYPES, MAX_IMAGES_PER_POST } from '../constants.js';

const campaignBaseSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(1).max(63206),
  mediaType: z.enum(MEDIA_TYPES),
  mediaFiles: z.array(z.string()).max(MAX_IMAGES_PER_POST),
  scheduledAt: z.coerce.date(),
  recurrence: z.string().max(60).nullable().optional(),
  jitterMinutes: z.number().int().min(0).max(120).default(15),
  groupIds: z.array(z.string()).min(1),
});

export const campaignCreateSchema = campaignBaseSchema
  .refine(
    (d) => d.mediaType !== 'video' || d.mediaFiles.length === 1,
    { message: 'Video media type must have exactly 1 file', path: ['mediaFiles'] },
  )
  .refine(
    (d) => d.mediaType !== 'none' || d.mediaFiles.length === 0,
    { message: 'mediaFiles must be empty when mediaType=none', path: ['mediaFiles'] },
  );

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignBaseSchema.partial().extend({
  id: z.string(),
});

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
