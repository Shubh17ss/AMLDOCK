package nz.amldock.ownership.dto;

import jakarta.validation.Valid;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NomineeStatus;
import nz.amldock.ownership.TrustHoldingComplexity;
import nz.amldock.ownership.TrustType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.PersonRole;

import java.time.LocalDate;

/** All fields optional — only non-null values are applied. */
public record UpdateNodeRequest(
        NodeType nodeType,
        String displayName,

        LocalDate dateOfBirth,
        String idDocumentType,
        String idDocumentNumber,
        String idDocumentCountry,

        String businessNumber,
        String companyNumber,
        LocalDate incorporationDate,
        String registeredOffice,

        String trustName,
        Long trustDeedDocumentId,
        String settlorName,

        /* ---- entity fields, shared where the question is the same (V35, V37) ---- */
        /** Country of incorporation, or jurisdiction for a type that is not incorporated. */
        String jurisdictionCountry,
        Boolean companyHasConstitution,
        /** Nominee director/shareholder, or nominee limited partner. YES raises risk to HIGH. */
        NomineeStatus nomineeStatus,
        /** TRUE raises the deal to HIGH risk. */
        Boolean companyComplexOwnership,
        Boolean companyPersonalAssets,
        Boolean companyNewDeveloper,

        /* ---- trust (V36) ---- */
        TrustType trustType,
        Boolean trustDiscretionary,
        /** EXTENSIVE_DIVERSE_PORTFOLIO raises the deal to HIGH risk. */
        TrustHoldingComplexity trustHoldingComplexity,

        /** Where an entity says its money comes from. Not the person-level field. */
        String sourceOfFunds,

        String extraJson,

        /** The capacity this individual appears in on this deal. */
        PersonRole personRole,
        /** Free text; the form prompts for a link to a previous deal. */
        String reference,

        /**
         * Changes to the shared person record. Applied to every deal this individual is on —
         * see {@link PersonPatch}. Ignored for nodes that have no person behind them.
         */
        @Valid PersonPatch person,

        /** Manual verification mark from the Verifications tab. */
        NodeVerificationStatus verificationStatus,
        /** General free-text notes on the node (Details tab). */
        String notes,
        /** Reasoning behind the manual verification mark (Verifications tab). */
        String verificationNotes
) {}
