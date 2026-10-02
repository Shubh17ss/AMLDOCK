/*
 * WHO OVERRODE THE RISK, AND WHEN.
 *
 * V46 shipped risk_override_comment: the reason a reviewer pinned a band by hand. It did not ship
 * the two facts that make the reason worth anything - who wrote it and when. A comment with no
 * byline reads as the deal saying something about itself rather than as a named person taking a
 * decision, and the whole point of allowing an override is that somebody is accountable for it.
 *
 * The audit log already records both, and that is deliberately not good enough here. Its summary
 * is prose assembled for a human to read; rendering a byline on the Risk tab from it would mean
 * parsing that sentence back apart, which turns a log line into an API contract and breaks the
 * first time anyone rewords it. These are two columns on the row they describe.
 *
 * Mirrors risk_approved_by_user_id / risk_approved_at exactly, because it is the same kind of
 * fact about the neighbouring decision, and the two should not be shaped differently.
 *
 * NO FOREIGN KEY to app_user, matching the approval columns beside them. Deactivating a user must
 * not be blocked by, and must not rewrite, a decision they took while they were here - the record
 * of who did it outlives their account. A missing user renders as no byline rather than as an
 * error; DealService.riskDto already resolves the approval email that way.
 *
 * Both columns are cleared when an override is released - see DealService.overrideRisk. A
 * released override has no author, and leaving the last one behind would credit somebody with a
 * decision that is no longer in force.
 *
 * THE PAIRED ALTER. DealFields is a @MappedSuperclass shared by Deal and DealVersion, and
 * Hibernate runs ddl-auto: validate, so every column here has to land on both tables or the
 * application will not start. V41 built deal_version with CREATE TABLE (LIKE deal EXCLUDING ALL),
 * a one-time clone with nothing keeping it in step. See the same note in V44, V45 and V46.
 */

ALTER TABLE deal
    ADD COLUMN risk_overridden_by_user_id BIGINT,
    ADD COLUMN risk_overridden_at         TIMESTAMPTZ;

ALTER TABLE deal_version
    ADD COLUMN risk_overridden_by_user_id BIGINT,
    ADD COLUMN risk_overridden_at         TIMESTAMPTZ;
