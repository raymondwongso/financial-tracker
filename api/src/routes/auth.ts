import { hash, verify } from '@node-rs/argon2';
import { loginSchema, registerSchema, userSchema } from '@ft/shared';
import { createUser, findUserByEmail, findUserById, toUser } from '@ft/shared/db';
import { SESSION_COOKIE } from '../plugins/auth';
import { unauthorized } from '../errors';
import type { App } from '../types';

// Verified against when the email is unknown, so response time does not reveal registered emails.
const DUMMY_HASH = await hash('timing-attack-mitigation');

export async function authRoutes(app: App, opts: { rateLimit: number }): Promise<void> {
  const rateLimit = { max: opts.rateLimit, timeWindow: '1 minute' };

  app.post(
    '/register',
    {
      config: { rateLimit },
      schema: { body: registerSchema, response: { 201: userSchema } },
    },
    async (request, reply) => {
      const { name, email, password } = request.body;
      const user = await createUser(app.db, { name, email, passwordHash: await hash(password) });
      await app.startSession(reply, user);
      request.log.info({ userId: user.id }, 'user registered');
      return reply.status(201).send(user);
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit },
      schema: { body: loginSchema, response: { 200: userSchema } },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const row = await findUserByEmail(app.db, email);
      const valid = await verify(row?.passwordHash ?? DUMMY_HASH, password);
      if (!row || !valid) {
        request.log.warn('failed login attempt');
        throw unauthorized('Invalid email or password');
      }
      await app.startSession(reply, row);
      return toUser(row);
    },
  );

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  app.get(
    '/me',
    { onRequest: app.authenticate, schema: { response: { 200: userSchema } } },
    async (request) => {
      const user = await findUserById(app.db, request.user.sub);
      if (!user) throw unauthorized();
      return user;
    },
  );
}
