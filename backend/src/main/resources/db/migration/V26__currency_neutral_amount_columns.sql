-- These columns were named when the platform was New Zealand only. A reporting entity now has a
-- country (V25) and its amounts are denominated in that entity's currency — NZD or AUD — so the
-- "_nzd" suffix is now wrong rather than merely redundant.
--
-- Values are untouched: the numbers already meant "in this firm's currency", and every firm that
-- exists today is a New Zealand one.
--
-- The CHECK constraints over these columns (chk_ift_amount, chk_sa_amount, chk_sa_txn_amount)
-- follow the rename automatically — Postgres stores their expressions against the column's
-- attribute number, not its name — so they need no rebuild. No index or view references them.

ALTER TABLE deal                           RENAME COLUMN transaction_value_nzd TO transaction_value;
ALTER TABLE international_fund_transaction RENAME COLUMN amount_nzd            TO amount;
ALTER TABLE suspicious_activity            RENAME COLUMN amount_nzd            TO amount;
