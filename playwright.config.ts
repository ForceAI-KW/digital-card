import { defineConfig } from '@playwright/test';
import { config as dotenv } from 'dotenv';

dotenv({ path: '.env.local' });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  webServer: {
    command: 'npm run build && npm run start -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DIRECT_URL: process.env.DIRECT_URL ?? '',
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH ?? '',
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET ?? '',
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? '',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3001',
    },
  },
  use: {
    baseURL: 'http://localhost:3001',
    // Give server actions and Neon queries room to breathe in CI
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  timeout: 90_000,
});
