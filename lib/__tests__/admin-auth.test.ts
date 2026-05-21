// @vitest-environment node
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
  it('handles empty password against valid hash', async () => {
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
  it('rejects empty/undefined tokens', async () => {
    expect(await verifySession('')).toBe(false);
    expect(await verifySession(undefined as never)).toBe(false);
  });
});
