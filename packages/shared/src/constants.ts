export const CAMPAIGN_STATUSES = [
  'draft', 'scheduled', 'running', 'completed', 'failed', 'paused',
] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export const POST_STATUSES = ['pending', 'success', 'failed', 'skipped'] as const;
export type PostStatus = typeof POST_STATUSES[number];

export const MEDIA_TYPES = ['none', 'images', 'video'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const GROUP_SOURCES = ['manual', 'auto_sync'] as const;
export type GroupSource = typeof GROUP_SOURCES[number];

export const MAX_IMAGES_PER_POST = 10;
export const SOFT_MAX_GROUPS_PER_CAMPAIGN = 15;
export const SOFT_MAX_CAMPAIGNS_PER_DAY = 3;
