package nz.amldock.ownership.dto;

import nz.amldock.ownership.NodeType;

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

        String extraJson
) {}
