import { writeFile, mkdir } from 'node:fs/promises';
import path, { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveAppPaths } from '@app/shared';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const { uploadRoot } = resolveAppPaths({ repoRoot });

export const UPLOAD_ROOT = uploadRoot;

export interface SavedFile {
  /** Absolute path on disk — used by Playwright `setInputFiles`. */
  path: string;
  /** Path relative to UPLOAD_ROOT, e.g. "{campaignId}/{uuid}.jpg" — used to build the media URL. */
  relPath: string;
  /** Original filename from the upload. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type as reported by the browser (best-effort). */
  type: string;
}

export async function saveUploadedFile(
  file: File,
  campaignId: string,
): Promise<SavedFile> {
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const dir = join(UPLOAD_ROOT, campaignId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return {
    path: fullPath,
    relPath: relative(UPLOAD_ROOT, fullPath),
    name: file.name,
    size: file.size,
    type: file.type,
  };
}
