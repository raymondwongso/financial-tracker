CREATE TABLE accounts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  -- IDR only, no decimals. 15 digits matches the amount input cap in the UI.
  initial_balance NUMERIC(15, 0) NOT NULL DEFAULT 0 CHECK (initial_balance >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account name is unique per user, case-insensitive. Also serves lookups by user_id.
CREATE UNIQUE INDEX accounts_user_id_name_lower_key ON accounts (user_id, lower(name));
