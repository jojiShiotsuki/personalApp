import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the floating ChatPanel component.
 * Rendered on all routes EXCEPT /ai, as a fixed-position overlay.
 *
 * DOM structure derived from ChatPanel.tsx source reading.
 */
export class ChatPanelPage {
  readonly page: Page;

  // Floating button (closed state)
  readonly floatingButton: Locator;

  // Panel elements (open state)
  readonly panel: Locator;
  readonly panelHeader: Locator;
  readonly fullViewButton: Locator;
  readonly closeButton: Locator;
  readonly chatInput: Locator;

  constructor(page: Page) {
    this.page = page;

    // The floating button is a fixed-position circle with Brain icon and title "Open Joji AI"
    this.floatingButton = page.locator('button[title="Open Joji AI"]');

    // The open panel is a fixed-position div containing the "Joji AI" heading
    this.panel = page.locator('[class*="fixed"][class*="bottom-6"][class*="right-6"][class*="flex-col"]');

    this.panelHeader = page.locator('span').filter({ hasText: /^Joji AI$/ }).first();
    this.fullViewButton = page.locator('button[title="Open full view"]');
    this.closeButton = page.locator('button[title="Close chat"]');
    this.chatInput = page.locator('textarea[placeholder*="Ask Joji"]');
  }

  async openPanel() {
    await expect(this.floatingButton).toBeVisible({ timeout: 10000 });
    await this.floatingButton.click();
    await expect(this.panel).toBeVisible({ timeout: 5000 });
  }

  async closePanel() {
    await this.closeButton.click();
    await expect(this.floatingButton).toBeVisible({ timeout: 5000 });
  }

  async navigateToFullView() {
    await this.fullViewButton.click();
    await this.page.waitForURL('**/ai', { timeout: 10000 });
  }
}
