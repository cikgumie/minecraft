import { defineConfig } from '@playwright/test';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath = repository ? `/${repository}/` : '/';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: `http://127.0.0.1:4173${basePath}`, browserName: 'chromium' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: `http://127.0.0.1:4173${basePath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
