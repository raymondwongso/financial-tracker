import pg from "pg";
import type { Config } from "../../config.js";

// BIGINT ids and NUMERIC(15,0) amounts are safe integers; return numbers, not strings.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export function createPool(config: Config): pg.Pool {
  return new pg.Pool({ connectionString: config.databaseUrl });
}
