# Digital Card

Personal + team digital business cards. Bilingual AR/EN. Two visual templates (Nardo Lux · Force Brand). Static Next.js 16.

## Development
```
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests
npm run test:e2e     # Playwright smoke
npm run build        # static export verification
```

## Adding a card
1. Add `data/cards/<slug>.ts` exporting a `Card` record.
2. Register it in `data/cards/index.ts`.
3. Drop photo at `public/photos/<slug>.jpg` (≥256px square, <100 KB).
4. Commit + push; Vercel rebuilds.

## Templates
- `lux` — Nardo Lux (white/black/Nardo grey, Bodoni Moda italic name, full-pill buttons)
- `force` — Force Brand (wine/orange/cream, Inter, wordmark swap via `brand: 'force-ai' | 'force-media'`)

## Rollback
See `docs/ROLLBACK.md`. Three paths: Vercel-instant · `./scripts/rollback.sh` · content backup.

## License
UNLICENSED — proprietary.
