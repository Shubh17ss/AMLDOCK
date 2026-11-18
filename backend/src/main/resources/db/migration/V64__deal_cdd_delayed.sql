/*
 * DELAY CDD.
 *
 * A flag a broker or reviewer sets on a deal to record that customer due diligence on this
 * transaction is being delayed. It stays on the record once set, including after the deal is
 * verified or closed, and can be undone only while the deal is still being worked.
 *
 * Who and when stand or fall with the flag. Paired with deal_version for the same reason as V51:
 * DealFields is a @MappedSuperclass shared by Deal and DealVersion, and ddl-auto validates both.
 */

ALTER TABLE deal
    ADD COLUMN cdd_delayed            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN cdd_delayed_by_user_id BIGINT,
    ADD COLUMN cdd_delayed_at         TIMESTAMPTZ;

ALTER TABLE deal_version
    ADD COLUMN cdd_delayed            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN cdd_delayed_by_user_id BIGINT,
    ADD COLUMN cdd_delayed_at         TIMESTAMPTZ;
