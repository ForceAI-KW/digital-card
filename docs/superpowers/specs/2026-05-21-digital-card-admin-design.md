# Digital Card — Admin Panel (v2) Design Spec

**Date:** 2026-05-21
**Owner:** Ahmad Sharaf
**Status:** Approved (brief approved 2026-05-21) — spec doc ready for plan write-up.
**v1 reference:** `docs/superpowers/specs/2026-05-21-digital-card-design.md`

---

## 1. Goal

Add a web-based admin panel to the digital-card project so cards can be created, edited, and deleted from a browser instead of editing `data/cards/*.ts` files and pushing. Single admin (Ahmad only — no team accounts, no Google/Apple sign-in, no email magic links).

## 2. Non-goals (v2)

- Multi-user accounts. Single shared admin password.
- OAuth sign-in (Google/Apple). Explicitly skipped per Ahmad.
- Email magic link / password reset flow. Single env-stored password.
- 2FA.
- Audit log of admin actions.
- Bulk import/export.
- Per-field locking, drafts, scheduled publishing.

## 3. Stack

Building on the v1 stack:
- **Prisma 7** ORM (matches Om Hassan + FWB; `prisma.config.ts` + `@prisma/adapter-pg`; postinstall generates client)
- **Neon Postgres** — separate **prod** + **preview** branches per rule 13
- **Vercel Blob** for photo uploads (matches Om Hassan)
- **scrypt + JWT** auth (matches Om Hassan; bcrypt has the dotenv-expand trap)
- **Zod** validation at every server-action boundary
- **Next.js 16 server actions** + `revalidatePath` for write paths
- **`@neondatabase/serverless`** Edge-compatible driver via Prisma adapter

## 4. Architecture

```
PUBLIC                                    ADMIN
  /                  → redirect              /admin/login            login form
  /[slug]            ← Card (DB)             /admin                  card list
  /[slug]/contact.vcf← Card (DB)             /admin/cards/new        create form
  /[slug]/og-image   ← Card (DB)             /admin/cards/[id]       edit form + delete
  /sitemap.xml       ← cards (DB)            /admin/logout           POST clear cookie
  /robots.txt
```

Public routes stay SSG via `generateStaticParams()` over `prisma.card.findMany({select:{slug:true}})`. ISR triggered by `revalidatePath('/${slug}')` on every admin save/delete. Sitemap also revalidates on card add/remove.

Admin routes are **server components** wrapped by a `middleware.ts` JWT verifier. Server actions handle every mutation — no JSON API surface to defend.

## 5. Data model (Prisma schema)

Flat columns, no JSON nests. Matches v1 `Card` interface 1:1.

```prisma
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
  photoUrl      String              // Vercel Blob URL
  phone         String?
  phoneDisplay  String?
  whatsapp      String?
  emails        String[]            // Postgres TEXT[]
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

enum Template { lux force }
enum Brand    { force_ai force_media }
enum Locale   { en ar }
```

> **Postgres enum naming caution** (per `feedback-prisma-enum-pascalcase-trap`): Prisma creates enum types as PascalCase `"Template"`, `"Brand"`, `"Locale"`. Hand-written `ALTER TYPE` migrations must use the same names.

## 6. Auth

### Storage
- **`ADMIN_PASSWORD_HASH`** — scrypt hash in format `<saltHex>:<hashHex>` (matches Om Hassan helper)
- **`ADMIN_JWT_SECRET`** — 32+ bytes random, base64
- Both stored in Vercel env. Production env only — no Preview password (preview deploys are 401 by Vercel SSO Protection default; no public admin path).

### Login flow
1. `POST /admin/login` server action — form data `{ password }`
2. Rate limit: 5 attempts per IP per 15 min (in-memory LRU; auth-only path; not the global limiter)
3. Verify scrypt
4. On success: sign JWT (`{ adm: true, iat, exp }`, 8h expiry) → set cookie `admin_session` httpOnly + Secure + SameSite=Strict + Path=/admin
5. Redirect to `/admin`

### Logout
`POST /admin/logout` → `cookies().delete('admin_session')` → redirect `/admin/login`.

### Middleware
`middleware.ts` matches `/admin/*` (excluding `/admin/login`):
1. Read `admin_session` cookie
2. Verify JWT signature + exp via `jose`
3. If invalid → `NextResponse.redirect('/admin/login?from=...')`

### Library file `lib/admin-auth.ts`
- `hashPassword(plain) → scryptHash` (CLI helper for first-time hash generation)
- `verifyPassword(plain, stored) → boolean`
- `signSession() → string` (signs JWT)
- `verifySession(token) → boolean`

## 7. Photo upload

