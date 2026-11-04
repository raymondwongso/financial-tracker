import type { Pool } from "pg";

export interface Dummy {
  id: number;
  name: string;
  createdAt: Date;
}

interface DummyRow {
  id: number;
  name: string;
  created_at: Date;
}

const toDummy = (row: DummyRow): Dummy => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

export class DummyRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Dummy[]> {
    const { rows } = await this.pool.query<DummyRow>(
      "SELECT id, name, created_at FROM dummies ORDER BY id",
    );
    return rows.map(toDummy);
  }

  async findById(id: number): Promise<Dummy | null> {
    const { rows } = await this.pool.query<DummyRow>(
      "SELECT id, name, created_at FROM dummies WHERE id = $1",
      [id],
    );
    return rows[0] ? toDummy(rows[0]) : null;
  }
}
