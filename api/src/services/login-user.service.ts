import type { AuthUser, LoginRequest } from "@financialtracker/shared";
import { unauthorized } from "../errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { UserRepository } from "../repositories/postgres/user.repository.js";

let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

export class LoginUserService {
  constructor(private readonly users: Pick<UserRepository, "findByEmail">) {}

  async execute(req: LoginRequest): Promise<AuthUser> {
    const user = await this.users.findByEmail(req.email.trim());
    // Unknown email: still do the scrypt work so response time doesn't reveal which emails exist.
    const hash = user?.passwordHash ?? (await getDummyHash());
    const ok = await verifyPassword(req.password, hash);
    if (!user || !ok) {
      throw unauthorized("Email or password is incorrect.");
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}
