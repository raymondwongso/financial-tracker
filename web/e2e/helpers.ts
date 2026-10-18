import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct-horse-battery';

/** Registers a brand-new user through the UI and waits for the chat page. */
export async function registerNewUser(page: Page, name = 'E2E Tester'): Promise<string> {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  return email;
}

/** Sends a chat message through the UI and waits for the assistant's reply. */
export async function sendChat(page: Page, message: string): Promise<void> {
  const replies = page.getByTestId('assistant-message');
  const before = await replies.count();
  await page.getByLabel('Message').fill(message);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(replies).toHaveCount(before + 1);
}

export const pane = (page: Page) => page.getByRole('complementary', { name: 'Items in this chat' });
export const conversation = (page: Page) => page.getByRole('log', { name: 'Conversation' });
export const today = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => new Date().toISOString().slice(0, 7);
