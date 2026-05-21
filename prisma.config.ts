import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx scripts/seed-from-files.ts',
  },
  datasource: {
    // DIRECT_URL is used here so Prisma Migrate uses the non-pooled connection.
    // At runtime, PrismaClient receives DATABASE_URL (pooled) via the adapter in lib/prisma.ts.
    // Fallback keeps `prisma generate --no-engine` working in CI where no real DB is needed.
    url: process.env.DIRECT_URL ?? 'postgresql://ci:ci@localhost/ci',
  },
});
