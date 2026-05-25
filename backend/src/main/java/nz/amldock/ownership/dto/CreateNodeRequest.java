package nz.amldock.ownership.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import nz.amldock.ownership.NodeType;

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

        String extraJson
) {}
