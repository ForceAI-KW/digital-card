# Digital Card Admin Panel (v2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-admin web panel to digital-card. Cards now live in Neon Postgres (Prisma 7) instead of `data/cards/*.ts`; photos move to Vercel Blob; auth is scrypt + JWT cookie behind `/admin/*`; CRUD via Next.js server actions.

**Architecture:** Public routes unchanged externally — they now READ from Prisma instead of TS files (SSG + ISR via `revalidatePath` on admin save). Admin section at `/admin/*` is a separate set of server components gated by `middleware.ts` JWT verifier. Single password lives as `ADMIN_PASSWORD_HASH` env var; no user accounts. Per-commit Neon snapshot workflow ships parity with other Force projects.

**Tech Stack:** Next.js 16 · Prisma 7 + `@prisma/adapter-pg` + `@neondatabase/serverless` · Vercel Blob (`@vercel/blob`) · `jose` (JWT) · Node `scrypt` (built-in) · Zod · Tailwind v4 · Vitest + RTL · Playwright.

**Spec:** `docs/superpowers/specs/2026-05-21-digital-card-admin-design.md`

---

## File Structure (locked at planning time)

```
digital-card/
├── prisma/
│   ├── schema.prisma                     # Task 1
│   └── migrations/                       # Task 1 (init migration)
├── prisma.config.ts                      # Task 1
├── lib/
│   ├── prisma.ts                         # Task 1 (singleton + Neon adapter)
│   ├── types.ts                          # Task 3 (moved from data/cards/_types.ts)
│   ├── admin-auth.ts                     # Task 4 (scrypt + JWT helpers)
│   ├── admin-schemas.ts                  # Task 6 (Zod schemas)
│   ├── rate-limit.ts                     # Task 4 (in-memory LRU)
│   ├── blob.ts                           # Task 7 (Vercel Blob put/del)
│   ├── vcard.ts                          # Task 3 (MODIFIED: fetch photo blob)
│   └── i18n.ts                           # (unchanged)
├── middleware.ts                         # Task 4 (admin JWT gate)
├── app/
│   ├── [slug]/page.tsx                   # Task 3 (MODIFIED: Prisma)
│   ├── [slug]/contact.vcf/route.ts       # Task 3 (MODIFIED: Prisma)
│   ├── [slug]/opengraph-image.tsx        # Task 3 (MODIFIED: Prisma)
│   ├── sitemap.ts                        # Task 3 (MODIFIED: Prisma)
│   ├── page.tsx                          # Task 3 (MODIFIED: dynamic redirect)
│   ├── admin/
│   │   ├── layout.tsx                    # Task 5 (admin shell)
│   │   ├── page.tsx                      # Task 5 (card list)
│   │   ├── login/page.tsx                # Task 4 (login form)
│   │   ├── login/actions.ts              # Task 4 (login action)
│   │   ├── logout/actions.ts             # Task 4 (logout action)
│   │   └── cards/
│   │       ├── new/page.tsx              # Task 6
│   │       └── [id]/page.tsx             # Task 6
│   └── (existing v1 routes unchanged structurally)
├── components/
│   ├── admin/
│   │   ├── SignInForm.tsx                # Task 4 (client)
│   │   ├── CardForm.tsx                  # Task 6 (client; shared new+edit)
│   │   ├── PhotoDropzone.tsx             # Task 7 (client)
│   │   ├── DeleteButton.tsx              # Task 6 (client; confirm modal)
│   │   └── Toast.tsx                     # Task 6 (client; save feedback)
│   ├── templates/
│   │   ├── NardoLux.tsx                  # Task 3 (MODIFIED: photoUrl)
│   │   └── ForceBrand.tsx                # Task 3 (MODIFIED: photoUrl)
│   ├── JsonLd.tsx                        # Task 3 (MODIFIED: photoUrl)
│   ├── Photo.tsx                         # Task 3 (MODIFIED: remote URL)
│   └── (others unchanged)
├── scripts/
│   ├── seed-from-files.ts                # Task 2
│   ├── hash-password.ts                  # Task 4 (CLI helper)
│   └── (existing rollback.sh, backup-content.sh)
├── .github/workflows/
│   ├── ci.yml                            # Task 8 (MODIFIED: rule 13 gate)
│   ├── gitleaks.yml                      # (unchanged)
│   └── neon-snapshot.yml                 # Task 9 (per-commit snapshots)
├── docs/
│   ├── DEPLOYMENT.md                     # Task 10 (MODIFIED: env vars + Neon CLI)
│   └── ROLLBACK.md                       # Task 9 (MODIFIED: Neon restore path)
├── tests/
│   ├── unit/                             # colocated under lib/__tests__
│   └── e2e/
│       ├── admin-login.spec.ts           # Task 10
│       └── admin-crud.spec.ts            # Task 10
├── next.config.ts                        # Task 3 (MODIFIED: images.remotePatterns)
└── package.json                          # Task 1 (MODIFIED: postinstall, deps)
```

Files DELETED at end of Task 3 (after seed verifies):
- `data/cards/_types.ts`, `data/cards/ahmad.ts`, `data/cards/ahmad-fm.ts`, `data/cards/index.ts`
- `public/photos/ahmad.jpg`

---

## Task 1: Prisma init + Neon branches + schema

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`, `lib/prisma.ts`, `.env.local` (local-only, gitignored)
- Modify: `package.json` (deps + postinstall)

- [ ] **Step 1: Install Prisma + Neon adapter deps**

```bash
cd /Users/ahmadsharaf/Desktop/projects/digital-card
npm install prisma @prisma/client @prisma/adapter-pg @neondatabase/serverless
```

Expected: installs without errors. `npm audit` still 0.

- [ ] **Step 2: Create Neon project + branches via Neon CLI**

```bash
which neonctl || npm install -g neonctl
neonctl auth                              # opens browser, sign in
neonctl projects create --name digital-card --output json | jq '.project.id' -r > /tmp/neon-project-id
PROJECT_ID=$(cat /tmp/neon-project-id)
echo "neon project: $PROJECT_ID"
# Create a non-prod (preview) branch
neonctl branches create --project-id $PROJECT_ID --name preview --output json | jq '.branch.id' -r
neonctl connection-string --project-id $PROJECT_ID --branch main      # → DATABASE_URL_PROD
neonctl connection-string --project-id $PROJECT_ID --branch preview   # → DATABASE_URL_PREVIEW
neonctl connection-string --project-id $PROJECT_ID --branch main --pooled false   # → DIRECT_URL_PROD
neonctl connection-string --project-id $PROJECT_ID --branch preview --pooled false # → DIRECT_URL_PREVIEW
```

Capture the four connection strings; you'll need them for `.env.local` (preview) and Vercel envs (prod + preview).

- [ ] **Step 3: Local `.env.local` for development** (gitignored)

Create `.env.local`:

```
DATABASE_URL=<DATABASE_URL_PREVIEW from step 2>
DIRECT_URL=<DIRECT_URL_PREVIEW from step 2>
```

Local dev points at the preview branch (rule 13 — never touch prod data from a laptop). Verify `.env.local` is gitignored (the existing `.gitignore` from v1 covers `.env*` with `!.env.example` negation).

- [ ] **Step 4: Create `prisma.config.ts`**

```ts
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx scripts/seed-from-files.ts',
  },
});
```

Install dotenv + tsx:

```bash
npm install -D dotenv tsx
```

- [ ] **Step 5: Initialize Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
}

enum Template { lux force }
enum Brand    { force_ai force_media }
enum Locale   { en ar }

model Card {
  id            String   @id @default(cuid())
  slug          String   @unique
  template      Template
  brand         Brand?
  defaultLocale Locale
  enName        String
  enTitle       String
  arName        String
  arTitle       String
  photoUrl      String
  phone         String?
  phoneDisplay  String?
  whatsapp      String?
  emails        String[]
  websites      String[]
  instagram     String?
  linkedin      String?
  x             String?
  github        String?
  youtube       String?
  tiktok        String?
  copyrightYear Int      @default(2026)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([slug])
}
```

- [ ] **Step 6: Add postinstall + db scripts to `package.json`**

Update `"scripts"` block (preserve existing entries):

```json
"postinstall": "prisma generate --no-engine",
"db:migrate": "prisma migrate dev",
"db:deploy": "prisma migrate deploy",
"db:studio": "prisma studio",
"db:seed": "tsx scripts/seed-from-files.ts"
```

- [ ] **Step 7: Run initial migration against the preview branch**

```bash
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<ts>_init/migration.sql`, applies it to the preview Neon branch, generates the Prisma client. If it errors with `Can't reach database server`, double-check `DATABASE_URL` in `.env.local`.

- [ ] **Step 8: Promote schema to prod branch**

```bash
DATABASE_URL=<DATABASE_URL_PROD> DIRECT_URL=<DIRECT_URL_PROD> npx prisma migrate deploy
```

