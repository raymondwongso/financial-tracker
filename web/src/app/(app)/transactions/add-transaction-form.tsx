'use client';

import { createTransactionSchema, toMinor, type Account, type TransactionType } from '@ft/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-error';

type Errors = Partial<
  Record<'accountId' | 'amountMinor' | 'category' | 'occurredOn' | 'description' | 'form', string>
>;

const today = () => new Date().toISOString().slice(0, 10);

export function AddTransactionForm({
  accounts,
  defaultAccountId,
}: {
  accounts: Account[];
  defaultAccountId?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const account = accounts.find((a) => a.id === accountId);

  if (accounts.length === 0) {
    return (
      <section className="surface p-4">
        <h2 className="h6 fw-bolder">Add transaction</h2>
        <p className="small text-secondary m-0">Create an account first.</p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(String(data.get('amount') ?? '').replace(/,/g, ''));
    const parsed = createTransactionSchema.safeParse({
      accountId,
      type,
      amountMinor: account && Number.isFinite(amount) ? toMinor(amount, account.currency) : NaN,
      category: data.get('category'),
      description: data.get('description') || undefined,
      occurredOn: data.get('occurredOn'),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [
            String(i.path[0]),
            i.path[0] === 'amountMinor' ? 'Amount must be greater than zero.' : i.message,
          ]),
        ),
      );
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await api('/transactions', { body: parsed.data });
      form.reset();
      router.refresh();
    } catch (err) {
      setErrors(
        err instanceof ApiError && err.status === 400
          ? err.fieldErrors()
          : { form: 'Could not save the transaction. Please try again.' },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface p-4 d-flex flex-column gap-3" aria-labelledby="add-tx">
      <h2 id="add-tx" className="h6 fw-bolder m-0">
        Add transaction
      </h2>
      <form className="d-flex flex-column gap-3" onSubmit={onSubmit} noValidate>
        <fieldset>
          <legend className="form-label fw-bold small mb-1">Type</legend>
          <div className="d-flex gap-2" role="group" aria-label="Transaction type">
            {(['expense', 'income'] as const).map((t) => (
              <label key={t} className={`btn seg-btn${type === t ? ` seg-${t}` : ''}`}>
                <input
                  type="radio"
                  name="type"
                  value={t}
                  className="visually-hidden"
                  checked={type === t}
                  onChange={() => setType(t)}
                />
                {t === 'income' ? 'Income' : 'Expense'}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="accountId" className="form-label fw-bold small mb-1">
            Account
          </label>
          <select
            id="accountId"
            className="form-select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>
        <Field
          label={`Amount${account ? ` (${account.currency})` : ''}`}
          name="amount"
          inputMode="decimal"
          placeholder="0.00"
          className="num"
          error={errors.amountMinor}
        />
        <Field
          label="Category"
          name="category"
          placeholder="e.g. Groceries"
          error={errors.category}
        />
        <Field
          label="Date"
          name="occurredOn"
          type="date"
          defaultValue={today()}
          error={errors.occurredOn}
        />
        <Field
          label="Description (optional)"
          name="description"
          placeholder="What was it for?"
          error={errors.description}
        />
        {errors.form ? (
          <div className="alert alert-danger py-2 m-0 small" role="alert">
            {errors.form}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save transaction'}
        </button>
      </form>
    </section>
  );
}
