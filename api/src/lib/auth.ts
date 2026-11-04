import type { FastifyRequest } from "fastify";
import { unauthorized } from "../errors.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: number };
    user: { id: number };
  }
}

export const COOKIE_NAME = "token";

/** onRequest hook (runs before validation): requires a valid JWT cookie and exposes `request.user.id`. */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized();
  }
}
