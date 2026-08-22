package nz.amldock.property.dto;

import jakarta.validation.constraints.Size;
import nz.amldock.property.PropertyType;

import java.math.BigDecimal;

/** Used both at deal creation (initial property fields) and via PATCH /deals/{id}/property. */
public record PropertyInput(
        String addressLine1,
        String addressLine2,
        String suburb,
        String district,
        String region,
        // No country. It is copied from the deal's reporting entity by DealService, so accepting
        // one here would let a client state a property's jurisdiction — a compliance fact that
        // is not theirs to assert.
        String postcode,
        String titleReference,
        String legalDescription,
        BigDecimal landAreaSqm,
        PropertyType propertyType,
        /**
         * Reason-for-selling code. Its valid set depends on propertyType and is owned by
         * frontend/src/data/propertyTypes.js, so it is deliberately not validated against a
         * fixed list here — a flat check could not express the dependency.
         */
        @Size(max = 64) String reasonForSelling
) {}
