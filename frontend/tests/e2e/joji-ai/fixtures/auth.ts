import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

/**
 * Extended test fixture that performs login once per worker and stores the
 * auth token in localStorage so every test starts already authenticated.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Check if we already have a token via localStorage (storageState would be
    // cleaner but requires a setup project — this inline approach keeps setup simple)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('auth_token'));

    if (!isLoggedIn) {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_USERNAME, ADMIN_PASSWORD);
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
