import { test, expect } from '@playwright/test';

test('vCard download returns text/vcard with attachment disposition', async ({ request }) => {
  const res = await request.get('/ahmad/contact.vcf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/vcard');
  expect(res.headers()['content-disposition']).toContain('attachment');
  expect(res.headers()['content-disposition']).toContain('ahmad.vcf');
  const body = await res.text();
  expect(body).toContain('BEGIN:VCARD');
  expect(body).toContain('VERSION:3.0');
  expect(body).toContain('FN:Ahmad Sharaf');
  expect(body).toContain('TEL;TYPE=CELL,VOICE:+96541169141');
  expect(body).toContain('END:VCARD');
});

test('vCard 404 for unknown slug', async ({ request }) => {
  const res = await request.get('/no-such-slug/contact.vcf');
  expect(res.status()).toBe(404);
});
