import type { Pool } from "pg";
import type { Category } from "@financialtracker/shared";

export class CategoryRepository {
  constructor(private readonly pool: Pool) {}

  async listByUser(userId: number): Promise<Category[]> {
    const { rows } = await this.pool.query<Category>(
      "SELECT id, name FROM categories WHERE user_id = $1 ORDER BY lower(name)",
      [userId],
    );
    return rows;
  }

  async findByName(userId: number, name: string): Promise<Category | null> {
    const { rows } = await this.pool.query<Category>(
      "SELECT id, name FROM categories WHERE user_id = $1 AND lower(name) = lower($2)",
      [userId, name],
    );
    return rows[0] ?? null;
  }

  async findByIdForUser(id: number, userId: number): Promise<Category | null> {
    const { rows } = await this.pool.query<Category>(
      "SELECT id, name FROM categories WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return rows[0] ?? null;
  }

  /** Inserts, or returns the existing row when the name already exists (case-insensitive). */
  async create(userId: number, name: string): Promise<Category> {
    const { rows } = await this.pool.query<Category>(
      `INSERT INTO categories (user_id, name) VALUES ($1, $2)
       ON CONFLICT (user_id, lower(name)) DO UPDATE SET name = categories.name
       RETURNING id, name`,
      [userId, name],
    );
    return rows[0]!;
  }
}
