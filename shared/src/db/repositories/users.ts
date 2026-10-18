import { eq } from 'drizzle-orm';
import type { User } from '../../schemas/auth';
import type { Db } from '../client';
import { ConflictError, isUniqueViolation } from '../errors';
import { users, type UserRow } from '../schema';

export function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt.toISOString() };
}

export async function createUser(
  db: Db,
  input: { name: string; email: string; passwordHash: string },
): Promise<User> {
  try {
    const [row] = await db.insert(users).values(input).returning();
    return toUser(row!);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError('Email is already registered');
    throw error;
  }
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function findUserById(db: Db, id: string): Promise<User | undefined> {
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  return row ? toUser(row) : undefined;
}
