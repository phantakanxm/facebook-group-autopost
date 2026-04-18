// apps/worker/src/playwright/adapter.ts
import type { PrismaClient } from '@prisma/client';
import type { PlaywrightAdapter } from '../campaigns/runner.js';
import { launchBrowser } from './browser.js';
import { verifySession } from './session.js';
import { postToGroup as playwrightPostToGroup } from './post.js';

export function createRealAdapter(prisma: PrismaClient): PlaywrightAdapter {
  return {
    verifySession: async (userId) => verifySession(userId),
    postToGroup: async (input) => {
      const ctx = await launchBrowser({ userId: input.userId, headless: false });
      try {
        const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: input.userId } });
        return await playwrightPostToGroup(ctx, {
          fbUrl: input.fbUrl,
          content: input.content,
          mediaFiles: input.mediaFiles,
          enableScrollBeforePost: setting.enableScrollBeforePost,
          delayBeforePost: { min: setting.delayBeforePostMinMs, max: setting.delayBeforePostMaxMs },
          delayAfterFocus: { min: setting.delayAfterFocusMinMs, max: setting.delayAfterFocusMaxMs },
        });
      } finally {
        await ctx.close();
      }
    },
  };
}
