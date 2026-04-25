import { prisma } from '@app/db';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { openSessionSetup, verifySession } from '../playwright/session.js';
import { sessionDirFor } from '../playwright/browser.js';
import { autoSyncGroups } from '../groups/sync.js';
import { scanGroupCapabilities } from '../groups/scan.js';
import { logger } from '../logger.js';

export async function handleSessionRequests(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (user.sessionPath === 'pending-setup') {
    logger.info({ userId }, 'session setup requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'setup-in-progress' } });
    await openSessionSetup(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-verify') {
    logger.info({ userId }, 'session verify requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'verifying' } });
    await verifySession(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-group-sync') {
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'syncing' } });
    await autoSyncGroups(userId, prisma);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-capability-scan') {
    logger.info({ userId }, 'capability scan requested (new groups only)');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'scanning-capabilities' } });
    await scanGroupCapabilities(userId, prisma);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-capability-rescan-all') {
    logger.info({ userId }, 'capability re-scan (all) requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'scanning-capabilities' } });
    await scanGroupCapabilities(userId, prisma, { force: true });
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-signout') {
    logger.info({ userId }, 'session sign-out requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'signing-out' } });
    const dir = sessionDirFor(userId);
    try {
      // Delete entire Playwright persistent-context dir → next launch starts fresh.
      rmSync(dir, { recursive: true, force: true });
      logger.info({ userId, dir }, 'session dir removed');
    } catch (err) {
      logger.warn({ userId, dir, err }, 'failed to remove session dir');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { sessionPath: null, sessionValid: false, sessionChecked: new Date() },
    });
  }
}
