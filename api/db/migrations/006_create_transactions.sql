CREATE TABLE transactions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  BIGINT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  -- IDR only, no decimals. Always positive; `type` carries the sign.
  amount      NUMERIC(15, 0) NOT NULL CHECK (amount > 0),
  description VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Newest-first listing with cursor pagination on (created_at, id), date-range filters,
-- and the per-account "last transaction date".
CREATE INDEX transactions_account_id_created_at_id_idx
  ON transactions (account_id, created_at DESC, id DESC);

-- FK lookups and per-category sums for the Summary pie charts.
CREATE INDEX transactions_category_id_idx ON transactions (category_id);
