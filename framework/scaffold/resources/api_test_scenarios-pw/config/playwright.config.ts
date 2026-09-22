import { defineConfig } from '@playwright/test';

const environment = JSON.parse(process.env.AIPROD_PW_ENV_JSON ?? '{}') as {
  base_url?: string;
  web_base_url?: string;
};

export default defineConfig({
  testDir: process.env.AIPROD_PW_PROJECT_ROOT,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR, open: 'never' }],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE }],
  ],
  use: {
    baseURL: environment.web_base_url ?? environment.base_url,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'api', testMatch: /\.api\.spec\.ts$/ },
    { name: 'chromium', testIgnore: /\.api\.spec\.ts$/, use: { browserName: 'chromium' } },
  ],
});
