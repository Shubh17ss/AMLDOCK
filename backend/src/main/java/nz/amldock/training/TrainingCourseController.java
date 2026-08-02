package nz.amldock.training;

import jakarta.validation.Valid;
import nz.amldock.document.dto.DownloadUrlResponse;
import nz.amldock.document.dto.UploadUrlResponse;
import nz.amldock.training.dto.CourseAttemptResultDto;
import nz.amldock.training.dto.CreateTrainingCourseRequest;
import nz.amldock.training.dto.SubmitCourseAttemptRequest;
import nz.amldock.training.dto.TrainingCourseDto;
import nz.amldock.training.dto.TrainingCourseFileDto;
import nz.amldock.training.dto.TrainingCourseFileUploadUrlRequest;
import nz.amldock.training.dto.UpdateTrainingCourseRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * AML Training › Courses.
 *
 * Like /api/training-sessions this path is NOT locked to the training managers in
 * SecurityConfig: branch staff need GET and file download for the course-taker experience.
 * Every authoring action is gated per method below.
 */
@RestController
@RequestMapping("/api/training-courses")
public class TrainingCourseController {

    private final TrainingCourseService courses;

    public TrainingCourseController(TrainingCourseService courses) {
        this.courses = courses;
    }

    /** Role-aware: managers get the catalogue, staff get their own assignments. */
    @GetMapping
    public List<TrainingCourseDto> list(@RequestParam(required = false) Long firmId,
                                        @RequestParam(required = false) Long branchId) {
        return courses.list(firmId, branchId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingCourseDto create(@Valid @RequestBody CreateTrainingCourseRequest req) {
        return courses.create(req);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingCourseDto update(@PathVariable Long id,
                                    @Valid @RequestBody UpdateTrainingCourseRequest req) {
        return courses.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courses.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * The signed-in user sits (or re-sits) the assessment.
     *
     * No @PreAuthorize, matching POST /api/training-sessions/{id}/complete — the caller has to be
     * an assignee, which the service checks, and training managers are never assignees.
     */
    @PostMapping("/{id}/attempt")
    public CourseAttemptResultDto submitAttempt(@PathVariable Long id,
                                                @Valid @RequestBody SubmitCourseAttemptRequest req) {
        return courses.submitAttempt(id, req);
    }

    /* ---------- content files ---------- */

    @PostMapping("/{id}/files/upload-url")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public UploadUrlResponse presignUpload(@PathVariable Long id,
                                           @Valid @RequestBody TrainingCourseFileUploadUrlRequest req) {
        return courses.presignUpload(id, req);
    }

    @PostMapping("/{id}/files/{fileId}/confirm")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingCourseFileDto confirmUpload(@PathVariable Long id, @PathVariable Long fileId) {
        return courses.confirmUpload(id, fileId);
    }

    /** Open to anyone in scope — a course taker has to be able to read the material. */
    @GetMapping("/{id}/files/{fileId}/download-url")
    public DownloadUrlResponse downloadUrl(@PathVariable Long id, @PathVariable Long fileId) {
        return courses.presignDownload(id, fileId);
    }

    @DeleteMapping("/{id}/files/{fileId}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public ResponseEntity<Void> deleteFile(@PathVariable Long id, @PathVariable Long fileId) {
        courses.deleteFile(id, fileId);
        return ResponseEntity.noContent().build();
    }
}
