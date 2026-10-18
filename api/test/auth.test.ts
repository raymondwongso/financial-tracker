import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/types';
import { createTestApp, registerUser, resetDb } from './helpers';

const password = 'correct-horse-battery';

describe('auth', () => {
  let app: App;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(resetDb);
  afterAll(() => app.close());

  describe('POST /auth/register', () => {
    it('creates a user, sets an httpOnly session cookie and never returns the hash', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Ray', email: 'Ray@Example.com', password },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({ name: 'Ray', email: 'ray@example.com' });
      expect(body).not.toHaveProperty('passwordHash');
      const cookie = res.cookies.find((c) => c.name === 'ft_session');
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    });

    it('rejects a duplicate email with 409', async () => {
      await registerUser(app, 'dup@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Again', email: 'DUP@example.com', password },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: 'Conflict' });
    });

    it('rejects invalid input with field-level issues', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: '', email: 'nope', password: 'short' },
      });
      expect(res.statusCode).toBe(400);
      const paths = res.json().issues.map((i: { path: string }) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      await registerUser(app, 'login@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'login@example.com', password },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ email: 'login@example.com' });
      expect(res.cookies.some((c) => c.name === 'ft_session')).toBe(true);
    });

    it('returns the same generic 401 for a wrong password and an unknown email', async () => {
      await registerUser(app, 'login@example.com');
      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'login@example.com', password: 'wrong-password' },
      });
      const unknownEmail = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nobody@example.com', password },
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownEmail.statusCode).toBe(401);
      expect(wrongPassword.json()).toEqual(unknownEmail.json());
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user for a valid session', async () => {
      const user = await registerUser(app);
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: user.cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: user.id, email: user.email });
    });

    it('returns 401 without a session', async () => {
      const res = await app.inject({ method: 'GET', url: '/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 for a tampered token', async () => {
      const user = await registerUser(app);
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: `${user.cookie}tampered` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the session cookie', async () => {
      const user = await registerUser(app);
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: user.cookie },
      });
      expect(res.statusCode).toBe(204);
      const cleared = res.cookies.find((c) => c.name === 'ft_session');
      expect(cleared?.value).toBe('');
    });
  });
});

describe('auth rate limiting', () => {
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT: '3' });
  });
  afterAll(() => app.close());

  it('returns 429 after too many login attempts', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'x@example.com', password: 'x' },
      });
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await attempt()).statusCode);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
