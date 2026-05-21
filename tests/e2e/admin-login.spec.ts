import { test, expect } from '@playwright/test';

test('login: redirects to /admin/login when unauthenticated', async ({ page }) => {
  await page.goto('/admin');
  expect(page.url()).toContain('/admin/login');
});

test('login: wrong password shows error', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name=password]', 'definitely-wrong');
  // Wait for the server action response (may take a moment in production mode)
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/admin/login') && resp.status() === 200),
    page.click('button[type=submit]'),
  ]);
  await expect(page.getByText(/invalid password/i)).toBeVisible({ timeout: 15_000 });
});

test('login: correct password sets cookie and reaches /admin', async ({ page }) => {
  const pw = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  test.skip(!pw, 'set PLAYWRIGHT_ADMIN_PASSWORD to run this');
  await page.goto('/admin/login');
  await page.fill('input[name=password]', pw!);
  await Promise.all([
    page.waitForURL(/\/admin\b/, { timeout: 15_000 }),
    page.click('button[type=submit]'),
  ]);
  // The admin page loads cards from Neon — wait for network to settle
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible({ timeout: 10_000 });
});
