package nz.amldock.ownership.dto;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.ReviewStatus;

import java.time.LocalDate;

/**
 * The person behind an INDIVIDUAL node, as they are known to the whole firm.
 *
 * <p>Nested inside {@link NodeDto} rather than flattened into it, and that is the point: every
 * field in here is shared with every other deal this person appears on, and a payload that says
 * so is harder to misread than one where {@code occupation} sits between two per-deal fields.
 *
 * <p>Name, date of birth and expiry may have been read off a scan rather than typed. Nulls travel
 * as nulls — "not determined" is a distinct answer from "empty".
 */
public record PersonDto(
        Long id,
        String fullName,
        String email,
        /** ISO 3166-1 alpha-2, paired with {@link #phoneNumber}. */
        String phoneCountry,
        String phoneNumber,
        String occupation,
        String sourceOfFunds,

        LocalDate dateOfBirth,
        LocalDate idExpiryDate,
        ReviewStatus reviewStatus) {

    public static PersonDto from(BeneficialOwner o) {
        return new PersonDto(
                o.getId(), o.getFullName(), o.getEmail(), o.getPhoneCountry(), o.getPhoneNumber(),
                o.getOccupation(), o.getSourceOfFunds(),
                o.getDateOfBirth(), o.getIdExpiryDate(), o.getReviewStatus());
    }
}