Expected: applies the same migration to the prod Neon branch.

- [ ] **Step 9: Create Prisma client singleton with Neon adapter**

Create `lib/prisma.ts`:

```ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrisma(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createPrisma();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
```

- [ ] **Step 10: Verify Prisma client works**

```bash
npx tsc --noEmit
node --input-type=module -e "import('./lib/prisma.ts').then(m => m.prisma.\$queryRaw\`SELECT 1 AS ok\`).then(console.log)"
```

Expected: `[ { ok: 1 } ]`. If Node can't import .ts, use `tsx` instead: `tsx -e "import { prisma } from './lib/prisma'; prisma.\$queryRaw\`SELECT 1\`.then(console.log)"`.

- [ ] **Step 11: Commit (verify author first)**

```bash
git config user.email                     # must be ahmed0montaser@gmail.com
git add prisma/ prisma.config.ts lib/prisma.ts package.json package-lock.json
git commit -m "feat(db): Prisma + Neon scaffold (prod + preview branches, Card schema)"
```

---

## Task 2: Seed migration from TS files to DB + Vercel Blob

**Files:**
- Create: `scripts/seed-from-files.ts`, `lib/blob.ts`
- Modify: `package.json` (add `@vercel/blob` dep)

- [ ] **Step 1: Install Vercel Blob + get token**

```bash
npm install @vercel/blob
```

In Vercel dashboard → digital-card → Storage → Connect Store → Vercel Blob → Create. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically into env vars (Production + Preview + Development).

Pull the token locally for the seed run:

```bash
vercel env pull .env.local
# .env.local now has BLOB_READ_WRITE_TOKEN appended (and may overwrite DATABASE_URL — re-paste your preview branch URL)
```

If `vercel env pull` returns empty `BLOB_READ_WRITE_TOKEN` (per `feedback-vercel-integration-secrets-masked`), copy it manually from the Vercel dashboard Settings → Environment Variables view.

- [ ] **Step 2: Write blob helper**

Create `lib/blob.ts`:

```ts
import { put, del } from '@vercel/blob';

export async function uploadCardPhoto(slug: string, file: Buffer | Blob, contentType: string): Promise<string> {
  const result = await put(`photos/${slug}-${Date.now()}.jpg`, file, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });
  return result.url;
}

export async function deleteCardPhoto(url: string): Promise<void> {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.warn('blob delete failed (continuing):', (err as Error).message);
  }
}
```

- [ ] **Step 3: Write the seed script**

Create `scripts/seed-from-files.ts`:

```ts
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { uploadCardPhoto } from '../lib/blob';
import { ahmad } from '../data/cards/ahmad';
import { ahmadFm } from '../data/cards/ahmad-fm';

async function main() {
  // Read placeholder photo once (both cards share the same headshot)
  const photoPath = path.join(process.cwd(), 'public', 'photos', 'ahmad.jpg');
  const photoBuf = await fs.readFile(photoPath);

  // Upload once → reuse URL for both cards
  console.log('uploading photo to Vercel Blob...');
  const photoUrl = await uploadCardPhoto('ahmad', photoBuf, 'image/jpeg');
  console.log('photo →', photoUrl);

  for (const src of [ahmad, ahmadFm]) {
    const row = {
      slug: src.slug,
      template: src.template === 'lux' ? 'lux' : 'force',
      brand: src.brand === 'force-ai' ? 'force_ai' : src.brand === 'force-media' ? 'force_media' : null,
      defaultLocale: src.defaultLocale,
      enName: src.en.name,
      enTitle: src.en.title,
      arName: src.ar.name,
      arTitle: src.ar.title,
      photoUrl,
      phone: src.contact.phone,
      phoneDisplay: src.contact.phoneDisplay,
      whatsapp: src.contact.whatsapp,
      emails: src.contact.emails,
      websites: src.contact.websites ?? [],
      instagram: src.socials.instagram,
      linkedin: src.socials.linkedin,
      x: src.socials.x,
      github: src.socials.github,
      youtube: src.socials.youtube,
      tiktok: src.socials.tiktok,
      copyrightYear: src.copyrightYear,
    } as const;

    const card = await prisma.card.upsert({
      where: { slug: row.slug },
      update: row,
      create: row,
    });
    console.log(`upserted ${card.slug} → id ${card.id}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run the seed (preview branch first)**

```bash
npx tsx scripts/seed-from-files.ts
```

Expected:
```
uploading photo to Vercel Blob...
photo → https://...public.blob.vercel-storage.com/photos/ahmad-<ts>.jpg
upserted ahmad → id c...
upserted ahmad-fm → id c...
```

- [ ] **Step 5: Verify with Prisma Studio (optional sanity)**

```bash
npx prisma studio
```

Opens at http://localhost:5555. Confirm two rows in Card table.

- [ ] **Step 6: Re-seed to prod branch**

```bash
DATABASE_URL=<DATABASE_URL_PROD> DIRECT_URL=<DIRECT_URL_PROD> npx tsx scripts/seed-from-files.ts
```

Expected: same output (idempotent upsert).

- [ ] **Step 7: Commit**

```bash
git add lib/blob.ts scripts/seed-from-files.ts package.json package-lock.json
git commit -m "feat(seed): migrate TS card files to DB + upload photo to Vercel Blob"
```

---

## Task 3: Read-path migration (TS files → Prisma)

**Files:**
- Create: `lib/types.ts`
- Modify: `app/[slug]/page.tsx`, `app/[slug]/contact.vcf/route.ts`, `app/[slug]/opengraph-image.tsx`, `app/sitemap.ts`, `app/page.tsx`, `components/templates/NardoLux.tsx`, `components/templates/ForceBrand.tsx`, `components/JsonLd.tsx`, `components/Photo.tsx`, `lib/vcard.ts`, `next.config.ts`
- Delete: `data/cards/*.ts`, `public/photos/ahmad.jpg`

- [ ] **Step 1: Create `lib/types.ts`**

Mirror the v1 `Card` shape (so existing components don't need restructuring), using Prisma-friendly key names:

```ts
import type { Locale } from './i18n';

export type Template = 'lux' | 'force';
export type Brand = 'force-ai' | 'force-media';

export interface CardContact {
  phone?: string | null;
  phoneDisplay?: string | null;
  whatsapp?: string | null;
  emails: string[];
  websites?: string[];
}

export interface CardSocials {
  instagram?: string | null;
  linkedin?: string | null;
  x?: string | null;
  github?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
}

export interface CardI18n {
  name: string;
  title: string;
}

export interface Card {
  slug: string;
  template: Template;
  brand?: Brand | null;
  defaultLocale: Locale;
  en: CardI18n;
  ar: CardI18n;
  photoUrl: string;
  contact: CardContact;
  socials: CardSocials;
  copyrightYear: number;
}

// Mapper from Prisma row → public Card type (the existing component contract)
type PrismaCard = {
  slug: string;
  template: 'lux' | 'force';
  brand: 'force_ai' | 'force_media' | null;
  defaultLocale: 'en' | 'ar';
  enName: string; enTitle: string; arName: string; arTitle: string;
  photoUrl: string;
  phone: string | null; phoneDisplay: string | null; whatsapp: string | null;
  emails: string[]; websites: string[];
  instagram: string | null; linkedin: string | null; x: string | null; github: string | null; youtube: string | null; tiktok: string | null;
  copyrightYear: number;
};

export function fromPrisma(row: PrismaCard): Card {
  return {
    slug: row.slug,
    template: row.template,
    brand: row.brand === 'force_ai' ? 'force-ai' : row.brand === 'force_media' ? 'force-media' : null,
    defaultLocale: row.defaultLocale,
    en: { name: row.enName, title: row.enTitle },
    ar: { name: row.arName, title: row.arTitle },
    photoUrl: row.photoUrl,
    contact: {
      phone: row.phone, phoneDisplay: row.phoneDisplay, whatsapp: row.whatsapp,
      emails: row.emails, websites: row.websites,
    },
    socials: {
      instagram: row.instagram, linkedin: row.linkedin, x: row.x,
      github: row.github, youtube: row.youtube, tiktok: row.tiktok,
    },
    copyrightYear: row.copyrightYear,
  };
}
```

- [ ] **Step 2: Update `app/[slug]/page.tsx` to use Prisma**

Replace contents:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { fromPrisma } from '@/lib/types';
import { CardLayout } from '@/components/CardLayout';
import { JsonLdPerson } from '@/components/JsonLd';

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const rows = await prisma.card.findMany({ select: { slug: true } });
  return rows.map((r) => ({ slug: r.slug }));
}
export const dynamicParams = false;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await prisma.card.findUnique({ where: { slug } });
  if (!row) return {};
  const card = fromPrisma(row);
  const c = card[card.defaultLocale];
  return {
    title: `${c.name} — ${c.title}`,
    description: c.title,
    openGraph: { title: c.name, description: c.title, type: 'profile' },
  };
}

