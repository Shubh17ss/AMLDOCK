package nz.amldock.ownership;

import nz.amldock.document.DocumentType;

import java.util.Set;

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

    /**
     * What a private company's file is allowed to hold.
     *
     * <p>Types with no list here still accept the whole catalogue — a restriction is a claim
     * about what evidence this kind of owner produces, and asserting one for a type nobody has
     * worked through yet would be a guess with teeth.
     */
    private static final Set<DocumentType> PRIVATE_COMPANY_DOCUMENTS = Set.of(
            DocumentType.COMPANY_CERT,             // certificate of incorporation
            DocumentType.COMPANY_EXTRACT,
            DocumentType.OWNERSHIP_STRUCTURE,
            DocumentType.COMPANY_CONSTITUTION,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.WEB_SEARCH_RESULT,
            DocumentType.TAX_RETURN,
            DocumentType.PROOF_OF_ADDRESS,
            DocumentType.OTHER);

    private static final Set<DocumentType> TRUSTEE_COMPANY_DOCUMENTS = Set.of(
            DocumentType.COMPANY_CERT,
            DocumentType.COMPANY_EXTRACT,
            DocumentType.OTHER);

    private static final Set<DocumentType> LIMITED_PARTNERSHIP_DOCUMENTS = Set.of(
            DocumentType.COMPANY_CERT,
            DocumentType.LIMITED_PARTNERSHIP_EXTRACT,
            DocumentType.PARTNERSHIP_STRUCTURE,
            DocumentType.PARTNERSHIP_AGREEMENT,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.WEB_SEARCH_RESULT,
            DocumentType.TAX_RETURN,
            DocumentType.PROOF_OF_ADDRESS,
            DocumentType.OTHER);

    /** The same list as a limited partnership, less its registry extract. */
    private static final Set<DocumentType> PARTNERSHIP_DOCUMENTS = Set.of(
            DocumentType.COMPANY_CERT,
            DocumentType.PARTNERSHIP_STRUCTURE,
            DocumentType.PARTNERSHIP_AGREEMENT,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.WEB_SEARCH_RESULT,
            DocumentType.TAX_RETURN,
            DocumentType.PROOF_OF_ADDRESS,
            DocumentType.OTHER);

    private static final Set<DocumentType> LISTED_COMPANY_DOCUMENTS = Set.of(
            DocumentType.COMPANY_CERT,
            DocumentType.EXCHANGE_REGISTRATION_SEARCH_RESULT,
            DocumentType.GOVERNMENT_STATEMENT,
            DocumentType.OTHER);

    private static final Set<DocumentType> INCORPORATED_SOCIETY_DOCUMENTS = Set.of(
            DocumentType.SOCIETY_RULES,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.OTHER);

    private static final Set<DocumentType> CHARITY_DOCUMENTS = Set.of(
            DocumentType.CHARITIES_REGISTER_INFORMATION,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.OTHER);

    private static final Set<DocumentType> GOVERNMENT_AGENCY_DOCUMENTS = Set.of(
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.OTHER);

    private static final Set<DocumentType> DECEASED_ESTATE_DOCUMENTS = Set.of(
            DocumentType.PROBATE_OR_WILL,
            DocumentType.OTHER);

    /**
     * What a natural person's file is allowed to hold.
     *
     * <p>The one list on this class that is not about an entity's registry paperwork: identity
     * documents, the evidence that backs an address or a source of funds, and the results of the
     * checks run against them. Until now INDIVIDUAL was unrestricted, which meant a person's file
     * would accept a trust deed — not a document any person produces, and one that belongs on the
     * trust it came from.
     *
     * <p>Only reached when a document is filed against a node. The deal form's ID scans are
     * deal-scoped and have no node behind them, so nothing here narrows what a broker can
     * photograph — see {@code DocumentService.presignUpload}.
     */
    private static final Set<DocumentType> INDIVIDUAL_DOCUMENTS = Set.of(
            DocumentType.NZ_PASSPORT,
            DocumentType.AU_PASSPORT,
            DocumentType.OVERSEAS_PASSPORT,
            DocumentType.NZ_DRIVER_LICENCE,
            DocumentType.AU_DRIVER_LICENCE,
            DocumentType.PROOF_OF_ADDRESS,
            DocumentType.BANK_CARD,
            DocumentType.BANK_STATEMENT,
            DocumentType.CERTIFICATE_OF_CITIZENSHIP,
            DocumentType.FOREIGN_CITIZENSHIP_CERTIFICATE,
            DocumentType.BIRTH_CERTIFICATE,
            DocumentType.MARRIAGE_CERTIFICATE,
            DocumentType.DEATH_CERTIFICATE,
            DocumentType.INTERNATIONAL_DRIVING_PERMIT,
            DocumentType.NATIONAL_IDENTITY_CARD,
            DocumentType.FOREIGN_IDENTITY_CARD,
            DocumentType.KIWI_ACCESS_CARD,
            DocumentType.GOVERNMENT_CARD,
            DocumentType.GOVERNMENT_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.TAX_RETURN,
            DocumentType.WAGE_SLIP,
            DocumentType.ELECTRONIC_ID_VERIFICATION_RESULT,
            DocumentType.BIOMETRIC_VERIFICATION_RESULT,
            DocumentType.ENDURING_POWER_OF_ATTORNEY,
            DocumentType.CERTIFICATE_OF_NON_REVOCATION,
            DocumentType.WEB_SEARCH_RESULT,
            DocumentType.LETTER_FROM_TRUSTED_REFEREE,
            DocumentType.REFUGEE_TRAVEL_DOCUMENT,
            DocumentType.OTHER);

    /** What a trust file is allowed to hold. */
    private static final Set<DocumentType> TRUST_DOCUMENTS = Set.of(
            DocumentType.TRUST_DEED,
            DocumentType.AMENDMENTS_OR_VARIATIONS,
            DocumentType.TRUSTEES_RESOLUTION,
            DocumentType.BANK_STATEMENT,
            DocumentType.SOURCE_OF_FUNDS_WEALTH,
            DocumentType.FINANCIAL_STATEMENTS,
            DocumentType.REGISTRY_SEARCH_RESULT,
            DocumentType.WEB_SEARCH_RESULT,
            DocumentType.OTHER);

    /**
     * The document types that may be filed against a node of this type, or null for "no
     * restriction". Null rather than the full set so a caller can tell "everything is allowed"
     * from "these twelve happen to be everything" without comparing sets.
     */
    public Set<DocumentType> acceptedDocumentTypes() {
        return switch (this) {
            case PRIVATE_COMPANY -> PRIVATE_COMPANY_DOCUMENTS;
            case TRUST -> TRUST_DOCUMENTS;
            case TRUSTEE_COMPANY -> TRUSTEE_COMPANY_DOCUMENTS;
            case LIMITED_PARTNERSHIP -> LIMITED_PARTNERSHIP_DOCUMENTS;
            case PARTNERSHIP -> PARTNERSHIP_DOCUMENTS;
            case LISTED_COMPANY -> LISTED_COMPANY_DOCUMENTS;
            case INCORPORATED_SOCIETY -> INCORPORATED_SOCIETY_DOCUMENTS;
            case CHARITY -> CHARITY_DOCUMENTS;
            case GOVERNMENT_AGENCY -> GOVERNMENT_AGENCY_DOCUMENTS;
            case DECEASED_ESTATE -> DECEASED_ESTATE_DOCUMENTS;
            case INDIVIDUAL -> INDIVIDUAL_DOCUMENTS;
            // OTHER stays unrestricted: it exists precisely because nobody could say in advance
            // what it holds, so an allowlist for it would be a guess with teeth.
            case OTHER -> null;
        };
    }

    /** Whether this node will accept the given document. Unrestricted types accept anything. */
    public boolean accepts(DocumentType type) {
        Set<DocumentType> allowed = acceptedDocumentTypes();
        return allowed == null || allowed.contains(type);
    }
}
