/*
 * A VERIFY NOTE IS NOW OPTIONAL.
 *
 * Verification used to demand a note recording what the reviewer checked. The readiness check
 * (VerificationReadinessService) now holds a deal to its mandatory information before it can be
 * verified at all, so the note is what it should always have been: something to say when there is
 * something to say. A version verified without one carries a null here.
 */
ALTER TABLE deal_version ALTER COLUMN verify_note DROP NOT NULL;
