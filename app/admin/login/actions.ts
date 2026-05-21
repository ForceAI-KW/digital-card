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
