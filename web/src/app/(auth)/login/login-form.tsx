'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-error';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      await api('/auth/login', {
        body: { email: form.get('email'), password: form.get('password') },
      });
      router.replace('/chat');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Invalid email or password.'
          : err instanceof ApiError && err.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : 'Something went wrong. Please try again.',
      );
      setPending(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="page-title">Welcome back</h1>
        <p className="text-secondary m-0">Log in to your account.</p>
      </div>
      {error ? (
        <div className="alert alert-danger fw-semibold m-0" role="alert">
          {error}
        </div>
      ) : null}
      <form className="d-flex flex-column gap-3" onSubmit={onSubmit} noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="m-0 small">
        New here?{' '}
        <Link href="/register" className="fw-bold">
          Create an account
        </Link>
      </p>
    </div>
  );
}
