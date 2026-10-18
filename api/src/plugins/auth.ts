import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { unauthorized } from '../errors';

export const SESSION_COOKIE = 'ft_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    startSession: (reply: FastifyReply, user: { id: string; email: string }) => Promise<void>;
  }
}

interface AuthOptions {
  secret: string;
  secureCookie: boolean;
}

/** JWT session stored in an httpOnly cookie. `app.authenticate` is used as a preHandler. */
const authPlugin: FastifyPluginAsync<AuthOptions> = async (app, opts) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: opts.secret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });

  app.decorate('startSession', async (reply: FastifyReply, user: { id: string; email: string }) => {
    const token = await reply.jwtSign({ sub: user.id, email: user.email });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookie,
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
  });
};

export const auth = fp(authPlugin, { name: 'auth' });
