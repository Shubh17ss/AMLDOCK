package nz.amldock.document;

import jakarta.validation.Valid;
import nz.amldock.document.dto.ConfirmUploadRequest;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlRequest;
import nz.amldock.document.dto.UploadUrlResponse;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documents;

    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @PostMapping("/upload-url")
    public UploadUrlResponse presignUpload(@Valid @RequestBody UploadUrlRequest req) {
        return documents.presignUpload(req);
    }

    @PostMapping("/confirm")
    public DocumentDto confirmUpload(@Valid @RequestBody ConfirmUploadRequest req) {
        return documents.confirmUpload(req.documentId());
    }

    @GetMapping
    public List<DocumentDto> list(@RequestParam(required = false) Long dealId,
                                  @RequestParam(required = false) Long nodeId) {
        if (nodeId != null) return documents.listForNode(nodeId);
        if (dealId != null) return documents.listForDeal(dealId);
        return List.of();
    }

    @GetMapping("/{id}")
    public DocumentDto get(@PathVariable Long id) {
        return documents.get(id);
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(@PathVariable Long id) {
        return documents.presignDownload(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        documents.delete(id);
        return ResponseEntity.noContent().build();
    }
}
