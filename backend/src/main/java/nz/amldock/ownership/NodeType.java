package nz.amldock.ownership;

/**
 * What kind of owner a node stands for.
 *
 * <p>Any of these may sit above or below any other, with one exception: an {@link #INDIVIDUAL}
 * is always a leaf. A natural person owns things; nothing owns a natural person.
 *
 * <p><strong>Keep in sync with</strong> {@code chk_ownership_node_type} (last rebuilt by V34)
 * and {@code NODE_TYPES} in {@code frontend/src/api/ownership.js}, which carries the labels.
 */
public enum NodeType {

    /** A natural person. Renamed from NATURAL_PERSON in V31; always the bottom of a chain. */
    INDIVIDUAL,

    PRIVATE_COMPANY,
    LISTED_COMPANY,
    /** A company that exists to act as trustee of a trust — common enough to warrant its own type. */
    TRUSTEE_COMPANY,
    TRUST,
    PARTNERSHIP,
    LIMITED_PARTNERSHIP,
    INCORPORATED_SOCIETY,
    CHARITY,
    GOVERNMENT_AGENCY,
    /** The estate of a deceased person, held by executors until it is distributed. */
    DECEASED_ESTATE,

    /**
     * The structure nobody anticipated. Kept deliberately: an officer forced to mislabel an
     * owner is a worse outcome than a vague but honest one, and the notes field can carry the
     * detail until the type earns a place on the list.
     */
    OTHER;

    /**
     * Whether this type can never own anything, and so can never be an edge's parent.
     *
     * <p>Enforced in {@code OwnershipService} rather than the schema: the rule spans two rows —
     * the edge and the parent it points at — and a CHECK constraint cannot see across them.
     */
    public boolean isLeafOnly() {
        return this == INDIVIDUAL;
    }
}
