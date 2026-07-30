import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  webServer: { command: 'pnpm --filter @rems/web start', port: 3000, reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:3000' },
});
