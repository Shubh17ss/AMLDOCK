/*
 * WHO VERIFIED AN OWNER, WHEN, AND WHETHER IT WAS AN EXCEPTION.
 *
 * Verification of an ownership node has been a placeholder since V6: a four-value status column
 * a reviewer could set from a radio group, saved through the generic node PATCH. Two things were
 * missing, and both matter more than the status itself.
 *
 * First, no byline. Nothing recorded who marked an owner verified or when, so the one question
 * an auditor actually asks - who cleared this party, and on what date - had no answer on the row
 * that claims it. verified_by_user_id / verified_at are that answer.
 *
 * Second, no way to say "verified, but with an exception granted". A firm that clears an owner
 * despite a gap in the evidence is taking a different decision from one that clears them
 * outright, and flattening the two into VERIFIED loses exactly the distinction a reviewer later
 * needs to find. VERIFIED_WITH_EXCEPTION is that second decision, and verification_notes (added
 * in V9) carries the reason it was granted.
 *
 * NOT_STARTED, IN_PROGRESS and FAILED all stay. They are still written when a node is created -
 * by hand, by extraction, or by an implied trust - and the UI renders every one of them as "Not
 * Verified", because from a reviewer, silence and a failure are the same thing: not cleared yet.
 * They are simply no longer reachable from the Verification tab, which now grants one of the two
 * VERIFIED values or nothing at all.
 *
 * NO FOREIGN KEY to app_user, matching risk_overridden_by_user_id in V47 and the approval columns
 * before it. Deactivating a user must not be blocked by, and must not rewrite, a decision they
 * took while they were here. A missing user renders as no byline rather than as an error.
 *
 * THE PAIRED ALTER. OwnershipNodeFields is a @MappedSuperclass shared by OwnershipNode and
 * DealVersionNode, and Hibernate runs ddl-auto: validate, so every column here has to land on
 * both tables or the application will not start. See the same note in V44, V45, V46 and V47.
 *
 * The CHECK constraint lives on the live table only. deal_version_node was cloned with
 * EXCLUDING ALL and deliberately carries no constraints - a frozen version is written once by
 * the server and never edited - so only ownership_node needs its list widened.
 */

ALTER TABLE ownership_node
    DROP CONSTRAINT chk_ownership_node_verification,
    ADD  CONSTRAINT chk_ownership_node_verification CHECK (verification_status IN
        ('NOT_STARTED','IN_PROGRESS','VERIFIED','VERIFIED_WITH_EXCEPTION','FAILED')),
    ADD COLUMN verified_by_user_id BIGINT,
    ADD COLUMN verified_at         TIMESTAMPTZ;

ALTER TABLE deal_version_node
    ADD COLUMN verified_by_user_id BIGINT,
    ADD COLUMN verified_at         TIMESTAMPTZ;
