import type { PrismaClient } from '@prisma/client';
import type { PlaywrightAdapter } from '../campaigns/runner.js';
import { launchBrowser } from './browser.js';
import { verifySession } from './session.js';
import { postToGroup as playwrightPostToGroup } from './post.js';
import { postListingBatch as playwrightPostListingBatch } from './post-listing.js';

export function createRealAdapter(prisma: PrismaClient): PlaywrightAdapter {
  return {
    verifySession: (userId) => verifySession(userId),
    openCampaign: async (userId) => {
      const ctx = await launchBrowser({ userId, headless: false });
      const setting = await prisma.setting.findUniqueOrThrow({ where: { userId } });
      return {
        postToGroup: (input) => playwrightPostToGroup(ctx, {
          fbUrl: input.fbUrl,
          content: input.content,
          mediaFiles: input.mediaFiles,
          mediaType: input.mediaType,
          enableScrollBeforePost: setting.enableScrollBeforePost,
          delayBeforePost: { min: setting.delayBeforePostMinMs, max: setting.delayBeforePostMaxMs },
          delayAfterFocus: { min: setting.delayAfterFocusMinMs, max: setting.delayAfterFocusMaxMs },
        }),
        postListingBatch: (input) => playwrightPostListingBatch(ctx, input),
        close: () => ctx.close(),
      };
    },
  };
}
