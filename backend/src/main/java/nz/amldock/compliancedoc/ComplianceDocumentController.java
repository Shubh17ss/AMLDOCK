package nz.amldock.compliancedoc;

import jakarta.validation.Valid;
import nz.amldock.compliancedoc.dto.ComplianceDocumentDto;
import nz.amldock.compliancedoc.dto.ComplianceUploadUrlRequest;
import nz.amldock.document.dto.ConfirmUploadRequest;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/compliance-documents")
public class ComplianceDocumentController {

    private final ComplianceDocumentService documents;

    public ComplianceDocumentController(ComplianceDocumentService documents) {
        this.documents = documents;
    }

    @PostMapping("/upload-url")
    public UploadUrlResponse presignUpload(@Valid @RequestBody ComplianceUploadUrlRequest req) {
        return documents.presignUpload(req);
    }

    @PostMapping("/confirm")
    public ComplianceDocumentDto confirmUpload(@Valid @RequestBody ConfirmUploadRequest req) {
        return documents.confirmUpload(req.documentId());
    }

    @GetMapping
    public List<ComplianceDocumentDto> list(@RequestParam ComplianceDocCategory category,
                                            @RequestParam(required = false) Long firmId,
                                            @RequestParam(required = false) Long branchId) {
        return documents.list(category, firmId, branchId);
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(@PathVariable Long id) {
        return documents.presignDownload(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        documents.delete(id);
        return ResponseEntity.noContent().build();
    }
}
