'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword, signSession } from '@/lib/admin-auth';
import { check as rateCheck } from '@/lib/rate-limit';

type State = { error?: string };

export async function loginAction(_prev: State, fd: FormData): Promise<State> {
  // x-forwarded-for: on Vercel, the first value is the true client IP (Vercel
  // strips untrusted forwarded headers at the edge). Safe to use as rate-limit key.
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
  // Use secure cookies only when running on HTTPS.
  // NEXT_PUBLIC_SITE_URL is inlined at build time and unavailable at runtime in server actions.
  // Use SITE_URL (server-only, set to https://... in prod, http://localhost:3001 in e2e).
  const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const secure = process.env.NODE_ENV === 'production' && siteUrl.startsWith('https://');
  (await cookies()).set('admin_session', token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  // Sanitize redirect target: must be same-origin absolute path (starts with / but not //)
  const raw = (fd.get('from') ?? '').toString();
  const from = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin';
  redirect(from);
}
