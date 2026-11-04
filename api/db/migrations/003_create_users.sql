CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email is unique regardless of case ("email not already registered", case-insensitive login).
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
