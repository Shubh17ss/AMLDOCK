package nz.amldock.individual;

import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.PersonRole;

import java.time.LocalDate;

/**
 * One natural person on one deal, as the CDD registers list them.
 *
 * <p>A person on two deals is two rows, deliberately. The registers answer "who has this branch
 * done diligence on, and against which file", and the file is half the answer — collapsing the
 * duplicates would hide that the same person turned up twice, which is the more interesting fact.
 *
 * <p>{@code nodeId} rather than a person id is the identity here, for the same reason: the row is
 * a node, and a node whose person record has been removed out from under it is still a row the
 * register must show.
 */
public record IndividualRowDto(
        Long nodeId,
        Long dealId,
        String dealReference,
        String propertyAddress,
        String displayName,
        LocalDate dateOfBirth,
        /** ISO 3166-1 alpha-2, or null when nobody has been asked. */
        String countryOfResidence,
        PersonRole personRole,
        NodeVerificationStatus verificationStatus
) {}
