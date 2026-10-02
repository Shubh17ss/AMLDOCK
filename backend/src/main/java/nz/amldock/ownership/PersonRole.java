package nz.amldock.ownership;

/**
 * The capacity in which an individual appears on <em>this</em> deal.
 *
 * <p>Held on {@code ownership_node} rather than on the person, because it is a statement about
 * one transaction: the same human can be a trustee on one deal and a guarantor on the next, and
 * both are true.
 *
 * <p>A set, not one value. Until V43 a node held a single role and a person with two capacities
 * was recorded under whichever mattered most, the rest going into the node's notes. A family trust
 * makes that untenable — the same human is routinely settlor, trustee and appointer — and notes
 * are not a field any register can read, so the capacities nobody could record were invisible
 * rather than merely secondary.
 *
 * <p>Distinct from {@link EdgeRole}, which describes a <em>link</em> between two nodes and
 * carries the ownership percentage. The two vocabularies overlap on a few words; the UI labels
 * this one "Type" and that one "Link role".
 *
 * <p><strong>Keep in sync with</strong> {@code PERSON_ROLES} in
 * {@code frontend/src/api/ownership.js}. There is no longer a CHECK constraint to match: V43
 * replaced {@code person_role} with the delimited {@code person_roles}, and a list cannot be
 * checked in SQL the way a scalar vocabulary could. {@link PersonRoleSetConverter} is what
 * enforces it now, and it is the only thing that writes the column.
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
    GUARANTOR,
    /**
     * Stands to benefit from a trust without holding or controlling it. Not an owner and not a
     * controller, which is why it took until now to be offered — but a discretionary trust's
     * beneficiaries are who the money is ultimately for, and a file that cannot name them has
     * not identified the beneficial ownership it claims to have checked.
     */
    BENEFICIARY
}
