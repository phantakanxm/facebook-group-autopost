// apps/worker/test/setup-db.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestDb {
  prisma: PrismaClient;
  dbUrl: string;
  cleanup: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'fbpost-test-'));
  const dbFile = join(dir, 'test.db');
  const dbUrl = `file:${dbFile}`;
  // Push schema without migrations for speed
  execSync(`pnpm -F @app/db exec prisma db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  return {
    prisma,
    dbUrl,
    cleanup: async () => { await prisma.$disconnect(); },
  };
}

export async function seedBasic(prisma: PrismaClient, opts: { groups?: number } = {}) {
  const user = await prisma.user.create({ data: { id: 'u1', name: 'Me' } });
  await prisma.setting.create({ data: { userId: user.id } });
  const groups = [];
  for (let i = 0; i < (opts.groups ?? 3); i++) {
    groups.push(await prisma.group.create({
      data: {
        userId: user.id,
        fbGroupId: `g${i}`,
        fbUrl: `https://www.facebook.com/groups/g${i}`,
        name: `Group ${i}`,
        source: 'manual',
      },
    }));
  }
  return { user, groups };
}
