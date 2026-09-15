package nz.amldock.deal.access.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

/**
 * Adds several people at once. A set rather than one id per call because the picker is a
 * multi-select and a half-applied batch is a worse outcome than a rejected one.
 */
public record AddDealUsersRequest(@NotEmpty Set<Long> userIds) {}
