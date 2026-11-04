-- Shared by income and expense transactions.
CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Category name is unique per user, case-insensitive ("+ Create new" selects an existing match).
CREATE UNIQUE INDEX categories_user_id_name_lower_key ON categories (user_id, lower(name));
