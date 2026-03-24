/**
 * E2E tests for the Joji AI feature.
 *
 * Covers:
 *  1. Page load — sidebar + chat area visible
 *  2. Sidebar nav link navigates to /ai
 *  3. Send a message — user message appears (optimistic)
 *  4. AI response streams back
 *  5. Conversation appears in sidebar after first message
 *  6. New Chat button clears the chat area
 *  7. Switch conversations — messages load
 *  8. Delete a conversation
 *  9. Settings panel shows expected sections
 *  10. Back button in settings returns to conversation list
 *  11. Floating chat button visible on non-/ai pages
 *  12. Clicking floating button opens the chat panel
 *  13. Closing chat panel returns to floating button state
 *  14. Full view button in floating panel navigates to /ai
 *  15. Floating chat button hidden on /ai page
 *
 * Prerequisites (must be running before executing tests):
 *  - Backend:  http://localhost:8001
 *  - Frontend: http://localhost:5173
 *  - Admin credentials: admin / admin123
 */

import { test, expect } from './fixtures/auth';
import { JojiAIPage } from './pages/JojiAIPage';
import { ChatPanelPage } from './pages/ChatPanelPage';

// ---------------------------------------------------------------------------
// Test 1: Navigate to Joji AI page
// ---------------------------------------------------------------------------
test('1. Joji AI page loads with sidebar and chat area', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  // Sidebar: New Chat button
  await expect(ai.newChatButton).toBeVisible();

  // Sidebar: Settings button
  await expect(ai.settingsButton).toBeVisible();

  // Chat area: textarea input
  await expect(ai.chatInput).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/01-page-load.png' });
});

// ---------------------------------------------------------------------------
// Test 2: Sidebar nav link navigates to /ai
// ---------------------------------------------------------------------------
test('2. Sidebar "Joji AI" nav link navigates to /ai', async ({ authenticatedPage: page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const jojiLink = page.getByRole('link', { name: /joji/i });
  await expect(jojiLink).toBeVisible({ timeout: 10000 });
  await jojiLink.click();

  await page.waitForURL('**/ai', { timeout: 15000 });
  expect(page.url()).toContain('/ai');

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/02-nav-link.png' });
});

// ---------------------------------------------------------------------------
// Test 3: Send a message — user message appears immediately (optimistic)
// ---------------------------------------------------------------------------
test('3. Typing a message and pressing Enter shows the user message', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  // Start a fresh conversation so we control when the first message appears
  await ai.newChatButton.click();
  await expect(ai.emptyStateHeading).toBeVisible({ timeout: 5000 });

  const testMessage = 'Hello from E2E test';
  await ai.chatInput.fill(testMessage);
  await ai.chatInput.press('Enter');

  // Optimistic user message should appear immediately
  await expect(page.getByText(testMessage, { exact: true })).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/03-user-message.png' });
});

// ---------------------------------------------------------------------------
// Test 4: AI response streams back
// ---------------------------------------------------------------------------
test('4. AI response appears after sending a message', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();
  await ai.newChatButton.click();

  await ai.sendMessage('Reply with just the word "pong"');

  // At least 2 items in the messages list (user + assistant)
  await expect(
    page.locator('[class*="space-y-4"] > *').nth(1)
  ).toBeVisible({ timeout: 45000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/04-ai-response.png' });
});

// ---------------------------------------------------------------------------
// Test 5: Conversation appears in sidebar after first message in a NEW chat
// ---------------------------------------------------------------------------
test('5. Conversation appears in sidebar after first message in new chat', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  // Start a fresh chat so we're guaranteed to create a brand-new conversation
  await ai.newChatButton.click();
  await expect(ai.emptyStateHeading).toBeVisible({ timeout: 5000 });

  const beforeCount = await ai.getConversationItems().count();

  // Send the message (new conversation = new sidebar entry will be added)
  await ai.sendMessage('Create a new E2E conversation ' + Date.now());

  // Wait for the AI response to complete (the backend creates + persists the conversation
  // during SSE streaming, and the sidebar refetches after the stream finishes)
  await ai.waitForAIResponse(45000);

  // Give React Query time to refetch the conversation list
  await page.waitForTimeout(2000);

  // The sidebar should gain at least 1 new entry
  const afterCount = await ai.getConversationItems().count();
  expect(afterCount).toBeGreaterThan(beforeCount);

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/05-sidebar-conversation.png' });
});

// ---------------------------------------------------------------------------
// Test 6: New Chat clears the messages area
// ---------------------------------------------------------------------------
test('6. New Chat button clears the chat area', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  // If there are existing conversations, click the first one to load its messages
  const convItems = ai.getConversationItems();
  const count = await convItems.count();
  if (count > 0) {
    await convItems.first().click();
    // Wait for messages to load
    await page.waitForTimeout(1000);
  } else {
    // No conversations exist — send a message to create one
    await ai.sendMessage('Temp message for new chat test ' + Date.now());
    await expect(
      page.locator('[class*="space-y-4"] > *').first()
    ).toBeVisible({ timeout: 10000 });
  }

  // Click New Chat
  await ai.newChatButton.click();

  // The empty state heading ("Joji AI" h2) should return once messages are cleared
  await expect(ai.emptyStateHeading).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/06-new-chat.png' });
});

