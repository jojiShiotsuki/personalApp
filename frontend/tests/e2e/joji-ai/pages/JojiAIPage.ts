import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Joji AI full-page view (/ai route).
 *
 * DOM structure derived from JojiAI.tsx, ConversationSidebar.tsx,
 * and AISettingsPanel.tsx source reading.
 */
export class JojiAIPage {
  readonly page: Page;

  // --- Sidebar ---
  readonly newChatButton: Locator;
  readonly settingsButton: Locator;
  readonly conversationList: Locator;

  // --- Chat area ---
  readonly chatInput: Locator;
  readonly sendButton: Locator;
  readonly emptyStateHeading: Locator;
  readonly messagesArea: Locator;

  // --- Settings panel ---
  readonly settingsHeading: Locator;
  readonly repoUrlInput: Locator;
  readonly githubTokenInput: Locator;
  readonly backToConversationsButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar elements
    this.newChatButton = page.getByRole('button', { name: /new chat/i });
    this.settingsButton = page.getByRole('button', { name: /settings/i }).first();
    this.conversationList = page.locator('[class*="flex-1"][class*="overflow-y-auto"]').first();

    // Chat area elements — textarea has placeholder "Ask Joji AI..."
    this.chatInput = page.locator('textarea[placeholder*="Ask Joji AI"]');
    this.sendButton = page.locator('button[title="Send message"], button:has(svg[data-lucide="send"])').first();
    // Exact text "Joji AI" only (not "Joji AI Settings")
    this.emptyStateHeading = page.getByRole('heading', { name: 'Joji AI', exact: true });
    this.messagesArea = page.locator('.space-y-4').first();

    // Settings panel — exact text "Joji AI Settings"
    this.settingsHeading = page.getByRole('heading', { name: 'Joji AI Settings', exact: true });
    this.repoUrlInput = page.locator('input[placeholder*="github.com"]');
    this.githubTokenInput = page.locator('input[type="password"]').first();
    this.backToConversationsButton = page.getByRole('button', { name: /back to conversations/i });
  }

  async goto() {
    await this.page.goto('/ai');
    await this.page.waitForLoadState('networkidle');
  }

  /** Returns all conversation items visible in the sidebar */
  getConversationItems() {
    // Sidebar conversation items have MessageSquare icon + truncated text span
    return this.page.locator('div[class*="group"][class*="flex"][class*="items-center"][class*="cursor-pointer"]');
  }

  /** Returns the conversation item matching the given title substring */
  getConversationByTitle(titleSubstring: string) {
    return this.page.locator('div[class*="group"][class*="cursor-pointer"]').filter({ hasText: titleSubstring });
  }

  /** Returns the delete button for a specific conversation row */
  getDeleteButtonForConversation(conversationLocator: Locator) {
    return conversationLocator.locator('button[title="Delete conversation"]');
  }

  /**
   * Sends a message by typing into the textarea and pressing Enter.
   * Does NOT wait for the AI response — use waitForAIResponse() separately.
   */
  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.chatInput.press('Enter');
  }

  /**
   * Waits until the streaming indicator disappears and at least one
   * assistant message has appeared in the messages list.
   */
  async waitForAIResponse(timeoutMs = 30000) {
    // Wait for the loading/streaming indicator to go away
    await this.page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('[class*="animate-spin"], [class*="animate-pulse"]');
        return spinners.length === 0;
      },
      { timeout: timeoutMs }
    );
    // Also wait for at least two messages (user + assistant)
    await expect(this.page.locator('[class*="space-y-4"] > *').nth(1)).toBeVisible({ timeout: timeoutMs });
  }

  async openSettings() {
    await this.settingsButton.click();
    await expect(this.settingsHeading).toBeVisible({ timeout: 5000 });
  }

  async closeSettings() {
    await this.backToConversationsButton.click();
    await expect(this.newChatButton).toBeVisible({ timeout: 5000 });
  }
}
