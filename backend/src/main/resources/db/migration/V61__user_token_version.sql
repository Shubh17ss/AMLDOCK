-- Security scan F6: end a user's access the moment it changes, not when their access token expires.
--
-- Every access token carries the user's token_version (claim "tv"). JwtAuthenticationFilter
-- compares it, and is_active, against this row (through a short-lived cache) on each request.
-- UserService bumps it when a user is deactivated, has their role, firm or branch changed, or
-- has their password changed or reset, and revokes their refresh tokens at the same time.
--
-- A constant NOT NULL default is a metadata-only change on Postgres 11+: no table rewrite.
ALTER TABLE app_user ADD COLUMN token_version INT NOT NULL DEFAULT 0;
