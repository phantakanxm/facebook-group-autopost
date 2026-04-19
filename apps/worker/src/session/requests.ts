import { prisma } from '@app/db';
import { openSessionSetup, verifySession } from '../playwright/session.js';
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
    logger.info({ userId }, 'capability scan requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'scanning-capabilities' } });
    await scanGroupCapabilities(userId, prisma);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  }
}
