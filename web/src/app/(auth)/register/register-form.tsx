'use client';

import { registerSchema } from '@ft/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-error';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await api('/auth/register', { body: parsed.data });
      router.replace('/chat');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: 'This email is already registered.' });
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors(err.fieldErrors());
      } else {
        setErrors({ form: 'Something went wrong. Please try again.' });
      }
      setPending(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="page-title">Create your account</h1>
        <p className="text-secondary m-0">It’s free and takes a few seconds.</p>
      </div>
      {errors.form ? (
        <div className="alert alert-danger fw-semibold m-0" role="alert">
          {errors.form}
        </div>
      ) : null}
      <form className="d-flex flex-column gap-3" onSubmit={onSubmit} noValidate>
        <Field label="Name" name="name" autoComplete="name" error={errors.name} required />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={errors.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="m-0 small">
        Already have an account?{' '}
        <Link href="/login" className="fw-bold">
          Log in
        </Link>
      </p>
    </div>
  );
}
