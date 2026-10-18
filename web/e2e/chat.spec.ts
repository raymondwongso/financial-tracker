import { expect, test } from '@playwright/test';
import { conversation, pane, registerNewUser, sendChat, thisMonth, today } from './helpers';

test.describe('chat', () => {
  test.beforeEach(async ({ page }) => {
    await registerNewUser(page);
  });

  test('shows one card per created item in the reply and in the pane', async ({ page }) => {
    await expect(pane(page).getByText('0 items')).toBeVisible();
    await sendChat(
      page,
      'Create a bank account called BCA in IDR and a cash account called Wallet in USD',
    );

    const reply = page.getByTestId('assistant-message').last();
    await expect(reply.getByRole('button', { name: /Account created.*BCA/ })).toBeVisible();
    await expect(reply.getByRole('button', { name: /Account created.*Wallet/ })).toBeVisible();

    await sendChat(
      page,
      'I spent 12.50 on Food from Wallet and I spent 4.80 on Coffee from Wallet; paid 1500000 on Rent from BCA',
    );
    await expect(page.getByTestId('assistant-message').last().getByRole('button')).toHaveCount(3);
    await expect(pane(page).getByText('5 items')).toBeVisible();
    // Local currency symbols.
    await expect(pane(page).getByRole('button', { name: /Rent.*Rp\s1,500,000/ })).toBeVisible();
  });

  test('opens a card snapshot in the right pane and goes back to the list', async ({ page }) => {
    await sendChat(page, 'Create a cash account called Wallet in USD');
    await sendChat(page, 'I spent 12.50 on Food from Wallet');

    await page
      .getByTestId('assistant-message')
      .last()
      .getByRole('button', { name: /Expense recorded/ })
      .click();
    await expect(pane(page).getByText(/Snapshot ·/)).toBeVisible();
    await expect(pane(page).getByText('−$12.50')).toBeVisible();
    await expect(pane(page).getByText('Wallet (USD)')).toBeVisible();

    await pane(page).getByRole('button', { name: 'All items' }).click();
    await expect(pane(page).getByRole('heading', { name: 'In this chat' })).toBeVisible();
  });

  test('asks for account and dates, then lists transactions with a running balance', async ({
    page,
  }) => {
    await sendChat(page, 'Create a cash account called Wallet in USD');
    await sendChat(page, 'got paid 250 into Wallet');
    await sendChat(page, 'I spent 12.50 on Food from Wallet');

    await sendChat(page, 'Show my transactions');
    await expect(page.getByTestId('assistant-message').last()).toContainText(
      'which account, and what date range?',
    );

    await sendChat(page, `show transactions for Wallet from 2000-01-01 to ${today()}`);
    await page
      .getByTestId('assistant-message')
      .last()
      .getByRole('button', { name: /Transactions.*Wallet/ })
      .click();

    const table = pane(page).getByRole('table');
    await expect(table.getByRole('row', { name: /Opening balance.*\$0\.00/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Income.*\+\$250\.00.*\$250\.00/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Food.*−\$12\.50.*\$237\.50/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Closing balance.*\$237\.50/ })).toBeVisible();
  });

  test('asks for the month, then shows the summary without recent transactions', async ({
    page,
  }) => {
    await sendChat(page, 'Create a cash account called Wallet in USD');
    await sendChat(page, 'got paid 100 into Wallet');
    await sendChat(page, 'How did I do?');
    await expect(page.getByTestId('assistant-message').last()).toContainText(
      'Which month and year',
    );

    await sendChat(page, `Summarise ${thisMonth()}`);
    await page
      .getByTestId('assistant-message')
      .last()
      .getByRole('button', { name: /Monthly summary/ })
      .click();
    await expect(pane(page).getByText('All accounts')).toBeVisible();
    await expect(pane(page).getByRole('region', { name: 'Monthly totals' })).toContainText(
      '+$100.00',
    );
    await expect(pane(page).getByText('Recent transactions')).toHaveCount(0);
  });

  test('keeps the history after a reload and loads older messages on scroll', async ({ page }) => {
    // 16 exchanges = 32 messages; the first page shows the newest 20.
    for (let i = 1; i <= 16; i++) {
      const res = await page.request.post('/api/chat', { data: { message: `hello ${i}` } });
      expect(res.ok()).toBeTruthy();
    }
    await page.reload();
    const messages = conversation(page).locator('[data-testid$="-message"]');
    await expect(messages).toHaveCount(20);
    await expect(page.getByTestId('user-message').last()).toHaveText('hello 16');

    await conversation(page).evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(messages).toHaveCount(32);
    await expect(page.getByTestId('user-message').first()).toHaveText('hello 1');
    await expect(conversation(page).getByText('Start of conversation')).toBeVisible();
  });

  test('sends a suggestion from the empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Create a cash account called Wallet in USD' }).click();
    await expect(page.getByTestId('assistant-message')).toHaveCount(1);
    await expect(pane(page).getByText('1 item')).toBeVisible();
  });
});
