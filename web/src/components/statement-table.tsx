import type { AccountStatement } from '@ft/shared';
import { formatShortDate, money, txAmount } from '@/lib/format';

/** One account's transactions with opening, running and closing balances (oldest first). */
export function StatementTable({ statement }: { statement: AccountStatement }) {
  const currency = statement.account.currency;
  return (
    <div className="d-flex flex-column gap-2">
      {statement.truncated ? (
        <p className="small text-secondary m-0" role="note">
          Showing the newest {statement.transactions.length} transactions in this range.
        </p>
      ) : null}
      <div className="surface overflow-auto">
        <table className="table ft-table m-0" style={{ minWidth: 340 }}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Details</th>
              <th scope="col" className="text-end">
                Amount
              </th>
              <th scope="col" className="text-end">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-muted">
              <td colSpan={3}>Opening balance</td>
              <td className="num text-end">{money(statement.openingBalanceMinor, currency)}</td>
            </tr>
            {statement.transactions.map((t) => (
              <tr key={t.id}>
                <td className="num text-secondary text-nowrap">{formatShortDate(t.occurredOn)}</td>
                <td>
                  <span className="fw-bold">{t.description || t.category}</span>
                  <br />
                  <span className="text-secondary small">{t.category}</span>
                </td>
                <td
                  className={`num text-end fw-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}
                >
                  {txAmount(t.amountMinor, currency, t.type)}
                </td>
                <td className="num text-end">{money(t.runningBalanceMinor, currency)}</td>
              </tr>
            ))}
            <tr className="row-muted">
              <td colSpan={3}>Closing balance</td>
              <td className="num text-end">{money(statement.closingBalanceMinor, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
