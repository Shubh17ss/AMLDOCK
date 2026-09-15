package nz.amldock.deal.access.dto;

import nz.amldock.user.Role;

/**
 * One person who can open this deal.
 *
 * <p>Covers both ways in, and says which: the broker who created it holds access by authorship and
 * cannot be removed, while everyone else on the list was added and can be taken off again. A tab
 * that showed only the added ones would read as though the creator had somehow lost their own deal.
 */
public record DealUserDto(
        Long userId,
        String fullName,
        String email,
        Role role,
        /** True for the deal's author. Their access is not a grant and there is nothing to revoke. */
        boolean creator
) {}
