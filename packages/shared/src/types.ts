import type { CampaignStatus, PostStatus, MediaType } from './constants.js';

export type CampaignStatusType = CampaignStatus;
export type PostStatusType = PostStatus;
export type MediaTypeType = MediaType;

export interface PostResult {
  success: boolean;
  fbPostUrl?: string;
  note?: 'pending_approval';
  error?: string;
  errorCategory?:
    | 'session_invalid'
    | 'account_locked'
    | 'rate_limited'
    | 'group_unavailable'
    | 'selector_not_found'
    | 'upload_failed'
    | 'transient';
}

export interface FBState {
  type: 'ok' | 'session_invalid' | 'account_locked' | 'rate_limited' | 'group_unavailable';
  detail?: string;
}
