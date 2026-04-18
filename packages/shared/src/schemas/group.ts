import { z } from 'zod';
import { GROUP_SOURCES } from '../constants.js';

const FB_GROUP_URL =
  /^https?:\/\/(www\.|web\.|m\.)?facebook\.com\/groups\/([a-zA-Z0-9][a-zA-Z0-9._-]*)\/?$/;

export function parseGroupUrl(url: string): { fbGroupId: string; canonicalUrl: string } | null {
  const m = url.trim().match(FB_GROUP_URL);
  if (!m) return null;
  const id = m[2]!;
  return { fbGroupId: id, canonicalUrl: `https://www.facebook.com/groups/${id}` };
}

export const groupCreateSchema = z.object({
  fbUrl: z.string().url().refine((u) => parseGroupUrl(u) !== null, {
    message: 'Not a valid Facebook group URL',
  }),
  name: z.string().max(200).optional(),
  source: z.enum(GROUP_SOURCES).default('manual'),
});

export const groupBulkCreateSchema = z.object({
  urls: z.array(z.string()).min(1).max(100),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
