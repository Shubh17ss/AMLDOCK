package nz.amldock.training.dto;

import nz.amldock.training.TrainingProvider;

import java.time.Instant;

public record TrainingProviderDto(
        Long id,
        String name,
        String email,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String createdByEmail,
        Instant createdAt
) {
    public static TrainingProviderDto from(TrainingProvider p, String branchName, String createdByEmail) {
        return new TrainingProviderDto(p.getId(), p.getName(), p.getEmail(),
                p.getRealEstateFirmId(), p.getFirmBranchId(), branchName,
                createdByEmail, p.getCreatedAt());
    }
}
