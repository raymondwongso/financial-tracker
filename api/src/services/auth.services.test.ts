import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../errors.js";
import type { UserRecord } from "../repositories/postgres/user.repository.js";
import { LoginUserService } from "./login-user.service.js";
import { RegisterUserService } from "./register-user.service.js";

function fakeUsers() {
  const rows: UserRecord[] = [];
  return {
    rows,
    async findByEmail(email: string) {
      return rows.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async create(u: Omit<UserRecord, "id">) {
      const rec = { id: rows.length + 1, ...u };
      rows.push(rec);
      return rec;
    },
  };
}

const valid = { email: "a@b.co", firstName: "Ada", lastName: "Lovelace", password: "password1" };

async function rejects(p: Promise<unknown>, status: number, msg?: string) {
  await assert.rejects(p, (e: unknown) => e instanceof AppError && e.statusCode === status && (!msg || e.message === msg));
}

test("register stores a hashed password and returns the user without it", async () => {
  const users = fakeUsers();
  const user = await new RegisterUserService(users).execute(valid);
  assert.deepEqual(user, { id: 1, email: "a@b.co", firstName: "Ada", lastName: "Lovelace" });
  assert.notEqual(users.rows[0]!.passwordHash, "password1");
});

test("register validates input", async () => {
  const svc = new RegisterUserService(fakeUsers());
  await rejects(svc.execute({ ...valid, firstName: " " }), 400);
  await rejects(svc.execute({ ...valid, lastName: "" }), 400);
  await rejects(svc.execute({ ...valid, email: "nope" }), 400);
  await rejects(svc.execute({ ...valid, password: "short" }), 400);
});

test("register rejects a duplicate email case-insensitively", async () => {
  const svc = new RegisterUserService(fakeUsers());
  await svc.execute(valid);
  await rejects(svc.execute({ ...valid, email: "A@B.CO" }), 409, "Email already registered");
});

test("register maps a unique-violation race to 409", async () => {
  const users = fakeUsers();
  users.create = async () => {
    throw Object.assign(new Error("dup"), { code: "23505" });
  };
  await rejects(new RegisterUserService(users).execute(valid), 409);
});

test("login succeeds with the right password, fails generically otherwise", async () => {
  const users = fakeUsers();
  await new RegisterUserService(users).execute(valid);
  const login = new LoginUserService(users);
  assert.equal((await login.execute({ email: "A@b.co", password: "password1" })).id, 1);
  await rejects(login.execute({ email: "a@b.co", password: "bad" }), 401, "Email or password is incorrect.");
  await rejects(login.execute({ email: "x@y.co", password: "password1" }), 401, "Email or password is incorrect.");
});
