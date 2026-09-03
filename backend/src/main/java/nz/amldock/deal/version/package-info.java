/**
 * What a deal <em>was</em> when it was verified.
 *
 * <p>Verification used to be a one-way door: a deal could leave VERIFIED only for CLOSED, and no
 * role could edit it there, because editing the evidence under a sign-off would make the sign-off
 * untrue. This package is the alternative to unlocking that door. Verifying a deal copies it —
 * the deal row, its property and client, its ownership structure, its documents and the people on
 * it — into the tables here. The live deal can then be reopened into REVIEW and corrected freely,
 * because a copy is not reachable from the thing it copied.
 *
 * <p>These are not an audit trail. {@code audit_log} records what happened and {@code deal_note}
 * records what was said; both are event logs. A version is a <em>state</em>: enough to put the
 * deal back on screen exactly as the compliance officer saw it, years later.
 *
 * <p>Each entity here extends the same {@code @MappedSuperclass} as its live twin — see
 * {@link nz.amldock.deal.DealFields} — so neither can grow a column the other lacks without the
 * application refusing to start.
 */
package nz.amldock.deal.version;
