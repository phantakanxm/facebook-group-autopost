import { z } from 'zod';
import { CAMPAIGN_STATUSES, MEDIA_TYPES, MAX_IMAGES_PER_POST } from '../constants';

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
  )
  .refine(
    (d) => d.mediaType !== 'images' || d.mediaFiles.length >= 1,
    { message: 'Images media type must have at least 1 file', path: ['mediaFiles'] },
  );

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignBaseSchema
  .partial()
  .extend({ id: z.string() })
  .superRefine((d, ctx) => {
    if (d.mediaType !== undefined && d.mediaFiles !== undefined) {
      if (d.mediaType === 'video' && d.mediaFiles.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Video media type must have exactly 1 file',
          path: ['mediaFiles'],
        });
      }
      if (d.mediaType === 'none' && d.mediaFiles.length !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mediaFiles must be empty when mediaType=none',
          path: ['mediaFiles'],
        });
      }
      if (d.mediaType === 'images' && d.mediaFiles.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Images media type must have at least 1 file',
          path: ['mediaFiles'],
        });
      }
    }
  });

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
