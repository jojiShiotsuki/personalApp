import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[placeholder="Enter your username"]');
    this.passwordInput = page.locator('input[placeholder="Enter your password"]');
    this.submitButton = page.locator('button[type="submit"]').first();
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // Wait for redirect away from /login
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  }
}
