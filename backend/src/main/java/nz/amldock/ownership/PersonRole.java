package nz.amldock.ownership;

/**
 * The capacity in which an individual appears on <em>this</em> deal.
 *
 * <p>Held on {@code ownership_node} rather than on the person, because it is a statement about
 * one transaction: the same human can be a trustee on one deal and a guarantor on the next, and
 * both are true.
 *
 * <p>One per individual. A person who genuinely holds two capacities is recorded under the one
 * that matters most to the assessment, with the rest in the node's notes — a deliberate
 * simplification, not an oversight.
 *
 * <p>Distinct from {@link EdgeRole}, which describes a <em>link</em> between two nodes and
 * carries the ownership percentage. The two vocabularies overlap on a few words; the UI labels
 * this one "Type" and that one "Link role".
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_person_role} (V34) and
 * {@code PERSON_ROLES} in {@code frontend/src/api/ownership.js}.
 */
public enum PersonRole {

    /** Holds 25% or more of the entity — the threshold at which beneficial ownership bites. */
    OWNER_25_PLUS,
    TRUSTEE,
    SETTLOR,
    /** The person with effective control, whatever their title. Usually a director. */
    EFFECTIVE_CONTROLLER,
    /** Dealing with the firm on the client's behalf, without owning or controlling them. */
    ACTING_ON_BEHALF_OF_CLIENT,
    /** Holds the power to appoint and remove trustees, which is control by another name. */
    APPOINTER,
    EXECUTOR,
    PARTNER,
    PROTECTOR,
    GUARANTOR
}
