import { defineConfig, devices } from '@playwright/test'

/**
 * Наскрізні тести працюють із запущеним застосунком (бекенд віддає зібраний фронтенд)
 * і демонстраційними даними. Адреса — E2E_BASE_URL (типово http://localhost:8080).
 * Якщо браузери Playwright не встановлені, можна вказати шлях до Chrome у CHROME_PATH.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
})
