import type { Card } from '@/lib/types';

const CRLF = '\r\n';

function escape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function splitName(full: string): { given: string; family: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], family: '' };
  return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

function splitTitleOrg(title: string): { title: string; org?: string } {
  const m = title.match(/^(.*?)\s+·\s+(.+)$/);
  if (!m) return { title };
  return { title: m[1].trim(), org: m[2].trim() };
}

/**
 * Fold a long vCard line per RFC 2425/2426: CRLF + space every 75 chars.
 * The continuation space is counted as part of the next segment.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 75));
    i += 75;
  }
  return parts.join(CRLF);
}

// Fetch the photo, transcode to a small square JPEG via sharp, base64-encode.
// Inputs of any size/format (WebP/PNG/JPEG, up to a few MB) → ~20-40KB JPEG output.
// Sharp is already a Next.js peer dep.
async function fetchPhotoBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const inputBuf = Buffer.from(await res.arrayBuffer());
    if (inputBuf.length > 10 * 1024 * 1024) return null; // sanity cap: 10MB raw input
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp(inputBuf)
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return jpeg.toString('base64');
  } catch {
    return null;
  }
}

export async function buildVCard(card: Card): Promise<string> {
  const { given, family } = splitName(card.en.name);
  const { title, org } = splitTitleOrg(card.en.title);
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  lines.push(`N:${escape(family)};${escape(given)};;;`);
  lines.push(`FN:${escape(card.en.name)}`);
  if (org)   lines.push(`ORG:${escape(org)}`);
  if (title) lines.push(`TITLE:${escape(title)}`);

  // PHOTO — fetch from Blob URL, base64-encode, fold per RFC 2425/2426
  const photoBase64 = await fetchPhotoBase64(card.photoUrl);
  if (photoBase64) {
    const line = 'PHOTO;ENCODING=b;TYPE=JPEG:' + photoBase64;
    lines.push(foldLine(line));
  }

  if (card.contact.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${card.contact.phone}`);
  }
  for (const email of card.contact.emails) {
    lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`);
  }
  for (const site of card.contact.websites ?? []) {
    const url = site.startsWith('http') ? site : `https://${site}`;
    lines.push(`URL:${url}`);
  }

  // Social profiles intentionally OMITTED from .vcf — kept on the public card page only,
  // because iPhone Contacts clutters with the "social profiles" tab and most recipients
  // don't want six rows of brand-handle metadata in their address book.

  lines.push(`NOTE:${escape(card.en.name)} · ${escape(card.ar.name)} — ${escape(card.en.title)}`);
  lines.push('END:VCARD');

  return lines.join(CRLF) + CRLF;
}
