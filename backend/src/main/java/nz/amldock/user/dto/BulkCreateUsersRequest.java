package nz.amldock.user.dto;

import java.util.List;

/**
 * Bulk user import payload. The firm context comes from the screen the importer is on:
 * ROOT supplies {@code realEstateFirmId}; for every other role it is ignored and forced to the
 * importer's own firm. Each row's {@code role} and {@code branchName} are raw strings so the
 * service can normalise them and report friendly, row-level errors.
 */
public record BulkCreateUsersRequest(
        Long realEstateFirmId,
        List<Row> rows
) {
    public record Row(String fullName, String email, String role, String branchName) {}
}
