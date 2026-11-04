import type { Pool } from "pg";

export interface UserRecord {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

interface UserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
}

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  firstName: r.first_name,
  lastName: r.last_name,
  passwordHash: r.password_hash,
});

const COLS = "id, email, first_name, last_name, password_hash";

export interface NewUser {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(u: NewUser): Promise<UserRecord> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, first_name, last_name, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
      [u.email, u.firstName, u.lastName, u.passwordHash],
    );
    return toUser(rows[0]!);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${COLS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: number): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${COLS} FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}
