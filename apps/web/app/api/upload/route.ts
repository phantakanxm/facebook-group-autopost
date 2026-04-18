import { NextRequest, NextResponse } from 'next/server';
import { saveUploadedFile } from '@/lib/files';
import { MAX_IMAGES_PER_POST } from '@app/shared';

const MAX_IMAGES_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

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

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGES_BYTES;
  if (totalBytes > limit) {
    return NextResponse.json({ error: `total size exceeds ${limit}` }, { status: 400 });
  }

  const paths = await Promise.all(files.map((f) => saveUploadedFile(f, campaignId)));
  return NextResponse.json({ paths });
}
