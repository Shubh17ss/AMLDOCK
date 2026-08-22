package nz.amldock.ownership.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.PersonRole;

import java.time.LocalDate;

public record CreateNodeRequest(
        @NotNull NodeType nodeType,
        @NotBlank String displayName,

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
