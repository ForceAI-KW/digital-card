import { test, expect } from '@playwright/test';

const PW = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const PHOTO = process.env.PLAYWRIGHT_SEED_PHOTO_URL ?? 'https://example.invalid/p.jpg';

async function signIn(page: import('@playwright/test').Page) {
  if (!PW) throw new Error('PLAYWRIGHT_ADMIN_PASSWORD env required');
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[name=password]', PW);
  // Use the SIGN IN button specifically (the admin layout also has a "Sign out" submit button)
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  // Wait for redirect to /admin and heading to appear
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible({ timeout: 30_000 });
}

test('CRUD: create → edit → delete', async ({ page }) => {
  test.skip(!PW, 'set PLAYWRIGHT_ADMIN_PASSWORD to run this');

  await signIn(page);

  // create
  await page.goto('/admin/cards/new');
  await expect(page.locator('input[name=slug]')).toBeVisible({ timeout: 20_000 });
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
  // Use the specific submit button name (layout also has a "Sign out" submit button)
  await page.getByRole('button', { name: 'CREATE' }).click();
  await expect(page).toHaveURL(/\/admin(\?status=created)?$/, { timeout: 30_000 });
  await expect(page.getByText('QA Test')).toBeVisible({ timeout: 15_000 });

  // edit
  await page.getByRole('row', { name: /qa-test/i }).getByRole('link', { name: 'Edit' }).click();
  await expect(page.locator('input[name=enTitle]')).toBeVisible({ timeout: 20_000 });
  await page.fill('input[name=enTitle]', 'Senior Tester');
  // Use the specific submit button name (layout also has a "Sign out" submit button)
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(page).toHaveURL(/\/admin(\?status=saved)?$/, { timeout: 30_000 });

  // delete
  await page.getByRole('row', { name: /qa-test/i }).getByRole('link', { name: 'Edit' }).click();
  await expect(page.locator('button:has-text("Delete")')).toBeVisible({ timeout: 20_000 });
  await page.click('button:has-text("Delete")');
  await expect(page.locator('button:has-text("Confirm delete")')).toBeVisible({ timeout: 5_000 });
  await page.click('button:has-text("Confirm delete")');
  await expect(page).toHaveURL(/\/admin(\?status=deleted)?$/, { timeout: 30_000 });
  await expect(page.getByText('qa-test')).not.toBeVisible();
});
