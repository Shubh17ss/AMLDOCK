package nz.amldock.training;

import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * F8: course material goes to the people the course is for (its assignees) and to those who run
 * or audit the register, nobody else in the firm. Every refusal looks the same as "no such file",
 * so sequential ids can't be used to map what exists.
 */
@ExtendWith(MockitoExtension.class)
class TrainingCourseDownloadTest {

    static final Long FIRM = 1L;
    static final Long OTHER_FIRM = 2L;
    static final Long COURSE = 5L;
    static final Long OTHER_COURSE = 6L;
    static final Long FILE = 50L;
    static final Long ASSIGNED_AGENT = 70L;
    static final Long UNASSIGNED_AGENT = 71L;

    @Mock TrainingCourseRepository courses;
    @Mock TrainingCourseFileRepository files;
    @Mock TrainingCourseQuestionRepository questions;
    @Mock TrainingCourseQuestionOptionRepository options;
    @Mock TrainingCourseAssigneeRepository assignees;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;
    @Mock TrainingNotifier notifier;

    TrainingCourseService service;

    @BeforeEach
    void setUp() {
        service = new TrainingCourseService(courses, files, questions, options, assignees, users,
                branches, storage, audit, notifier, 26214400L, 5L, 5L);

        lenient().when(courses.findById(COURSE)).thenReturn(Optional.of(course(COURSE, FIRM)));
        lenient().when(courses.findById(OTHER_COURSE)).thenReturn(Optional.of(course(OTHER_COURSE, OTHER_FIRM)));
        lenient().when(courses.findById(99L)).thenReturn(Optional.empty());
        lenient().when(files.findById(FILE)).thenReturn(Optional.of(file(FILE, COURSE)));
        lenient().when(files.findById(51L)).thenReturn(Optional.of(file(51L, OTHER_COURSE)));
        lenient().when(files.findById(999L)).thenReturn(Optional.empty());
        // Only ASSIGNED_AGENT is on COURSE.
        lenient().when(assignees.findByTrainingCourseIdAndUserId(any(), any()))
                .thenAnswer(inv -> ASSIGNED_AGENT.equals(inv.getArgument(1)) && COURSE.equals(inv.getArgument(0))
                        ? Optional.of(new TrainingCourseAssignee()) : Optional.empty());
        lenient().when(storage.presignDownload(anyString(), anyString(), any())).thenReturn("https://s3/get");
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- who may download ---------- */

    @Test
    void anAssignedAgentGetsTheFile() {
        signedInAs(Role.AGENT, FIRM, ASSIGNED_AGENT);
        assertThat(service.presignDownload(COURSE, FILE).downloadUrl()).isEqualTo("https://s3/get");
    }

    @Test
    void aManagerGetsTheFileWithoutBeingAssigned() {
        signedInAs(Role.SENIOR_MANAGER, FIRM, 80L);
        assertThat(service.presignDownload(COURSE, FILE)).isNotNull();
    }

    @Test
    void theAuditorGetsTheFile() {
        signedInAs(Role.AUDIT, null, 81L);
        assertThat(service.presignDownload(COURSE, FILE)).isNotNull();
    }

    /* ---------- who may not ---------- */

    @Test
    void anUnassignedAgentInTheSameFirmIsRefused() {
        signedInAs(Role.AGENT, FIRM, UNASSIGNED_AGENT);

        assertThatThrownBy(() -> service.presignDownload(COURSE, FILE))
                .isInstanceOf(NotFoundException.class).hasMessage("File not found");
        verify(storage, never()).presignDownload(any(), any(), any());
        verifyNoInteractions(audit);
    }

    @Test
    void financeIsRefused() {
        signedInAs(Role.FINANCE, FIRM, 72L);

        assertThatThrownBy(() -> service.presignDownload(COURSE, FILE))
                .isInstanceOf(NotFoundException.class).hasMessage("File not found");
    }

    /** Every way of not getting the file reads the same, so ids can't be probed. */
    @Test
    void everyRefusalLooksLikeNoSuchFile() {
        signedInAs(Role.AGENT, FIRM, UNASSIGNED_AGENT);
        Throwable notAssigned = catchThrowable(() -> service.presignDownload(COURSE, FILE));
        Throwable otherFirm = catchThrowable(() -> service.presignDownload(OTHER_COURSE, 51L));
        Throwable noCourse = catchThrowable(() -> service.presignDownload(99L, FILE));

        SecurityContextHolder.clearContext();
        signedInAs(Role.SENIOR_MANAGER, FIRM, 80L);
        Throwable noFile = catchThrowable(() -> service.presignDownload(COURSE, 999L));
        Throwable wrongCourse = catchThrowable(() -> service.presignDownload(COURSE, 51L));

        for (Throwable t : List.of(notAssigned, otherFirm, noCourse, noFile, wrongCourse)) {
            assertThat(t).isInstanceOf(NotFoundException.class).hasMessage("File not found");
        }
    }

    /* ---------- F7 on this flow: confirm with nothing uploaded ---------- */

    @Test
    void confirmWithNothingUploadedLeavesItPending() {
        signedInAs(Role.SENIOR_MANAGER, FIRM, 80L);
        TrainingCourseFile pending = file(52L, COURSE);
        pending.setDocumentStatus(DocumentStatus.PENDING);
        when(files.findById(52L)).thenReturn(Optional.of(pending));
        when(storage.promoteUpload(any())).thenReturn(java.util.OptionalLong.empty());

        assertThatThrownBy(() -> service.confirmUpload(COURSE, 52L))
                .hasMessageContaining("Object not found in S3 yet");
        assertThat(pending.getDocumentStatus()).isEqualTo(DocumentStatus.PENDING);
    }

    /* ---------- helpers ---------- */

    private static TrainingCourse course(Long id, Long firmId) {
        TrainingCourse c = new TrainingCourse();
        ReflectionTestUtils.setField(c, "id", id);
        c.setRealEstateFirmId(firmId);
        c.setName("Course " + id);
        return c;
    }

    private static TrainingCourseFile file(Long id, Long courseId) {
        TrainingCourseFile f = new TrainingCourseFile();
        ReflectionTestUtils.setField(f, "id", id);
        f.setTrainingCourseId(courseId);
        f.setS3Key("training/" + courseId + "/" + id + "-slides.pdf");
        f.setOriginalFilename("slides.pdf");
        f.setDocumentStatus(DocumentStatus.ACTIVE);
        return f;
    }

    private static void signedInAs(Role role, Long firmId, Long userId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(userId, "u" + userId + "@firm.nz", null, role, firmId,
                                role.requiresBranch() ? 10L : null, true),
                        null, List.of()));
    }
}
