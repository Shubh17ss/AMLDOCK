package nz.amldock.property.dto;

import java.math.BigDecimal;

/** Used both at deal creation (initial property fields) and via PATCH /deals/{id}/property. */
public record PropertyInput(
        String addressLine1,
        String addressLine2,
        String suburb,
        String district,
        String region,
        String country,
        String postcode,
        String titleReference,
        String legalDescription,
        BigDecimal landAreaSqm
) {}
