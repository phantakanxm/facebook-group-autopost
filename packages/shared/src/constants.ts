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

export const CAMPAIGN_TYPES = ['post', 'listing'] as const;
export type CampaignType = typeof CAMPAIGN_TYPES[number];

export const LISTING_KINDS = ['sale', 'rent'] as const;
export type ListingKind = typeof LISTING_KINDS[number];

export const PROPERTY_TYPES = ['flat', 'house', 'townhouse'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

export const MAX_PHOTOS_PER_LISTING = 50;
export const MAX_GROUPS_PER_BATCH = 21;
