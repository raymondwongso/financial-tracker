-- Dated manual prices per investment account (one per day; re-entering a day overwrites it).
-- investment_accounts.current_price remains the price of the latest price_date.
CREATE TABLE investment_price_history (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  investment_account_id BIGINT NOT NULL REFERENCES investment_accounts (id) ON DELETE RESTRICT,
  price_date            DATE NOT NULL,
  -- IDR per share / gram.
  price                 NUMERIC(15, 2) NOT NULL CHECK (price > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investment_account_id, price_date)
);

-- Existing prices become the first history point, dated when they were entered.
INSERT INTO investment_price_history (investment_account_id, price_date, price)
SELECT id, price_updated_at::date, current_price
FROM investment_accounts
WHERE current_price IS NOT NULL AND price_updated_at IS NOT NULL;
