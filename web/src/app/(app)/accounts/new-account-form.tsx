'use client';

import { accountTypes, createAccountSchema } from '@ft/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { ACCOUNT_TYPE_LABELS } from '@/lib/format';

type Errors = Partial<Record<'name' | 'type' | 'currency' | 'form', string>>;

export function NewAccountForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = createAccountSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await api('/accounts', { body: parsed.data });
      form.reset();
      router.refresh();
    } catch (err) {
      setErrors(
        err instanceof ApiError && err.status === 409
          ? { name: err.message }
          : err instanceof ApiError && err.status === 400
            ? err.fieldErrors()
            : { form: 'Could not create the account. Please try again.' },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface p-4 d-flex flex-column gap-3" aria-labelledby="new-account">
      <h2 id="new-account" className="h6 fw-bolder m-0">
        New account
      </h2>
      {errors.form ? (
        <div className="alert alert-danger py-2 m-0 small" role="alert">
          {errors.form}
        </div>
      ) : null}
      <form className="d-flex flex-column gap-3" onSubmit={onSubmit} noValidate>
        <Field label="Name" name="name" placeholder="e.g. BCA Savings" error={errors.name} />
        <div>
          <label htmlFor="type" className="form-label fw-bold small mb-1">
            Type
          </label>
          <select id="type" name="type" className="form-select" defaultValue="bank">
            {accountTypes.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Currency"
          name="currency"
          defaultValue="USD"
          maxLength={3}
          style={{ textTransform: 'uppercase' }}
          hint="3-letter code, e.g. USD, IDR, EUR"
          error={errors.currency}
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </section>
  );
}
