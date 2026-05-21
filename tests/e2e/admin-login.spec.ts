import { test, expect } from '@playwright/test';

test('login: redirects to /admin/login when unauthenticated', async ({ page }) => {
  await page.goto('/admin');
  expect(page.url()).toContain('/admin/login');
});

test('login: wrong password shows error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[name=password]', 'definitely-wrong');
  await page.click('button[type=submit]');
  // The form action returns an error string; either "Invalid password." or
  // "Server not configured" (if ADMIN_PASSWORD_HASH env missing) or rate-limit msg.
  // The <p> error element appears regardless — just check it's visible.
  await expect(page.locator('form p[style*="b00020"]')).toBeVisible({ timeout: 20_000 });
});

test('login: correct password sets cookie and reaches /admin', async ({ page }) => {
  const pw = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  test.skip(!pw, 'set PLAYWRIGHT_ADMIN_PASSWORD to run this');
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[name=password]', pw!);
  await page.click('button[type=submit]');
  // Must navigate to /admin exactly (not /admin/login — which also matches /admin)
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  // The admin page loads cards from Neon — wait for the heading directly
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible({ timeout: 30_000 });
});
