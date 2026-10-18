import { expect, test } from '@playwright/test';
import { PASSWORD, registerNewUser } from './helpers';

test.describe('authentication', () => {
  test('redirects visitors without a session to the login page', async ({ page }) => {
    for (const path of ['/', '/chat', '/dashboard', '/accounts', '/transactions']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test('does not expose the API metrics through the web proxy', async ({ request }) => {
    expect((await request.get('/api/metrics')).status()).toBe(404);
    expect((await request.get('/api/health')).status()).toBe(200);
  });

  test('registers, lands on chat, logs out and logs back in', async ({ page }) => {
    const email = await registerNewUser(page, 'Ray Wong');
    await expect(page.getByRole('heading', { name: 'Chat', level: 1 })).toBeVisible();
    await expect(page.getByText('Ray Wong')).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/chat$/);
  });

  test('shows a generic error for wrong credentials', async ({ page }) => {
    const email = await registerNewUser(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    // Next.js also renders a route announcer with role=alert, so target the form's alert.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Invalid email or password.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('validates registration and rejects duplicate emails', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Name').fill('Short');
    await page.getByLabel('Email').fill('short@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    const email = await registerNewUser(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.goto('/register');
    await page.getByLabel('Name').fill('Again');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This email is already registered.')).toBeVisible();
  });
});
