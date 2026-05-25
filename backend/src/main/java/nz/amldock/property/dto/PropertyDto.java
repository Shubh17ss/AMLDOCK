package nz.amldock.property.dto;

import nz.amldock.property.Property;

import java.math.BigDecimal;

public record PropertyDto(
        Long id,
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
) {
    public static PropertyDto from(Property p) {
        return new PropertyDto(p.getId(), p.getAddressLine1(), p.getAddressLine2(),
                p.getSuburb(), p.getDistrict(), p.getRegion(), p.getCountry(), p.getPostcode(),
                p.getTitleReference(), p.getLegalDescription(), p.getLandAreaSqm());
    }
}
