import type { FastifyInstance } from "fastify";
import type { LoginRequest, RegisterRequest } from "@financialtracker/shared";
import { authenticate, COOKIE_NAME } from "../lib/auth.js";
import type { GetCurrentUserService } from "../services/get-current-user.service.js";
import type { LoginUserService } from "../services/login-user.service.js";
import type { RegisterUserService } from "../services/register-user.service.js";

interface Deps {
  registerUser: Pick<RegisterUserService, "execute">;
  loginUser: Pick<LoginUserService, "execute">;
  getCurrentUser: Pick<GetCurrentUserService, "execute">;
  cookieSecure: boolean;
}

const str = (max = 200) => ({ type: "string", maxLength: max });

export function authController({ registerUser, loginUser, getCurrentUser, cookieSecure }: Deps) {
  return async (app: FastifyInstance) => {
    app.post<{ Body: RegisterRequest }>(
      "/auth/register",
      {
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
        schema: {
          body: {
            type: "object",
            required: ["email", "firstName", "lastName", "password"],
            properties: { email: str(), firstName: str(), lastName: str(), password: str(200) },
          },
        },
      },
      async (request, reply) => reply.code(201).send(await registerUser.execute(request.body)),
    );

    app.post<{ Body: LoginRequest }>(
      "/auth/login",
      {
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
        schema: {
          body: {
            type: "object",
            required: ["email", "password"],
            properties: { email: str(), password: str(200) },
          },
        },
      },
      async (request, reply) => {
        const user = await loginUser.execute(request.body);
        const token = app.jwt.sign({ id: user.id }, { expiresIn: "7d" });
        reply.setCookie(COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: cookieSecure,
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });
        return user;
      },
    );

    app.post("/auth/logout", async (_request, reply) => {
      reply.clearCookie(COOKIE_NAME, { path: "/" });
      return reply.code(204).send();
    });

    app.get("/auth/me", { onRequest: authenticate }, async (request) =>
      getCurrentUser.execute(request.user.id),
    );
  };
}