- Admin form file input (single image, max 5MB, JPEG/PNG/WebP only)
- Server action validates MIME + size via Zod
- `@vercel/blob.put('photos/<slug>-<random>.jpg', file, { access: 'public', addRandomSuffix: false })` returns `{ url }`
- On edit: delete the OLD blob via `blob.del(oldUrl)` after successful upload to avoid orphans
- Photo URL stored in `Card.photoUrl`
- vCard PHOTO line: `fetch(card.photoUrl)` server-side at build/request → base64 encode → embed
- Public card `<Image>` component takes `card.photoUrl` (allowed via `next.config.ts` `images.remotePatterns` for `*.public.blob.vercel-storage.com`)

## 8. Server actions (write paths)

All inputs Zod-validated. All on success → `revalidatePath('/${slug}')` + `revalidatePath('/sitemap.xml')`.

```ts
'use server';

createCard(input: CardCreateInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }>
updateCard(id: string, input: CardUpdateInput): Promise<{ ok: true } | { ok: false; error: string }>
deleteCard(id: string): Promise<{ ok: true } | { ok: false; error: string }>
uploadPhoto(slug: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }>
```

Each action verifies the admin JWT before doing work. Auth check helper: `await requireAdmin()` throws on missing/invalid session — caught by Next's error boundary → redirect to /admin/login.

## 9. Read path migration

Files affected:
- `app/[slug]/page.tsx` — `getCard(slug)` → `prisma.card.findUnique({ where: { slug } })`
- `app/[slug]/contact.vcf/route.ts` — same
- `app/[slug]/opengraph-image.tsx` — same
- `app/sitemap.ts` — `listCardSlugs()` → `prisma.card.findMany({ select: { slug: true, updatedAt: true } })`
- `components/JsonLd.tsx` — already takes `card` prop; no change needed
- Public templates `components/templates/{NardoLux,ForceBrand}.tsx` — already prop-driven; only `card.photoUrl` instead of `card.photo`

`data/cards/*.ts` files **deleted** after seed migration. Type definitions move from `data/cards/_types.ts` → `lib/types.ts` (kept; Prisma-generated types alongside).

## 10. Seed migration

One-shot script `scripts/seed-from-files.ts`:
1. Reads `ahmad.ts` + `ahmad-fm.ts`
2. Uploads `public/photos/ahmad.jpg` to Vercel Blob (once, both cards share)
3. Inserts 2 rows
4. Logs the resulting card IDs

Run via `tsx scripts/seed-from-files.ts`. Idempotent — uses `upsert` on slug. After verifying both cards render, delete the `data/cards/*.ts` files.

## 11. UI direction

Admin uses the **Nardo Lux aesthetic** (white background, Nardo grey, black, full-pill buttons, Inter type) — same brand language as the public site. Lives at `/admin/*`. Mobile-first responsive.

- **`/admin`** — table of cards (slug, name, template, brand, photo thumbnail, "Edit" + "Delete" + "Preview" buttons). Header has "+ New card" button.
- **`/admin/cards/new`** + **`/admin/cards/[id]`** — single form, all fields, photo dropzone. Submit + Cancel. On `[id]` page, additional Delete confirmation modal.
- **`/admin/login`** — minimal: logo, password input, "Sign in" button, no signup link.
- Validation errors appear inline next to each field (Zod issues mapped to field paths).
- Save action shows "Saved ✓" toast for 2s, stays on edit page.

## 12. Standing-policy compliance (delta from v1)

| Rule | v1 status | v2 update |
|---|---|---|
| 1 deps | 0 vulns | Stays. New deps: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `@neondatabase/serverless`, `@vercel/blob`, `jose`, `zod`. All MIT, all maintained. `npm audit` gate confirms. |
| 2 security | CSP + headers | Same headers. Zod validation at every server-action boundary. CSP unchanged (server actions go through same-origin POST, no new whitelisted domains). |
| 3 scaling | Pure SSG | SSG + ISR. Neon serverless driver = no connection pool exhaustion. |
| 5 consent | No trackers | Stays. Admin panel has no analytics. |
| 6 alerting | UptimeRobot | Add: alert on `/admin/login` rate-limit triggers (auth abuse signal). |
| 9 GDPR | N/A | Admin can hard-delete any card; deleting Card row + Blob is the erasure path. |
| 10 audit gate | `npm audit` CI | Stays. |
| 13 preview-API isolation | N/A (no API) | **Required now**: CI step asserts Vercel Preview `DATABASE_URL` ≠ Production. Pre-merge fail if equal. |
| Rollback bundle | Vercel + content tar | Add: `.github/workflows/neon-snapshot.yml` per-commit `prod-<sha>` branches (rule from `feedback-rollback-recipe`). |

## 13. Environment variables (new in v2)

| Name | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | prod + preview (DIFFERENT VALUES) | Neon prod branch vs preview branch — rule 13 gate enforces inequality |
| `DIRECT_URL` | prod + preview | Direct (non-pooled) connection for migrations |
| `ADMIN_PASSWORD_HASH` | prod only | `<saltHex>:<hashHex>` scrypt format |
| `ADMIN_JWT_SECRET` | prod only | 32 bytes base64 |
| `BLOB_READ_WRITE_TOKEN` | prod + preview | Vercel Blob token (auto-injected by Vercel Blob integration) |
| `NEON_API_KEY` | repo secret | For per-commit snapshot workflow |
| `NEON_PROJECT_ID` | repo secret | Same |

