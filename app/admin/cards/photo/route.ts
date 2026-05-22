import { NextResponse } from 'next/server';
import { uploadCardPhoto } from '@/lib/blob';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const fd = await req.formData();
  const slug = (fd.get('slug') ?? '').toString();
  const file = fd.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'unsupported type' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (5MB max)' }, { status: 400 });
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const inputBuf = Buffer.from(await file.arrayBuffer());

  // Server-side transcode: any input (JPEG/PNG/WebP up to 5MB) → 1024px square
  // JPEG at q85, EXIF stripped. Typical output: 100-250KB. Next/Image's loader
  // resizes down on demand for cards (96/256/384) and OG (1200x630).
  let jpegBuf: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    jpegBuf = await sharp(inputBuf)
      .rotate()                                          // honor EXIF orientation BEFORE stripping
      .resize(1024, 1024, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'image could not be processed' }, { status: 400 });
  }

  const url = await uploadCardPhoto(slug, jpegBuf, 'image/jpeg');
  return NextResponse.json({ url, bytes: jpegBuf.length });
}
