import { expect, test } from '@playwright/test';
import { registerNewUser, sendChat } from './helpers';

test.describe('dashboard, accounts and transactions', () => {
  test.beforeEach(async ({ page }) => {
    await registerNewUser(page);
  });

  test('sidebar puts Chat first and navigates between pages', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveText([
      'Chat',
      'Dashboard',
      'Accounts',
      'Transactions',
    ]);
    await expect(nav.getByRole('link', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Accounts' }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(nav.getByRole('link', { name: 'Accounts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('creates an account and records a transaction with a running balance', async ({ page }) => {
    await page.goto('/accounts');
    await expect(page.getByText('No accounts yet')).toBeVisible();
    await page.getByLabel('Name').fill('Savings');
    await page.getByLabel('Type').selectOption('bank');
    await page.getByLabel('Currency').fill('eur');
    await page.getByRole('button', { name: 'Create account' }).click();
    const card = page.getByTestId('account-card').filter({ hasText: 'Savings' });
    await expect(card).toContainText('€0.00');

    await card.click();
    await expect(page).toHaveURL(/\/transactions\?accountId=/);
    await expect(page.getByRole('heading', { name: 'Savings' })).toBeVisible();

    const typeToggle = page.getByRole('group', { name: 'Transaction type' });
    await typeToggle.getByText('Income').click();
    await page.getByLabel('Amount (EUR)').fill('1000');
    await page.getByLabel('Category').fill('Salary');
    await page.getByRole('button', { name: 'Save transaction' }).click();
    await expect(page.getByRole('row', { name: /Salary.*\+€1,000\.00.*€1,000\.00/ })).toBeVisible();

    await page.getByLabel('Amount (EUR)').fill('25.5');
    await page.getByLabel('Category').fill('Groceries');
    await typeToggle.getByText('Expense').click();
    await page.getByRole('button', { name: 'Save transaction' }).click();
    await expect(page.getByRole('row', { name: /Groceries.*−€25\.50.*€974\.50/ })).toBeVisible();
    await expect(page.getByTestId('account-balance')).toHaveText('€974.50');
  });

  test('stores and shows rupiah amounts consistently from the form and the chat', async ({
    page,
  }) => {
    await sendChat(page, 'Create a bank account called BCA in IDR');
    await sendChat(page, 'got paid 50000 into BCA');
    await expect(
      page
        .getByTestId('assistant-message')
        .last()
        .getByRole('button', { name: /\+Rp\s50,000/ }),
    ).toBeVisible();

    await page.goto('/accounts');
    await page.getByTestId('account-card').filter({ hasText: 'BCA' }).click();
    await page.getByLabel('Amount (IDR)').fill('50000');
    await page.getByLabel('Category').fill('Salary');
    await page.getByRole('group', { name: 'Transaction type' }).getByText('Income').click();
    await page.getByRole('button', { name: 'Save transaction' }).click();
    await expect(
      page.getByRole('row', { name: /Salary.*\+Rp\s50,000.*Rp\s100,000/ }),
    ).toBeVisible();
    await expect(page.getByTestId('account-balance')).toHaveText(/^Rp\s100,000$/);
  });

  test('rejects a zero amount', async ({ page }) => {
    await sendChat(page, 'Create a cash account called Wallet in USD');
    await page.goto('/transactions');
    await page.getByLabel('Amount (USD)').fill('0');
    await page.getByLabel('Category').fill('Food');
    await page.getByRole('button', { name: 'Save transaction' }).click();
    await expect(page.getByText('Amount must be greater than zero.')).toBeVisible();
  });

  test('dashboard shows the month created through chat', async ({ page }) => {
    await sendChat(page, 'Create a cash account called Wallet in USD');
    await sendChat(page, 'got paid 5000 into Wallet');
    await sendChat(page, 'I spent 12.50 on Food from Wallet');

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Dashboard' })
      .click();
    const totals = page.getByRole('region', { name: 'Monthly totals' });
    await expect(totals).toContainText('+$5,000.00');
    await expect(totals).toContainText('−$12.50');
    await expect(totals).toContainText('+$4,987.50');
    await expect(page.getByRole('region', { name: 'Top expense categories' })).toContainText(
      'Food',
    );
    await expect(page.getByRole('table')).toContainText('Wallet');
  });
});
