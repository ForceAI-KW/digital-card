import { test, expect } from '@playwright/test';

const PW = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const PHOTO = process.env.PLAYWRIGHT_SEED_PHOTO_URL ?? 'https://example.invalid/p.jpg';

async function signIn(page: import('@playwright/test').Page) {
  if (!PW) throw new Error('PLAYWRIGHT_ADMIN_PASSWORD env required');
  await page.goto('/admin/login');
  await page.fill('input[name=password]', PW);
  await Promise.all([
    page.waitForURL(/\/admin\b/, { timeout: 15_000 }),
    page.click('button[type=submit]'),
  ]);
  // Wait for admin page to fully load (it queries Neon for card list)
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
}

test('CRUD: create → edit → delete', async ({ page }) => {
  test.skip(!PW, 'set PLAYWRIGHT_ADMIN_PASSWORD to run this');

  await signIn(page);

  // create
  await page.goto('/admin/cards/new');
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await page.fill('input[name=slug]', 'qa-test');
  await page.fill('input[name=enName]', 'QA Test');
  await page.fill('input[name=enTitle]', 'Tester');
  await page.fill('input[name=arName]', 'اختبار');
  await page.fill('input[name=arTitle]', 'مختبر');
  // The PhotoDropzone writes to a hidden input named "photoUrl" — bypass the upload flow
  // by injecting the value directly (Playwright can set hidden inputs via locator + page.evaluate).
  await page.evaluate(
    (url: string) => {
      const el = document.querySelector('input[name="photoUrl"]') as HTMLInputElement | null;
      if (el) el.value = url;
    },
    PHOTO
  );
  await page.fill('input[name=emails]', 'qa@example.com');
  await Promise.all([
    page.waitForURL(/\/admin(\?status=created)?$/, { timeout: 20_000 }),
    page.click('button[type=submit]'),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.getByText('QA Test')).toBeVisible({ timeout: 10_000 });

  // edit
  await page.getByRole('row', { name: /qa-test/i }).getByRole('link', { name: 'Edit' }).click();
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await page.fill('input[name=enTitle]', 'Senior Tester');
  await Promise.all([
    page.waitForURL(/\/admin(\?status=saved)?$/, { timeout: 20_000 }),
    page.click('button[type=submit]'),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  // delete
  await page.getByRole('row', { name: /qa-test/i }).getByRole('link', { name: 'Edit' }).click();
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await page.click('text=Delete');
  await page.click('text=Confirm delete');
  await page.waitForURL(/\/admin(\?status=deleted)?$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await expect(page.getByText('qa-test')).not.toBeVisible();
});
