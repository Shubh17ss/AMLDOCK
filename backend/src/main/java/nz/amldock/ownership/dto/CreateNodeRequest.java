package nz.amldock.ownership.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NomineeStatus;
import nz.amldock.ownership.TrustHoldingComplexity;
import nz.amldock.ownership.TrustType;
import nz.amldock.ownership.PersonRole;

import java.time.LocalDate;

public record CreateNodeRequest(
        @NotNull NodeType nodeType,
        @NotBlank String displayName,

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

        PersonRole personRole,
        String reference,
        /** Free-text notes on the node. The create dialog has always shown this field; until
         *  V34 the request had nowhere to put it and it was silently discarded. */
        String notes,

        /**
         * Details for the person behind an INDIVIDUAL. The person record itself is created by
         * the service — an individual always has one — so this only fills it in.
         */
        @Valid PersonPatch person
) {}