export default async function CardPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const row = await prisma.card.findUnique({ where: { slug } });
  if (!row) notFound();
  const card = fromPrisma(row);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.invalid';
  const url = `${base}/${card.slug}`;
  return (
    <>
      <JsonLdPerson card={card} url={url} />
      <CardLayout card={card} url={url} />
    </>
  );
}
```

- [ ] **Step 3: Update vCard route**

Replace `app/[slug]/contact.vcf/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fromPrisma } from '@/lib/types';
import { buildVCard } from '@/lib/vcard';

export const revalidate = 3600;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const row = await prisma.card.findUnique({ where: { slug } });
  if (!row) return new NextResponse('Not found', { status: 404 });
  const card = fromPrisma(row);
  const body = await buildVCard(card);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${card.slug}.vcf"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
```

- [ ] **Step 4: Update `lib/vcard.ts` to fetch photo from Blob URL**

Replace the photo-handling block in `buildVCard()`. Find the section that previously read the file from disk, replace with a fetch-from-URL + base64 encode block. Keep existing CRLF / escape logic unchanged.

Add at the top of the file (alongside existing imports):
```ts
async function fetchPhotoBase64(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 100 * 1024) return null;          // skip if >100KB
    return buf.toString('base64');
  } catch {
    return null;
  }
}
```

In the buildVCard body, before emitting the NOTE line, add:

```ts
const photoBase64 = await fetchPhotoBase64(card.photoUrl);
if (photoBase64) {
  const folded = ['PHOTO;ENCODING=b;TYPE=JPEG:' + photoBase64].map((line) => {
    if (line.length <= 75) return line;
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      out.push((i === 0 ? '' : ' ') + line.slice(i, i + 75));
      i += 75;
    }
    return out.join(CRLF);
  })[0];
  lines.push(folded);
}
```

Change the `buildVCard` signature to `async`:

```ts
export async function buildVCard(card: Card): Promise<string> {
```

And `card.photo` → `card.photoUrl` everywhere it appears in this file.

- [ ] **Step 5: Update existing vCard tests**

Edit `lib/__tests__/vcard.test.ts`:
- Add `await` to every `buildVCard(...)` call.
- Mock global `fetch` so the PHOTO line is testable without network. Add to the top:

```ts
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer, // minimal JPEG marker
  } as Response));
});
```

- Add one test:

```ts
it('emits PHOTO line when photoUrl is fetchable', async () => {
  const v = await buildVCard(ahmad);
  expect(v).toMatch(/^PHOTO;ENCODING=b;TYPE=JPEG:/m);
});
```

Update the `ahmad` test fixture import — since `data/cards/ahmad.ts` will be deleted, replace with an inline test fixture matching the `Card` interface from `lib/types.ts`. Put it at the top of the test file:

```ts
const ahmad: Card = {
  slug: 'ahmad',
  template: 'lux',
  defaultLocale: 'en',
  en: { name: 'Ahmad Sharaf', title: 'Founder and CEO · Force AI' },
  ar: { name: 'احمد شرف',    title: 'المؤسس والرئيس التنفيذي · فورس إيه آي' },
  photoUrl: 'https://example.invalid/p.jpg',
  contact: {
    phone: '+96541169141', phoneDisplay: '+965 4116 9141', whatsapp: '+96541169141',
    emails: ['ahmed0montaser@gmail.com'],
    websites: ['forcemediakw.com', 'force-ai.com', 'store.forcemediakw.com'],
  },
  socials: { linkedin: 'a7xq8', github: 'ForceAI-KW' },
  copyrightYear: 2026,
};
```

(Same shape for `JsonLd.test.tsx` — inline fixture; do not import from deleted data/cards.)

- [ ] **Step 6: Update OG image route**

Replace `app/[slug]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { fromPrisma } from '@/lib/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await prisma.card.findUnique({ where: { slug } });
  if (!row) return new ImageResponse(<div />, size);
  const card = fromPrisma(row);
  const c = card.en;
  const isLux = card.template === 'lux';
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: isLux ? '#FFFFFF' : '#2D1418',
        color: isLux ? '#0A0A0B' : '#ECECEC',
        fontSize: 60, fontFamily: 'serif',
      }}>
        <div style={{ fontSize: 96, fontStyle: 'italic' }}>{c.name}</div>
        <div style={{ marginTop: 16, fontSize: 28, color: isLux ? '#686A6C' : '#FF7700', textTransform: 'uppercase', letterSpacing: 4 }}>{c.title}</div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 7: Update sitemap**

Replace `app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const rows = await prisma.card.findMany({ select: { slug: true, updatedAt: true } });
  return rows.map((r) => ({
    url: `${base}/${r.slug}`,
    lastModified: r.updatedAt.toISOString(),
    changeFrequency: 'monthly',
    priority: r.slug === 'ahmad' ? 1.0 : 0.7,
  }));
}
```

- [ ] **Step 8: Update root redirect**

Replace `app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function Root() {
  const first = await prisma.card.findFirst({ orderBy: { createdAt: 'asc' }, select: { slug: true } });
  redirect(first ? `/${first.slug}` : '/admin/login');
}
```

- [ ] **Step 9: Update templates + JsonLd + Photo to use `photoUrl`**

In `components/templates/NardoLux.tsx`, `components/templates/ForceBrand.tsx`, `components/JsonLd.tsx`, `components/Photo.tsx` — find every reference to `card.photo` and replace with `card.photoUrl`. The Photo.tsx component should already work with absolute URLs (Next Image accepts them).

- [ ] **Step 10: Whitelist Vercel Blob hostname in `next.config.ts`**

Find the `images:` block. Add a `remotePatterns` entry:

```ts
images: {
  formats: ['image/avif', 'image/webp'],
  remotePatterns: [
    { protocol: 'https', hostname: '*.public.blob.vercel-storage.com', pathname: '/**' },
  ],
},
```

Also update CSP `img-src`:

Change:
```ts
"img-src 'self' data: blob:",
```
to:
```ts
"img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
```

- [ ] **Step 11: Delete legacy data files**

```bash
git rm -r data/cards/
git rm public/photos/ahmad.jpg
```

- [ ] **Step 12: Verify everything still works**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: tsc clean, unit tests green (with the inline-fixture updates), build succeeds, both `/ahmad` and `/ahmad-fm` static-gen from DB.

- [ ] **Step 13: Smoke test live in dev**

```bash
npm run dev &
sleep 6
curl -sI http://localhost:3000/ahmad | head -3      # 200
curl -s http://localhost:3000/ahmad/contact.vcf | grep -c "BEGIN:VCARD"   # 1
kill %1
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(db): migrate read paths to Prisma; delete TS card files; allow blob.vercel-storage CSP"
```

---

## Task 4: Auth library + middleware + login

**Files:**
- Create: `lib/admin-auth.ts`, `lib/rate-limit.ts`, `middleware.ts`, `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `app/admin/logout/actions.ts`, `components/admin/SignInForm.tsx`, `scripts/hash-password.ts`
- Test: `lib/__tests__/admin-auth.test.ts`, `lib/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Install jose**

```bash
npm install jose
```

- [ ] **Step 2: Write admin-auth tests**

Create `lib/__tests__/admin-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signSession, verifySession } from '../admin-auth';

beforeEach(() => {
  process.env.ADMIN_JWT_SECRET = 'a'.repeat(32);
});

describe('hashPassword + verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });
  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('correct');
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });
  it('is constant-time-ish (no length-based shortcut)', async () => {
    const stored = await hashPassword('a');
    expect(await verifyPassword('', stored)).toBe(false);
  });
});

describe('signSession + verifySession', () => {
  it('round-trips a valid session', async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
  });
  it('rejects a tampered token', async () => {
    const token = await signSession();
    expect(await verifySession(token.slice(0, -2) + 'XX')).toBe(false);
  });
  it('rejects an empty token', async () => {
    expect(await verifySession('')).toBe(false);
    expect(await verifySession(undefined as never)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — expect failure (module missing)**

```bash
npm test -- admin-auth
```

Expected: FAIL with `Cannot find module '../admin-auth'`.

- [ ] **Step 4: Implement `lib/admin-auth.ts`**

```ts
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SCRYPT_KEYLEN = 64;
const JWT_TTL_HOURS = 8;

