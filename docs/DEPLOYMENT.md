# Deployment

## Vercel (Hobby plan)
1. Verify git author email for this repo:
   ```
   git config user.email
   git log -1 --pretty=fuller
   ```
   Vercel Hobby rejects deploys whose HEAD author email isn't the owner's (`ahmed0montaser@gmail.com`).
2. Vercel dashboard → "Import Project" → select the GitHub repo.
3. Framework preset: Next.js. No build overrides.
4. Environment variables:
   - Production: `NEXT_PUBLIC_SITE_URL=https://<your-domain>`
   - Preview: leave `NEXT_PUBLIC_SITE_URL` blank or set to staging URL (rule 13: must differ from production)
5. Add custom domain in Vercel → Domains. Follow DNS instructions.
6. After first deploy:
   - UptimeRobot monitor on `https://<your-domain>/ahmad` (rule 6)
   - Telegram channel for P0 alerts

## Post-launch checks
- [ ] `/robots.txt` returns allow-all
- [ ] `/sitemap.xml` lists every slug
- [ ] `/ahmad/contact.vcf` downloads → "Add to Contacts" works on iOS Safari
- [ ] `/ahmad/contact.vcf` likewise on Android Chrome
- [ ] Locale toggle flips `<html dir>` ltr ↔ rtl
- [ ] Lighthouse mobile ≥99 on all four axes
- [ ] `curl -sI https://<domain>/ahmad` shows CSP + HSTS headers
