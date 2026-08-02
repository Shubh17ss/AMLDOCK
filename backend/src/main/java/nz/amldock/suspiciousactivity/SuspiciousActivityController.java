package nz.amldock.suspiciousactivity;

import jakarta.validation.Valid;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.suspiciousactivity.dto.CreateSuspiciousActivityRequest;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityDto;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityUploadUrlRequest;
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
@RequestMapping("/api/suspicious-activities")
public class SuspiciousActivityController {

    private final SuspiciousActivityService activities;

    public SuspiciousActivityController(SuspiciousActivityService activities) {
        this.activities = activities;
    }

    @GetMapping
    public List<SuspiciousActivityDto> list(@RequestParam(required = false) Long firmId,
                                            @RequestParam(required = false) Long branchId) {
        return activities.list(firmId, branchId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public SuspiciousActivityDto create(@Valid @RequestBody CreateSuspiciousActivityRequest req) {
        return activities.create(req);
    }

    @PostMapping("/{id}/upload-url")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public UploadUrlResponse presignUpload(@PathVariable Long id,
                                           @Valid @RequestBody SuspiciousActivityUploadUrlRequest req) {
        return activities.presignUpload(id, req);
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public SuspiciousActivityDto confirmUpload(@PathVariable Long id) {
        return activities.confirmUpload(id);
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(@PathVariable Long id) {
        return activities.presignDownload(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        activities.delete(id);
        return ResponseEntity.noContent().build();
    }
}
