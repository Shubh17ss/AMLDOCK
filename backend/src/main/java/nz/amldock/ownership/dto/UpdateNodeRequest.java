package nz.amldock.ownership.dto;

import jakarta.validation.Valid;
import nz.amldock.ownership.NodeType;
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

        String nzbn,
        String companyNumber,
        LocalDate incorporationDate,
        String registeredOffice,

        String trustName,
        Long trustDeedDocumentId,
        String settlorName,

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