## 14. Routes (full list after v2)

| Route | Method | Auth | Render |
|---|---|---|---|
| `/` | GET | public | static redirect → `/<first slug>` (or `/ahmad`) |
| `/[slug]` | GET | public | SSG + ISR (Card from DB) |
| `/[slug]/contact.vcf` | GET | public | SSG + ISR (vCard from DB) |
| `/[slug]/opengraph-image` | GET | public | SSG (OG image from DB) |
| `/sitemap.xml` | GET | public | dynamic (cards from DB) |
| `/robots.txt` | GET | public | static |
| `/admin/login` | GET | public | server form |
| `/admin/login` | POST (action) | rate-limited | sets cookie, redirects |
| `/admin/logout` | POST (action) | admin-only | clears cookie |
| `/admin` | GET | admin-only | server, lists cards |
| `/admin/cards/new` | GET | admin-only | server, form |
| `/admin/cards/[id]` | GET | admin-only | server, form |
| (server actions: createCard/updateCard/deleteCard/uploadPhoto) | POST | admin-only | revalidatePath |

## 15. Build phases (one commit batch each)

1. **Schema + Neon** — create prod + preview branches via Neon CLI; Prisma init; schema; `prisma.config.ts`; `@prisma/adapter-pg`; postinstall generate; `prisma migrate dev --name init`.
2. **Seed migration** — `scripts/seed-from-files.ts` + first run; verify 2 cards in DB; upload existing photo to Blob.
3. **Read-path swap** — point page/vcard/sitemap/og at Prisma; delete `data/cards/*.ts`; smoke test public side still works.
4. **Auth lib + middleware** — `lib/admin-auth.ts`; `middleware.ts`; `/admin/login` page + login action; rate limiter; first-time `hashPassword` CLI helper.
5. **Admin list + form** — `/admin` table; `/admin/cards/new`; `/admin/cards/[id]`; createCard / updateCard / deleteCard server actions; Zod schemas in `lib/admin-schemas.ts`.
6. **Photo upload** — Blob put/del; `next.config.ts` `images.remotePatterns`; vCard PHOTO line switches to fetch(blob URL) + base64.
7. **Rule 13 CI gate** — `.github/workflows/ci.yml` adds step comparing Vercel Preview `DATABASE_URL` vs Production via `vercel env ls --json`.
8. **Neon snapshot workflow** — `.github/workflows/neon-snapshot.yml` per-commit `prod-<sha>` branches; update `docs/ROLLBACK.md` with the Neon-restore path.
9. **Tests + e2e** — Playwright admin smoke (login → list → edit → delete); Vitest for `lib/admin-auth.ts` (scrypt round-trip; JWT verify) + Zod schemas.

## 16. Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest + RTL | scrypt hash+verify, JWT sign+verify, Zod schemas, vCard builder unchanged, JsonLd builder unchanged |
| E2e — public | Playwright | All v1 e2e (lux + force + locale + 404 + vcard) still pass |
| E2e — admin | Playwright | Login (bad password → error); login (good) → list → create → edit → delete → preview link works |
| Security | manual | Verify all 6 headers still set; verify CSRF protection (server actions auto-protected by Next 16); verify session cookie attrs (httpOnly + Secure + SameSite=Strict) |

## 17. Edge cases

- Admin uploads a 6MB photo → server action rejects with "max 5MB"; UI shows error inline.
- Admin enters duplicate slug → Prisma unique constraint → server action returns `{ ok: false, error: 'slug exists' }`; UI shows field error.
- Admin deletes the only card → public root redirect (`/` → `/ahmad`) breaks. Fix: redirect to the FIRST card if any, otherwise show "no cards" placeholder at `/`.
- Admin logs in but session expires mid-edit → middleware redirects to `/admin/login?from=/admin/cards/xxx`; on re-login, redirect back.
- Blob URL becomes invalid (token revoked) → public page shows the silhouette fallback per v1 Photo component; rebuild needs new BLOB_READ_WRITE_TOKEN.
- Neon prod connection fails during admin save → server action returns `{ ok: false, error: 'database unavailable' }`; UI shows error toast; no partial state.

## 18. Out-of-scope items moved to v3

- Email magic-link auth (eliminates the env-password rotation requirement)
- Multi-user team accounts
- Audit log
- Per-card view counts (would need analytics + DB writes per view)
- Bulk import / CSV upload
- Card draft state with publish toggle
- A/B testing different layouts

## 19. Open items

- `ADMIN_PASSWORD_HASH` initial value: Ahmad picks a password; the build phase 4 includes a `hashPassword` CLI helper. He runs it once locally, sets the Vercel env, never stores plaintext anywhere.
- Custom domain still TBD (independent of v2; affects nothing in the admin path).
- UptimeRobot setup still TBD.
