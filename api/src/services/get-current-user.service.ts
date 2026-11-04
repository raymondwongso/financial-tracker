import type { AuthUser } from "@financialtracker/shared";
import { unauthorized } from "../errors.js";
import type { UserRepository } from "../repositories/postgres/user.repository.js";

export class GetCurrentUserService {
  constructor(private readonly users: Pick<UserRepository, "findById">) {}

  async execute(userId: number): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw unauthorized();
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}
