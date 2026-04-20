import { NextRequest, NextResponse } from 'next/server';
import { saveUploadedFile } from '@/lib/files';
import { MAX_IMAGES_PER_POST } from '@app/shared';

const MAX_IMAGES_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi']);

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const campaignId = String(form.get('campaignId') ?? '');
  const kind = String(form.get('kind') ?? 'images'); // "images" | "video"
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'no files' }, { status: 400 });

  if (kind === 'video' && files.length !== 1) {
    return NextResponse.json({ error: 'video must be exactly 1 file' }, { status: 400 });
  }
  if (kind === 'images' && files.length > MAX_IMAGES_PER_POST) {
    return NextResponse.json({ error: `too many images (max ${MAX_IMAGES_PER_POST})` }, { status: 400 });
  }

  // Validate extensions match the declared kind
  for (const f of files) {
    const ext = extOf(f.name);
    const allow = kind === 'video' ? VIDEO_EXTS : IMAGE_EXTS;
    if (!allow.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext} (expected ${kind})` },
        { status: 400 },
      );
    }
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGES_BYTES;
  if (totalBytes > limit) {
    return NextResponse.json({ error: `total size exceeds ${limit}` }, { status: 400 });
  }

  const saved = await Promise.all(files.map((f) => saveUploadedFile(f, campaignId)));
  const items = saved.map((s) => ({
    path: s.path,
    url: `/api/media/${s.relPath.split('/').map(encodeURIComponent).join('/')}`,
    name: s.name,
    size: s.size,
    type: s.type,
  }));

  // Keep `paths` for backwards-compat with any existing callers.
  return NextResponse.json({ paths: saved.map((s) => s.path), items });
}
