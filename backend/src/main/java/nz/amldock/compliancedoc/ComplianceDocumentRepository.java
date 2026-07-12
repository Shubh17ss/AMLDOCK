package nz.amldock.compliancedoc;

import nz.amldock.document.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ComplianceDocumentRepository extends JpaRepository<ComplianceDocument, Long> {

    List<ComplianceDocument> findAllByCategoryAndRealEstateFirmIdAndStatusOrderByVersionNoDesc(
            ComplianceDocCategory category, Long realEstateFirmId, DocumentStatus status);

    List<ComplianceDocument> findAllByCategoryAndRealEstateFirmIdIsNullAndStatusOrderByVersionNoDesc(
            ComplianceDocCategory category, DocumentStatus status);

    Optional<ComplianceDocument> findTopByCategoryAndRealEstateFirmIdOrderByVersionNoDesc(
            ComplianceDocCategory category, Long realEstateFirmId);

    Optional<ComplianceDocument> findTopByCategoryAndRealEstateFirmIdIsNullOrderByVersionNoDesc(
            ComplianceDocCategory category);
}
