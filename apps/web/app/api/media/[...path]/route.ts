import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { UPLOAD_ROOT } from '@/lib/files';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  // Decode each segment and resolve against UPLOAD_ROOT.
  const decoded = segments.map((s) => decodeURIComponent(s));
  const full = resolve(UPLOAD_ROOT, ...decoded);

  // Prevent path traversal: resolved path must live inside UPLOAD_ROOT.
  if (!full.startsWith(UPLOAD_ROOT + sep) && full !== UPLOAD_ROOT) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const s = await stat(full);
    if (!s.isFile()) {
      return NextResponse.json({ error: 'not a file' }, { status: 404 });
    }
    const mime = MIME[extname(full).toLowerCase()] ?? 'application/octet-stream';
    const stream = createReadStream(full) as unknown as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(s.size),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
