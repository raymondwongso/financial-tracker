-- Investment accounts (stock per ticker, gold). The running position
-- (quantity, total_cost, realized_gain) is maintained incrementally by the API
-- under a row lock, so no history replay is needed. Transactions must be
-- applied in date order (last_traded_on), because the moving average depends on order.
CREATE TABLE investment_accounts (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  asset_type       TEXT NOT NULL CHECK (asset_type IN ('stock', 'gold')),
  -- Ticker (e.g. BBCA) or GOLD.
  symbol           TEXT NOT NULL,
  unit             TEXT NOT NULL CHECK (unit IN ('share', 'gram')),
  quantity         NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  -- Authoritative cost of held units; avoids drift from repeated division.
  total_cost       NUMERIC(24, 6) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  avg_cost         NUMERIC(20, 6) GENERATED ALWAYS AS
                     (CASE WHEN quantity = 0 THEN 0 ELSE round(total_cost / quantity, 6) END) STORED,
  realized_gain    NUMERIC(24, 6) NOT NULL DEFAULT 0,
  last_traded_on   DATE,
  -- Manually entered market price per unit (IDR).
  current_price    NUMERIC(15, 2) CHECK (current_price > 0),
  price_updated_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX investment_accounts_user_id_name_lower_key
  ON investment_accounts (user_id, lower(name));
CREATE INDEX investment_accounts_user_id_idx ON investment_accounts (user_id);

CREATE TABLE investment_transactions (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  investment_account_id BIGINT NOT NULL REFERENCES investment_accounts (id) ON DELETE RESTRICT,
  side                  TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  traded_on             DATE NOT NULL,
  -- Fractional: grams of gold can be fractional.
  quantity              NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  -- IDR per share / gram.
  unit_price            NUMERIC(15, 2) NOT NULL CHECK (unit_price > 0),
  note                  VARCHAR(120),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX investment_transactions_account_traded_idx
  ON investment_transactions (investment_account_id, traded_on DESC, id DESC);