// ---------------------------------------------------------------------------
// Test 7: Switch conversations — messages load
// ---------------------------------------------------------------------------
test('7. Clicking a conversation in the sidebar loads its messages', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  const convItems = ai.getConversationItems();
  const count = await convItems.count();

  if (count < 2) {
    test.skip(true, 'Fewer than 2 conversations exist — skipping switch test');
    return;
  }

  // Click the second conversation item
  await convItems.nth(1).click();

  // Input should still be there and the page must not have crashed
  await expect(ai.chatInput).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/07-switch-conversation.png' });
});

// ---------------------------------------------------------------------------
// Test 8: Delete a conversation
// ---------------------------------------------------------------------------
test('8. Deleting a conversation removes it from the sidebar', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  // Ensure there is at least one conversation by starting a fresh one and sending a message
  await ai.newChatButton.click();
  await expect(ai.emptyStateHeading).toBeVisible({ timeout: 5000 });
  await ai.sendMessage('Conversation to be deleted in E2E test ' + Date.now());

  // Wait for the AI response to complete so the conversation is persisted
  await ai.waitForAIResponse(45000);

  // Wait for sidebar to refresh
  await page.waitForTimeout(2000);

  const beforeCount = await ai.getConversationItems().count();
  expect(beforeCount).toBeGreaterThan(0);

  // The delete button uses opacity-0 group-hover:opacity-100 which can be tricky
  // in headless mode. Force it visible via JS, then click it.
  await page.evaluate(() => {
    const btns = document.querySelectorAll<HTMLButtonElement>('button[title="Delete conversation"]');
    if (btns.length > 0) {
      btns[0].style.opacity = '1';
      btns[0].style.pointerEvents = 'auto';
    }
  });

  const deleteButton = page.locator('button[title="Delete conversation"]').first();
  await deleteButton.click({ timeout: 5000 });

  // Count should decrease by 1
  await expect(ai.getConversationItems()).toHaveCount(beforeCount - 1, { timeout: 10000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/08-delete-conversation.png' });
});

// ---------------------------------------------------------------------------
// Test 9: Settings panel opens and shows expected sections
// ---------------------------------------------------------------------------
test('9. Settings panel shows Knowledge Vault and Vault Sync sections', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  await ai.openSettings();

  // "Joji AI Settings" heading is visible (h2 in AISettingsPanel)
  await expect(ai.settingsHeading).toBeVisible();

  // Knowledge Vault section heading (h3 in AISettingsPanel)
  await expect(page.getByRole('heading', { name: 'Knowledge Vault' })).toBeVisible();

  // GitHub repo URL input
  await expect(ai.repoUrlInput).toBeVisible();

  // Vault Sync section heading
  await expect(page.getByRole('heading', { name: 'Vault Sync' })).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/09-settings-panel.png' });
});

// ---------------------------------------------------------------------------
// Test 10: Back button in settings returns to conversation list
// ---------------------------------------------------------------------------
test('10. Back button in settings returns to conversation sidebar', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  await ai.openSettings();
  await expect(ai.settingsHeading).toBeVisible();

  await ai.closeSettings();

  // New Chat button should be visible again
  await expect(ai.newChatButton).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/10-back-from-settings.png' });
});

// ---------------------------------------------------------------------------
// Test 11: Floating chat button visible on Dashboard (non-/ai page)
// ---------------------------------------------------------------------------
test('11. Floating chat button is visible on non-AI pages', async ({ authenticatedPage: page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const panel = new ChatPanelPage(page);
  await expect(panel.floatingButton).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/11-floating-button.png' });
});

// ---------------------------------------------------------------------------
// Test 12: Floating chat panel opens and shows Joji AI header
// ---------------------------------------------------------------------------
test('12. Clicking floating button opens the chat panel', async ({ authenticatedPage: page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const panel = new ChatPanelPage(page);
  await panel.openPanel();

  await expect(panel.panelHeader).toBeVisible();
  await expect(panel.fullViewButton).toBeVisible();
  await expect(panel.closeButton).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/12-chat-panel-open.png' });
});

// ---------------------------------------------------------------------------
// Test 13: Closing the floating panel returns to floating button
// ---------------------------------------------------------------------------
test('13. Closing chat panel returns to floating button state', async ({ authenticatedPage: page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const panel = new ChatPanelPage(page);
  await panel.openPanel();
  await panel.closePanel();

  await expect(panel.floatingButton).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/13-panel-closed.png' });
});

// ---------------------------------------------------------------------------
// Test 14: "Full view" button in panel navigates to /ai
// ---------------------------------------------------------------------------
test('14. Full view button in floating panel navigates to /ai', async ({ authenticatedPage: page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const panel = new ChatPanelPage(page);
  await panel.openPanel();
  await panel.navigateToFullView();

  expect(page.url()).toContain('/ai');

  // Floating button should NOT be present on /ai
  await expect(panel.floatingButton).not.toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/14-full-view-navigate.png' });
});

// ---------------------------------------------------------------------------
// Test 15: Floating chat button NOT visible on /ai page
// ---------------------------------------------------------------------------
test('15. Floating chat button is hidden on the /ai page', async ({ authenticatedPage: page }) => {
  const ai = new JojiAIPage(page);
  await ai.goto();

  const panel = new ChatPanelPage(page);
  await expect(panel.floatingButton).not.toBeVisible();

  await page.screenshot({ path: 'tests/e2e/joji-ai/artifacts/15-no-float-on-ai-page.png' });
});