function secret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 32) throw new Error('ADMIN_JWT_SECRET must be set, ≥32 bytes');
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(plain, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = await scrypt(plain, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

export async function signSession(): Promise<string> {
  return new SignJWT({ adm: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.adm === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test -- admin-auth
```

Expected: 6 passed.

- [ ] **Step 6: Write rate-limit tests**

Create `lib/__tests__/rate-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { check } from '../rate-limit';

describe('rate-limit.check', () => {
  it('allows the first N attempts', () => {
    for (let i = 0; i < 5; i++) {
      expect(check('ip1', 5, 60_000)).toBe(true);
    }
  });
  it('blocks the (N+1)th attempt', () => {
    for (let i = 0; i < 5; i++) check('ip2', 5, 60_000);
    expect(check('ip2', 5, 60_000)).toBe(false);
  });
  it('isolates buckets by key', () => {
    for (let i = 0; i < 5; i++) check('ip3', 5, 60_000);
    expect(check('ip4', 5, 60_000)).toBe(true);
  });
});
```

- [ ] **Step 7: Run tests — expect failure**

```bash
npm test -- rate-limit
```

Expected: FAIL with module missing.

- [ ] **Step 8: Implement `lib/rate-limit.ts`**

```ts
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function check(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

export function reset(key: string): void {
  buckets.delete(key);
}
```

- [ ] **Step 9: Run tests — expect pass**

```bash
npm test -- rate-limit
```

Expected: 3 passed.

- [ ] **Step 10: Write the hash-password CLI**

Create `scripts/hash-password.ts`:

```ts
import { hashPassword } from '../lib/admin-auth';

async function main() {
  const pw = process.argv[2];
  if (!pw) {
    console.error('Usage: tsx scripts/hash-password.ts <plain-password>');
    process.exit(1);
  }
  const hash = await hashPassword(pw);
  console.log(hash);
}
main();
```

Test it:

```bash
npx tsx scripts/hash-password.ts "your-strong-password" > /tmp/hash.txt
cat /tmp/hash.txt    # → <saltHex>:<hashHex>
```

Set this as `ADMIN_PASSWORD_HASH` in `.env.local` AND in Vercel Production env. Also generate a random `ADMIN_JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add to `.env.local`:
```
ADMIN_PASSWORD_HASH=<from hash.txt>
ADMIN_JWT_SECRET=<from randomBytes>
```

And set both in Vercel: `vercel env add ADMIN_PASSWORD_HASH production` (paste value, NO trailing newline — use `printf` per `feedback-vercel-env-newline-trap`).

- [ ] **Step 11: Create middleware**

Create `middleware.ts` (project root):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/admin-auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }
  const token = req.cookies.get('admin_session')?.value;
  const ok = await verifySession(token);
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 12: Create the SignInForm client component**

Create `components/admin/SignInForm.tsx`:

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/app/admin/login/actions';

type State = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 rounded-pill bg-ink text-white font-semibold uppercase tracking-wider-12 text-[14px] disabled:opacity-50"
    >
      {pending ? 'Signing in…' : 'SIGN IN'}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useFormState<State, FormData>(loginAction, {});
  return (
    <form action={action} className="w-full max-w-[360px] flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 px-4 border border-ink rounded-pill text-ink"
        />
      </label>
      {state.error && <p className="text-[12px]" style={{ color: '#b00020' }}>{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 13: Create login server action**

Create `app/admin/login/actions.ts`:

```ts
'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword, signSession } from '@/lib/admin-auth';
import { check as rateCheck } from '@/lib/rate-limit';

type State = { error?: string };

export async function loginAction(_prev: State, fd: FormData): Promise<State> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateCheck(`login:${ip}`, 5, 15 * 60 * 1000)) {
    return { error: 'Too many attempts. Wait 15 minutes.' };
  }

  const pw = (fd.get('password') ?? '').toString();
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return { error: 'Server not configured (ADMIN_PASSWORD_HASH missing).' };

  const ok = await verifyPassword(pw, stored);
  if (!ok) return { error: 'Invalid password.' };

  const token = await signSession();
  (await cookies()).set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  const from = (fd.get('from') ?? '/admin').toString() || '/admin';
  redirect(from);
}
```

- [ ] **Step 14: Create login page**

Create `app/admin/login/page.tsx`:

```tsx
import { SignInForm } from '@/components/admin/SignInForm';

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <h1 className="font-serif italic text-[36px] text-ink mb-2">digital-card</h1>
      <p className="text-[12px] uppercase tracking-[0.12em] mb-8" style={{ color: '#686A6C' }}>Admin</p>
      <SignInForm />
      {from && <input type="hidden" name="from" value={from} />}
    </main>
  );
}
```

- [ ] **Step 15: Create logout action**

Create `app/admin/logout/actions.ts`:

```ts
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logoutAction(): Promise<void> {
  (await cookies()).delete('admin_session');
  redirect('/admin/login');
}
```

- [ ] **Step 16: Smoke test the auth flow**

```bash
npm run dev &
sleep 6
# visit http://localhost:3000/admin → expect redirect to /admin/login
# enter wrong password → expect "Invalid password."
# enter correct password → expect redirect to /admin (will 404 until Task 5, but cookie should be set)
# in browser devtools, check that admin_session cookie is httpOnly + Secure (Secure off in dev)
kill %1
```

- [ ] **Step 17: Commit**

```bash
git add lib/admin-auth.ts lib/rate-limit.ts lib/__tests__/admin-auth.test.ts lib/__tests__/rate-limit.test.ts middleware.ts app/admin/login/ app/admin/logout/ components/admin/SignInForm.tsx scripts/hash-password.ts package.json package-lock.json
git commit -m "feat(admin): scrypt+JWT auth + middleware + rate-limited login form"
```

---

## Task 5: Admin list page

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `components/admin/Toast.tsx`

- [ ] **Step 1: Create admin shell layout**

Create `app/admin/layout.tsx`:

```tsx
import Link from 'next/link';
import { logoutAction } from './logout/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-50" style={{ borderBottomColor: 'rgba(104,106,108,0.25)' }}>
        <Link href="/admin" className="text-[12px] font-semibold uppercase tracking-wider-15 text-ink">Admin</Link>
        <form action={logoutAction}>
          <button type="submit" className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Sign out</button>
        </form>
      </header>
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create the card list page**

Create `app/admin/page.tsx`:

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const cards = await prisma.card.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true, enName: true, template: true, brand: true, photoUrl: true },
  });

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif italic text-[32px] text-ink">Cards</h1>
        <Link
          href="/admin/cards/new"
          className="h-12 px-6 rounded-pill bg-ink text-white font-semibold uppercase tracking-[0.08em] text-[12px] flex items-center"
        >+ NEW CARD</Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-[14px]" style={{ color: '#686A6C' }}>No cards yet. Create the first one.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>
              <th className="py-3"></th>
              <th className="py-3">Slug</th>
              <th className="py-3">Name</th>
              <th className="py-3">Template</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'rgba(104,106,108,0.20)' }}>
                <td className="py-3">
                  <Image src={c.photoUrl} alt="" width={32} height={32} className="rounded-full object-cover" />
                </td>
                <td className="py-3 text-[14px] text-ink">/{c.slug}</td>
                <td className="py-3 text-[14px] text-ink">{c.enName}</td>
                <td className="py-3 text-[14px]" style={{ color: '#686A6C' }}>
                  {c.template}{c.brand ? ` · ${c.brand}` : ''}
                </td>
                <td className="py-3 text-right">
                  <Link href={`/${c.slug}`} target="_blank" className="text-[12px] mr-4" style={{ color: '#686A6C' }}>Preview</Link>
                  <Link href={`/admin/cards/${c.id}`} className="text-[12px] text-ink">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
```

- [ ] **Step 3: Create Toast component**

Create `components/admin/Toast.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function Toast() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const status = sp.get('status');
  const [visible, setVisible] = useState(!!status);

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => {
      setVisible(false);
      router.replace(pathname, { scroll: false });
    }, 2000);
    return () => clearTimeout(id);
  }, [status, router, pathname]);

  if (!visible || !status) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 h-12 px-6 rounded-pill bg-ink text-white text-[13px] uppercase tracking-[0.08em] flex items-center z-50">
      {status === 'saved' ? 'Saved ✓' : status === 'deleted' ? 'Deleted' : status === 'created' ? 'Created' : status}
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev &
sleep 6
# Sign in (Task 4 flow), then visit http://localhost:3000/admin
# Expect: header with "Admin" + "Sign out", two card rows with photo thumbnails + edit links
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx components/admin/Toast.tsx
git commit -m "feat(admin): card list page + shell layout + Toast component"
```

---

## Task 6: Admin form (new + edit) + Zod schemas + server actions

**Files:**
- Create: `lib/admin-schemas.ts`, `app/admin/cards/new/page.tsx`, `app/admin/cards/new/actions.ts`, `app/admin/cards/[id]/page.tsx`, `app/admin/cards/[id]/actions.ts`, `components/admin/CardForm.tsx`, `components/admin/DeleteButton.tsx`
- Test: `lib/__tests__/admin-schemas.test.ts`

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Write Zod schema tests**

Create `lib/__tests__/admin-schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardInputSchema } from '../admin-schemas';

const valid = {
  slug: 'jane',
  template: 'lux' as const,
  brand: null,
  defaultLocale: 'en' as const,
  enName: 'Jane Doe', enTitle: 'Engineer',
  arName: 'جين دو',  arTitle: 'مهندسة',
  photoUrl: 'https://x.public.blob.vercel-storage.com/photos/jane.jpg',
  phone: '+1234567890', phoneDisplay: '+1 234 567 890', whatsapp: '+1234567890',
  emails: ['jane@example.com'], websites: ['example.com'],
  instagram: null, linkedin: 'jane', x: null, github: null, youtube: null, tiktok: null,
  copyrightYear: 2026,
};

describe('cardInputSchema', () => {
  it('accepts a valid input', () => {
    expect(cardInputSchema.parse(valid)).toBeTruthy();
  });
  it('rejects slug with spaces', () => {
    expect(() => cardInputSchema.parse({ ...valid, slug: 'jane doe' })).toThrow();
  });
  it('rejects slug with uppercase', () => {
    expect(() => cardInputSchema.parse({ ...valid, slug: 'Jane' })).toThrow();
  });
  it('requires force template to have a brand', () => {
    expect(() => cardInputSchema.parse({ ...valid, template: 'force', brand: null })).toThrow();
  });
  it('rejects lux template with a brand set', () => {
    expect(() => cardInputSchema.parse({ ...valid, template: 'lux', brand: 'force-ai' })).toThrow();
  });
  it('rejects invalid email', () => {
    expect(() => cardInputSchema.parse({ ...valid, emails: ['not-an-email'] })).toThrow();
  });
  it('rejects empty enName', () => {
    expect(() => cardInputSchema.parse({ ...valid, enName: '' })).toThrow();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm test -- admin-schemas
```

Expected: `Cannot find module '../admin-schemas'`.

- [ ] **Step 4: Implement Zod schema**

Create `lib/admin-schemas.ts`:

```ts
import { z } from 'zod';

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/;

const baseSchema = z.object({
  slug: z.string().regex(slugRe, 'lowercase letters, digits, hyphens; 1-42 chars'),
  template: z.enum(['lux', 'force']),
  brand: z.enum(['force-ai', 'force-media']).nullable(),
  defaultLocale: z.enum(['en', 'ar']),
  enName: z.string().min(1, 'required').max(80),
  enTitle: z.string().min(1, 'required').max(200),
  arName: z.string().min(1, 'required').max(80),
  arTitle: z.string().min(1, 'required').max(200),
  photoUrl: z.string().url(),
  phone: z.string().regex(/^\+?[0-9]{6,16}$/).nullable().or(z.literal('').transform(() => null)),
  phoneDisplay: z.string().max(40).nullable().or(z.literal('').transform(() => null)),
  whatsapp: z.string().regex(/^\+?[0-9]{6,16}$/).nullable().or(z.literal('').transform(() => null)),
  emails: z.array(z.string().email()).max(5).default([]),
  websites: z.array(z.string().min(3).max(200)).max(10).default([]),
  instagram: z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  linkedin:  z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  x:         z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  github:    z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  youtube:   z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  tiktok:    z.string().max(60).nullable().or(z.literal('').transform(() => null)),
  copyrightYear: z.number().int().min(2000).max(2100),
});

export const cardInputSchema = baseSchema.superRefine((val, ctx) => {
  if (val.template === 'force' && !val.brand) {
    ctx.addIssue({ code: 'custom', path: ['brand'], message: 'brand is required when template is force' });
  }
  if (val.template === 'lux' && val.brand) {
    ctx.addIssue({ code: 'custom', path: ['brand'], message: 'brand must be empty for lux template' });
  }
});

export type CardInput = z.infer<typeof cardInputSchema>;
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test -- admin-schemas
```

Expected: 7 passed.

- [ ] **Step 6: Shared CardForm client component**

Create `components/admin/CardForm.tsx`:

```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { PhotoDropzone } from './PhotoDropzone';

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

type Props = {
  initial?: {
    id?: string;
    slug?: string; template?: 'lux' | 'force'; brand?: 'force-ai' | 'force-media' | null;
    defaultLocale?: 'en' | 'ar';
    enName?: string; enTitle?: string; arName?: string; arTitle?: string;
    photoUrl?: string;
    phone?: string | null; phoneDisplay?: string | null; whatsapp?: string | null;
    emails?: string[]; websites?: string[];
    instagram?: string | null; linkedin?: string | null; x?: string | null; github?: string | null; youtube?: string | null; tiktok?: string | null;
    copyrightYear?: number;
  };
  action: Action;
  submitLabel: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 px-8 rounded-pill bg-ink text-white font-semibold uppercase tracking-wider-12 text-[14px] disabled:opacity-50"
    >{pending ? 'Saving…' : label}</button>
  );
}

function field(name: string, label: string, value: string | null | undefined, type = 'text', err?: string) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ''}
        className="h-12 px-4 border border-ink rounded-pill text-ink text-[14px]"
      />
      {err && <span className="text-[11px]" style={{ color: '#b00020' }}>{err}</span>}
    </label>
  );
}

export function CardForm({ initial = {}, action, submitLabel }: Props) {
  const [state, formAction] = useFormState(action, {} as ActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {field('slug', 'Slug (URL path)', initial.slug, 'text', fe.slug)}
      <label className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Template</span>
        <select name="template" defaultValue={initial.template ?? 'lux'} className="h-12 px-4 border border-ink rounded-pill text-ink text-[14px]">
          <option value="lux">lux — luxury (white/black/Nardo grey)</option>
          <option value="force">force — Force brand (wine/orange/cream)</option>
        </select>
        {fe.template && <span className="text-[11px]" style={{ color: '#b00020' }}>{fe.template}</span>}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Brand (force template only)</span>
        <select name="brand" defaultValue={initial.brand ?? ''} className="h-12 px-4 border border-ink rounded-pill text-ink text-[14px]">
          <option value="">— none (use only with lux)</option>
          <option value="force-ai">Force AI</option>
          <option value="force-media">Force Media</option>
        </select>
        {fe.brand && <span className="text-[11px]" style={{ color: '#b00020' }}>{fe.brand}</span>}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Default locale</span>
        <select name="defaultLocale" defaultValue={initial.defaultLocale ?? 'en'} className="h-12 px-4 border border-ink rounded-pill text-ink text-[14px]">
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </select>
      </label>

      <hr className="border-0 h-px" style={{ backgroundColor: 'rgba(104,106,108,0.20)' }} />
      <h2 className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Identity</h2>
      {field('enName',  'Name (EN)',     initial.enName,  'text', fe.enName)}
      {field('enTitle', 'Title (EN)',    initial.enTitle, 'text', fe.enTitle)}
      {field('arName',  'Name (AR)',     initial.arName,  'text', fe.arName)}
      {field('arTitle', 'Title (AR)',    initial.arTitle, 'text', fe.arTitle)}

      <hr className="border-0 h-px" style={{ backgroundColor: 'rgba(104,106,108,0.20)' }} />
      <h2 className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Photo</h2>
      <PhotoDropzone slug={initial.slug ?? ''} initialUrl={initial.photoUrl} />

      <hr className="border-0 h-px" style={{ backgroundColor: 'rgba(104,106,108,0.20)' }} />
      <h2 className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Contact</h2>
      {field('phone',        'Phone (intl, digits only)', initial.phone,        'text', fe.phone)}
      {field('phoneDisplay', 'Phone (display)',           initial.phoneDisplay, 'text', fe.phoneDisplay)}
      {field('whatsapp',     'WhatsApp (intl)',           initial.whatsapp,     'text', fe.whatsapp)}
      {field('emails',       'Emails (comma-separated)',  initial.emails?.join(', '), 'text', fe.emails)}
      {field('websites',     'Websites (comma-separated)',initial.websites?.join(', '), 'text', fe.websites)}

      <hr className="border-0 h-px" style={{ backgroundColor: 'rgba(104,106,108,0.20)' }} />
      <h2 className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Socials (handles only)</h2>
      {field('instagram', 'Instagram', initial.instagram, 'text', fe.instagram)}
      {field('linkedin',  'LinkedIn',  initial.linkedin,  'text', fe.linkedin)}
      {field('x',         'X (Twitter)', initial.x,       'text', fe.x)}
      {field('github',    'GitHub',    initial.github,    'text', fe.github)}
      {field('youtube',   'YouTube',   initial.youtube,   'text', fe.youtube)}
      {field('tiktok',    'TikTok',    initial.tiktok,    'text', fe.tiktok)}

      <hr className="border-0 h-px" style={{ backgroundColor: 'rgba(104,106,108,0.20)' }} />
      {field('copyrightYear', 'Copyright year', String(initial.copyrightYear ?? 2026), 'number', fe.copyrightYear)}

      {state.error && <p className="text-[12px]" style={{ color: '#b00020' }}>{state.error}</p>}

      <div className="flex gap-4 items-center mt-4">
        <Submit label={submitLabel} />
        <Link href="/admin" className="text-[12px] uppercase tracking-[0.12em]" style={{ color: '#686A6C' }}>Cancel</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Create new-card page + action**

Create `app/admin/cards/new/actions.ts`:

```ts
'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { cardInputSchema } from '@/lib/admin-schemas';

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

function parseList(s: string | null): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function createCardAction(_prev: State, fd: FormData): Promise<State> {
  const raw = {
    slug: (fd.get('slug') ?? '').toString(),
    template: (fd.get('template') ?? 'lux').toString() as 'lux' | 'force',
    brand: ((fd.get('brand') ?? '').toString() || null) as 'force-ai' | 'force-media' | null,
    defaultLocale: (fd.get('defaultLocale') ?? 'en').toString() as 'en' | 'ar',
    enName:  (fd.get('enName')  ?? '').toString(),
    enTitle: (fd.get('enTitle') ?? '').toString(),
    arName:  (fd.get('arName')  ?? '').toString(),
    arTitle: (fd.get('arTitle') ?? '').toString(),
    photoUrl: (fd.get('photoUrl') ?? '').toString(),
    phone: (fd.get('phone') ?? '').toString() || null,
    phoneDisplay: (fd.get('phoneDisplay') ?? '').toString() || null,
    whatsapp: (fd.get('whatsapp') ?? '').toString() || null,
    emails: parseList(fd.get('emails')?.toString() ?? ''),
    websites: parseList(fd.get('websites')?.toString() ?? ''),
    instagram: (fd.get('instagram') ?? '').toString() || null,
    linkedin:  (fd.get('linkedin')  ?? '').toString() || null,
    x:         (fd.get('x')         ?? '').toString() || null,
    github:    (fd.get('github')    ?? '').toString() || null,
    youtube:   (fd.get('youtube')   ?? '').toString() || null,
    tiktok:    (fd.get('tiktok')    ?? '').toString() || null,
    copyrightYear: Number(fd.get('copyrightYear') ?? 2026),
  };

  const parsed = cardInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? '_';
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Some fields need attention.', fieldErrors };
  }

  try {
    const row = {
      ...parsed.data,
      brand: parsed.data.brand === 'force-ai' ? 'force_ai' : parsed.data.brand === 'force-media' ? 'force_media' : null,
    };
    const card = await prisma.card.create({ data: row });
    revalidatePath(`/${card.slug}`);
    revalidatePath('/sitemap.xml');
  } catch (e) {
    const msg = (e as { code?: string }).code === 'P2002' ? 'Slug already taken.' : 'Database error.';
    return { ok: false, error: msg };
  }
  redirect(`/admin?status=created`);
}
```

Create `app/admin/cards/new/page.tsx`:

```tsx
import { CardForm } from '@/components/admin/CardForm';
import { createCardAction } from './actions';

export default function NewCardPage() {
  return (
    <>
      <h1 className="font-serif italic text-[32px] text-ink mb-8">New card</h1>
      <CardForm action={createCardAction} submitLabel="CREATE" />
    </>
  );
}
```

- [ ] **Step 8: Create edit + delete page + actions**

Create `app/admin/cards/[id]/actions.ts`:

```ts
'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { cardInputSchema } from '@/lib/admin-schemas';
import { deleteCardPhoto } from '@/lib/blob';

type State = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

function parseList(s: string | null): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function updateCardAction(id: string, _prev: State, fd: FormData): Promise<State> {
  const raw = {
    slug: (fd.get('slug') ?? '').toString(),
    template: (fd.get('template') ?? 'lux').toString() as 'lux' | 'force',
    brand: ((fd.get('brand') ?? '').toString() || null) as 'force-ai' | 'force-media' | null,
    defaultLocale: (fd.get('defaultLocale') ?? 'en').toString() as 'en' | 'ar',
    enName: (fd.get('enName') ?? '').toString(),
    enTitle: (fd.get('enTitle') ?? '').toString(),
    arName: (fd.get('arName') ?? '').toString(),
    arTitle: (fd.get('arTitle') ?? '').toString(),
    photoUrl: (fd.get('photoUrl') ?? '').toString(),
    phone: (fd.get('phone') ?? '').toString() || null,
    phoneDisplay: (fd.get('phoneDisplay') ?? '').toString() || null,
    whatsapp: (fd.get('whatsapp') ?? '').toString() || null,
    emails: parseList(fd.get('emails')?.toString() ?? ''),
    websites: parseList(fd.get('websites')?.toString() ?? ''),
    instagram: (fd.get('instagram') ?? '').toString() || null,
    linkedin: (fd.get('linkedin') ?? '').toString() || null,
    x: (fd.get('x') ?? '').toString() || null,
    github: (fd.get('github') ?? '').toString() || null,
    youtube: (fd.get('youtube') ?? '').toString() || null,
    tiktok: (fd.get('tiktok') ?? '').toString() || null,
    copyrightYear: Number(fd.get('copyrightYear') ?? 2026),
  };

  const parsed = cardInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? '_';
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: 'Some fields need attention.', fieldErrors };
  }

  try {
    const row = {
      ...parsed.data,
      brand: parsed.data.brand === 'force-ai' ? 'force_ai' : parsed.data.brand === 'force-media' ? 'force_media' : null,
    };
    const card = await prisma.card.update({ where: { id }, data: row });
    revalidatePath(`/${card.slug}`);
    revalidatePath('/sitemap.xml');
  } catch (e) {
    const msg = (e as { code?: string }).code === 'P2002' ? 'Slug already taken.' : 'Database error.';
    return { ok: false, error: msg };
  }
  redirect(`/admin?status=saved`);
}

export async function deleteCardAction(id: string): Promise<void> {
  const card = await prisma.card.findUnique({ where: { id }, select: { slug: true, photoUrl: true } });
  if (!card) redirect('/admin');
  await prisma.card.delete({ where: { id } });
  await deleteCardPhoto(card!.photoUrl);
  revalidatePath(`/${card!.slug}`);
  revalidatePath('/sitemap.xml');
  redirect('/admin?status=deleted');
}
```

Create `app/admin/cards/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CardForm } from '@/components/admin/CardForm';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { updateCardAction, deleteCardAction } from './actions';

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.card.findUnique({ where: { id } });
  if (!row) notFound();

  const initial = {
    id: row.id,
    slug: row.slug,
    template: row.template as 'lux' | 'force',
    brand: row.brand === 'force_ai' ? 'force-ai' as const : row.brand === 'force_media' ? 'force-media' as const : null,
    defaultLocale: row.defaultLocale as 'en' | 'ar',
    enName: row.enName, enTitle: row.enTitle, arName: row.arName, arTitle: row.arTitle,
    photoUrl: row.photoUrl,
    phone: row.phone, phoneDisplay: row.phoneDisplay, whatsapp: row.whatsapp,
    emails: row.emails, websites: row.websites,
    instagram: row.instagram, linkedin: row.linkedin, x: row.x, github: row.github, youtube: row.youtube, tiktok: row.tiktok,
    copyrightYear: row.copyrightYear,
  };

  const boundUpdate = updateCardAction.bind(null, id);
  const boundDelete = deleteCardAction.bind(null, id);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif italic text-[32px] text-ink">/{row.slug}</h1>
        <DeleteButton action={boundDelete} slug={row.slug} />
      </div>
      <CardForm initial={initial} action={boundUpdate} submitLabel="SAVE" />
    </>
  );
}
```

- [ ] **Step 9: Create DeleteButton client component**

Create `components/admin/DeleteButton.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

type Props = { action: () => Promise<void>; slug: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-5 rounded-pill bg-[#b00020] text-white text-[12px] uppercase tracking-[0.12em] disabled:opacity-50"
    >{pending ? 'Deleting…' : 'Confirm delete'}</button>
  );
}

export function DeleteButton({ action, slug }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-5 rounded-pill border border-[#b00020] text-[#b00020] text-[12px] uppercase tracking-[0.12em]"
      >Delete</button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="bg-white p-6 rounded-[12px] flex flex-col items-center gap-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] text-ink text-center">Delete <span className="font-semibold">/{slug}</span>? This is permanent.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="h-10 px-5 rounded-pill border border-ink text-ink text-[12px] uppercase tracking-[0.12em]">Cancel</button>
              <form action={action}><Submit /></form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 10: Smoke test all flows in dev**

```bash
npm run dev &
sleep 6
# In browser: sign in, click "+ NEW CARD", fill out form, submit
# Expect: redirect to /admin?status=created with toast "Created"
# Click into the new card, edit a field, save
# Expect: redirect to /admin?status=saved with toast "Saved ✓"
# Click Delete → confirm modal → confirm
# Expect: redirect to /admin?status=deleted with toast "Deleted"
kill %1
```

(Toast doesn't appear yet because we haven't included it in admin/layout.tsx — that's covered in Task 7 cleanup.)

- [ ] **Step 11: Add Toast to admin layout**

Edit `app/admin/layout.tsx`. Inside `<main>`, before `{children}`, add:

```tsx
import { Toast } from '@/components/admin/Toast';
import { Suspense } from 'react';
...
<Suspense fallback={null}><Toast /></Suspense>
{children}
```

(Suspense required because Toast uses useSearchParams.)

- [ ] **Step 12: Commit**

```bash
git add lib/admin-schemas.ts lib/__tests__/admin-schemas.test.ts app/admin/cards/ components/admin/CardForm.tsx components/admin/DeleteButton.tsx app/admin/layout.tsx package.json package-lock.json
git commit -m "feat(admin): new/edit/delete forms with Zod validation + Toast feedback"
```

---

## Task 7: Photo upload (Vercel Blob)

**Files:**
- Create: `app/admin/cards/photo/route.ts`, `components/admin/PhotoDropzone.tsx`
- Modify: `lib/admin-auth.ts` (add requireAdmin helper)

- [ ] **Step 1: Add `requireAdmin` to auth lib**

In `lib/admin-auth.ts`, append:

```ts
import { cookies } from 'next/headers';

export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get('admin_session')?.value;
  if (!await verifySession(token)) {
    throw new Error('UNAUTHORIZED');
  }
}
```

- [ ] **Step 2: Create photo upload route handler**

Create `app/admin/cards/photo/route.ts`:

```ts
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

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await uploadCardPhoto(slug, buf, file.type);
  return NextResponse.json({ url });
}
```

- [ ] **Step 3: PhotoDropzone client component**

Create `components/admin/PhotoDropzone.tsx`:

```tsx
'use client';
import { useState } from 'react';

type Props = { slug: string; initialUrl?: string };

export function PhotoDropzone({ slug, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!slug) { setErr('Enter the slug above first.'); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slug', slug);
    try {
      const res = await fetch('/admin/cards/photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'upload failed');
      setUrl(json.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-16 h-16 rounded-full object-cover border border-ink" />
      ) : (
        <div className="w-16 h-16 rounded-full" style={{ backgroundColor: 'rgba(104,106,108,0.10)' }} />
      )}
      <div className="flex flex-col gap-2">
        <input type="hidden" name="photoUrl" value={url} />
        <label className="cursor-pointer h-10 px-5 rounded-pill border border-ink text-ink text-[12px] uppercase tracking-[0.12em] flex items-center w-fit">
          {busy ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={busy} className="hidden" />
        </label>
        {err && <span className="text-[11px]" style={{ color: '#b00020' }}>{err}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev &
sleep 6
# Visit /admin/cards/new, enter slug "test-card", click Upload, pick a small JPEG
# Expect: photo preview appears, hidden input photoUrl gets a Vercel Blob URL
# Submit form → card created with that photo
# Open /test-card in another tab → renders with the uploaded photo
# Then go back to /admin → click test-card edit → Delete → confirm
# Expect: blob deleted in background; row gone from DB
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/cards/photo/ components/admin/PhotoDropzone.tsx lib/admin-auth.ts
git commit -m "feat(admin): photo upload via Vercel Blob + requireAdmin helper"
```

---

## Task 8: Rule 13 CI gate (Preview ≠ Production DATABASE_URL)

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Append the env-isolation step to CI**

Edit `.github/workflows/ci.yml`. After the existing `npm audit` step, add (you'll need a `VERCEL_TOKEN` GitHub secret pointing at a token with read access to the project):

```yaml
      - name: Rule 13 — Preview DATABASE_URL ≠ Production
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          if [ -z "$VERCEL_TOKEN" ]; then
            echo "VERCEL_TOKEN not set; skipping rule 13 gate (allowed in fork PRs)."
            exit 0
          fi
          npm i -g vercel@latest
          PROD=$(vercel env pull --environment=production --token "$VERCEL_TOKEN" /tmp/prod.env >/dev/null && grep ^DATABASE_URL= /tmp/prod.env | head -1 | cut -d= -f2-)
          PREV=$(vercel env pull --environment=preview --token "$VERCEL_TOKEN" /tmp/prev.env >/dev/null && grep ^DATABASE_URL= /tmp/prev.env | head -1 | cut -d= -f2-)
          if [ -z "$PROD" ] || [ -z "$PREV" ]; then
            echo "DATABASE_URL not set in one of (production, preview)"; exit 1
          fi
          if [ "$PROD" = "$PREV" ]; then
            echo "✗ rule 13 violation: production DATABASE_URL == preview DATABASE_URL"
            exit 1
          fi
          echo "✓ rule 13 ok"
```

- [ ] **Step 2: Generate a `VERCEL_TOKEN` and add to GitHub secrets**

```bash
vercel tokens create digital-card-ci --scope ahmad-sharafs-projects --expiration 365d 2>&1 | tail -3
# Copy the token. Then:
gh secret set VERCEL_TOKEN -R ForceAI-KW/digital-card --body "<token>"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(rule13): fail PR if Vercel Preview DATABASE_URL equals Production"
```

---

## Task 9: Neon snapshot workflow + ROLLBACK update

**Files:**
- Create: `.github/workflows/neon-snapshot.yml`
- Modify: `docs/ROLLBACK.md`

- [ ] **Step 1: Create per-commit snapshot workflow**

Create `.github/workflows/neon-snapshot.yml`:

```yaml
name: neon-snapshot
on:
  push:
    branches: [main]
jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create Neon branch from prod
        env:
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
          NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
        run: |
          SHORT=$(echo "${{ github.sha }}" | cut -c1-8)
          BRANCH="prod-${SHORT}"
          npm i -g neonctl
          neonctl branches create --project-id "$NEON_PROJECT_ID" --name "$BRANCH" --parent main || true
          # Keep newest 9 prod-* branches (free tier 10 cap)
          neonctl branches list --project-id "$NEON_PROJECT_ID" --output json | \
            jq -r '.[].name' | grep -E '^prod-' | sort -r | tail -n +10 | \
            while read -r old; do
              echo "pruning $old"
              neonctl branches delete --project-id "$NEON_PROJECT_ID" "$old" || true
            done
```

- [ ] **Step 2: Set required GitHub secrets**

```bash
gh secret set NEON_API_KEY      -R ForceAI-KW/digital-card --body "<from Neon dashboard>"
gh secret set NEON_PROJECT_ID   -R ForceAI-KW/digital-card --body "<from /tmp/neon-project-id>"
```

- [ ] **Step 3: Update `docs/ROLLBACK.md` with the Neon restore path**

Append a new section at the bottom:

```markdown
## 4. Neon snapshot restore (for migration scenarios)

Each push to `main` creates a `prod-<short-sha>` Neon branch capturing prod data state at that commit. To restore:

1. In Neon dashboard → digital-card → Branches, pick the `prod-<sha>` branch corresponding to the desired commit.
2. Promote it to main (`neonctl branches set-primary <branch>`) OR copy `DATABASE_URL` from that branch into a new `RESTORE_DATABASE_URL` env var on Vercel and redeploy with that override.
3. Run `npx prisma migrate deploy` against the new URL to ensure schema is consistent.

**When to use:** if HEAD ran a Prisma migration that altered prod data and you want both schema AND data rolled back. Code-only rollback (`./scripts/rollback.sh`) does NOT undo schema changes.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/neon-snapshot.yml docs/ROLLBACK.md
git commit -m "ops(neon): per-commit snapshot branches + ROLLBACK.md restore path"
```

---

## Task 10: Playwright admin e2e + DEPLOYMENT.md + final verification

**Files:**
- Create: `tests/e2e/admin-login.spec.ts`, `tests/e2e/admin-crud.spec.ts`
- Modify: `docs/DEPLOYMENT.md`, `playwright.config.ts`

- [ ] **Step 1: Update playwright.config.ts for admin tests**

Edit `playwright.config.ts`. Ensure `webServer.env` passes `ADMIN_PASSWORD_HASH` and `ADMIN_JWT_SECRET` for testing. Simplest: read from `.env.local`. Replace contents:

```ts
import { defineConfig } from '@playwright/test';
import { config as dotenv } from 'dotenv';

dotenv({ path: '.env.local' });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,             // admin CRUD tests share DB state
  webServer: {
    command: 'npm run build && npm run start -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      DIRECT_URL: process.env.DIRECT_URL!,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH!,
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET!,
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN!,
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3001',
    },
  },
  use: { baseURL: 'http://localhost:3001' },
});
```

Install dotenv if not already (Task 1 added it). Otherwise:
```bash
npm install -D dotenv
```

- [ ] **Step 2: Login e2e**

Create `tests/e2e/admin-login.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('login: redirects to /admin/login when unauthenticated', async ({ page }) => {
  const res = await page.goto('/admin');
  expect(page.url()).toContain('/admin/login');
  expect(res?.status()).toBe(200);
});

test('login: wrong password shows error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name=password]', 'definitely-wrong');
  await page.click('button[type=submit]');
  await expect(page.getByText(/invalid password/i)).toBeVisible();
});

test('login: correct password sets cookie and reaches /admin', async ({ page }) => {
  // Test password must be the one whose hash is in ADMIN_PASSWORD_HASH env.
  const pw = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  test.skip(!pw, 'set PLAYWRIGHT_ADMIN_PASSWORD to run this');
  await page.goto('/admin/login');
  await page.fill('input[name=password]', pw!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
});
```

- [ ] **Step 3: CRUD e2e**

Create `tests/e2e/admin-crud.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const PW = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
test.skip(!PW, 'set PLAYWRIGHT_ADMIN_PASSWORD');

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.fill('input[name=password]', PW!);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin$/);
}

test('CRUD: create → edit → delete', async ({ page }) => {
  await signIn(page);

  // create
  await page.click('text=+ NEW CARD');
  await page.fill('input[name=slug]', 'qa-test');
  await page.fill('input[name=enName]', 'QA Test');
  await page.fill('input[name=enTitle]', 'Tester');
  await page.fill('input[name=arName]', 'اختبار');
  await page.fill('input[name=arTitle]', 'مختبر');
  // Photo URL: use the seed photo (already in Blob) to avoid network upload in tests
  await page.fill('input[name=photoUrl]', process.env.PLAYWRIGHT_SEED_PHOTO_URL ?? 'https://example.invalid/p.jpg');
  await page.fill('input[name=emails]', 'qa@example.com');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin(\?status=created)?$/);
  await expect(page.getByText('QA Test')).toBeVisible();

  // edit
  await page.click('text=QA Test');                       // table row name links via edit
  await page.fill('input[name=enTitle]', 'Senior Tester');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/admin(\?status=saved)?$/);

  // delete
  await page.click('text=QA Test');
  await page.click('text=Delete');
  await page.click('text=Confirm delete');
  await expect(page).toHaveURL(/\/admin(\?status=deleted)?$/);
  await expect(page.getByText('QA Test')).not.toBeVisible();
});
```

- [ ] **Step 4: Run all tests**

```bash
PLAYWRIGHT_ADMIN_PASSWORD="<your-password>" \
PLAYWRIGHT_SEED_PHOTO_URL="<the blob URL from task 2 seed run>" \
npm run test:e2e
```

Expected: all v1 e2e (6) + new login (3) + new CRUD (1) = 10 tests green.

- [ ] **Step 5: Update DEPLOYMENT.md**

Edit `docs/DEPLOYMENT.md`. Replace the entire "## Vercel (Hobby plan)" section with:

```markdown
## Vercel deployment

### One-time setup
1. **Neon project**: created via `neonctl projects create --name digital-card`. Branches: `main` (prod) + `preview` (preview deploys). Both connection strings paired with `DATABASE_URL` + `DIRECT_URL` env vars in Vercel.

2. **Vercel Blob**: connected via dashboard → Storage → Vercel Blob → Create. `BLOB_READ_WRITE_TOKEN` auto-injected.

3. **Admin password**:
   ```
   npx tsx scripts/hash-password.ts "your-strong-password"
   # → <saltHex>:<hashHex>
   ```
   Then in Vercel → Settings → Environment Variables, set `ADMIN_PASSWORD_HASH` (Production only) using `printf` to avoid the newline trap:
   ```
   printf '<saltHex>:<hashHex>' | vercel env add ADMIN_PASSWORD_HASH production
   ```

4. **JWT secret**:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   `printf '<value>' | vercel env add ADMIN_JWT_SECRET production`

5. **GitHub secrets** (for CI workflows):
   - `VERCEL_TOKEN` — `vercel tokens create digital-card-ci`
   - `NEON_API_KEY` — from Neon dashboard → Account Settings → API Keys
   - `NEON_PROJECT_ID` — `neonctl projects list --output json | jq -r '.[] | select(.name=="digital-card") | .id'`

### Env vars summary
| Name | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | prod Neon branch | preview Neon branch | preview Neon branch | rule 13: MUST differ between prod + preview |
| `DIRECT_URL` | prod direct | preview direct | preview direct | |
| `ADMIN_PASSWORD_HASH` | ✓ | — | ✓ | scrypt `<salt>:<hash>` |
| `ADMIN_JWT_SECRET` | ✓ | — | ✓ | 32+ bytes base64 |
| `BLOB_READ_WRITE_TOKEN` | ✓ (auto) | ✓ (auto) | pulled via `vercel env pull` | |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` | blank or staging | `http://localhost:3000` | rule 13: different from prod |

### Post-launch checks
- [ ] `/robots.txt` returns allow-all
- [ ] `/sitemap.xml` lists every slug (from DB)
- [ ] `/ahmad/contact.vcf` downloads with PHOTO line
- [ ] Locale toggle flips html dir
- [ ] CSP + HSTS + nosniff + frame-deny present
- [ ] `/admin` redirects to `/admin/login` when no cookie
- [ ] `/admin` reachable with correct password; rate-limits 6th attempt within 15 min
- [ ] CRUD admin flow completes (create → edit → delete) with revalidation
- [ ] UptimeRobot monitor on `/ahmad` (rule 6)
```

- [ ] **Step 6: Full final stack run**

```bash
npm audit && npx tsc --noEmit && npm run lint && npm test && npm run build
PLAYWRIGHT_ADMIN_PASSWORD="<your-password>" \
PLAYWRIGHT_SEED_PHOTO_URL="<blob URL>" \
npm run test:e2e
```

Every command exits 0.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/admin-login.spec.ts tests/e2e/admin-crud.spec.ts playwright.config.ts docs/DEPLOYMENT.md package.json package-lock.json
git commit -m "test(admin): Playwright login + CRUD e2e + DEPLOYMENT.md env matrix"
```

- [ ] **Step 8: Final push + watch deploy**

```bash
git push origin main
gh run watch -R ForceAI-KW/digital-card     # tail latest CI run
```

Open production URL after deploy succeeds. Sign in at `/admin/login`. Verify CRUD flow on live data.

---

## Self-Review

**Spec coverage:**
- §3 Stack → Task 1 (Prisma + Neon + adapter), Task 2 (Blob), Task 4 (jose + scrypt), Task 6 (Zod)
- §4 Architecture (route map) → Tasks 3 (read paths) + 4-7 (admin routes)
- §5 Schema → Task 1, §5.1 enum naming caution explicitly addressed
- §6 Auth → Task 4 (all login/logout/middleware/rate-limit + tests)
- §7 Photo upload → Task 7 (route + dropzone + Blob put/del)
- §8 Server actions → Tasks 6 + 7 (create/update/delete/upload)
- §9 Read path migration → Task 3 (every file in the spec's modified-files list is covered)
- §10 Seed migration → Task 2
- §11 UI direction → Tasks 5 (list) + 6 (form) — Nardo Lux palette throughout
- §12 Standing-policy compliance →
  - rule 1 (deps) Task 1 (`npm audit`)
  - rule 2 (security) Tasks 3 (CSP update) + 6 (Zod validation) + 4 (cookie flags)
  - rule 9 (GDPR) Task 6 (deleteCardAction hard-deletes row + photo)
  - rule 10 (audit) Task 8
  - rule 13 (preview isolation) Task 8
- §13 Env vars → Task 10 (DEPLOYMENT.md matrix)
- §14 Routes → all in Tasks 3-7
- §15 Build phases → Tasks 1-10 (one phase ≈ one task)
- §16 Testing → Task 4 (auth unit), Task 6 (Zod unit), Task 10 (Playwright e2e)
- §17 Edge cases → covered: oversized photo (Task 7), duplicate slug (Task 6 P2002), only card deletion (Task 3 root redirect → /admin/login fallback), session expiry (Task 4 middleware redirect with `from`), blob delete failure (Task 2 lib/blob.ts try/catch)

**Placeholder scan:** No "TBD/TODO/implement later" found in any task body. All steps include actual code or commands.

**Type consistency:**
- `Card` type: defined in `lib/types.ts` (Task 3); imported unchanged in components + tests
- Prisma `Card` model: `lib/types.ts` `fromPrisma()` is the single source-of-truth mapper; used in every read path
- Brand encoding: Prisma enum `force_ai`/`force_media` (underscored) ↔ public type `'force-ai'`/`'force-media'` (hyphenated). Handled in `fromPrisma()` (read), seed script (Task 2), create action (Task 6 step 7), update action (Task 6 step 8). Consistent.
- `CardInput` Zod type (Task 6) matches the `Card` shape minus `slug` regex narrowing
- `loginAction` State / `createCardAction` State / `updateCardAction` State all share `{ ok?, error?, fieldErrors? }` shape
- `requireAdmin()` defined Task 7 step 1, used Task 7 step 2 (photo upload route)
- `verifySession`/`signSession` defined Task 4 step 4, used in Task 4 middleware + login action

No inconsistencies found.
