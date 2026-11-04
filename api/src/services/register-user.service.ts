import type { AuthUser, RegisterRequest } from "@financialtracker/shared";
import { badRequest, conflict } from "../errors.js";
import { hashPassword } from "../lib/password.js";
import type { UserRepository } from "../repositories/postgres/user.repository.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RegisterUserService {
  constructor(private readonly users: Pick<UserRepository, "create" | "findByEmail">) {}

  async execute(req: RegisterRequest): Promise<AuthUser> {
    const email = req.email.trim();
    const firstName = req.firstName.trim();
    const lastName = req.lastName.trim();
    if (!firstName) throw badRequest("First name is required");
    if (!lastName) throw badRequest("Last name is required");
    if (!EMAIL_RE.test(email)) throw badRequest("Enter a valid email");
    if (req.password.length < 8) throw badRequest("Password must be at least 8 characters");
    if (await this.users.findByEmail(email)) throw conflict("Email already registered");

    const user = await this.users
      .create({ email, firstName, lastName, passwordHash: await hashPassword(req.password) })
      .catch((err: unknown) => {
        // lost a race with a concurrent registration (unique violation)
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
          throw conflict("Email already registered");
        }
        throw err;
      });
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}
