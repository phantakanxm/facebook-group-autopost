import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_ROOT = resolve(process.cwd(), '..', '..', 'uploads');

export async function saveUploadedFile(
  file: File,
  campaignId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const dir = join(UPLOAD_ROOT, campaignId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  // Return absolute path — Playwright `setInputFiles` needs absolute
  return fullPath;
}
