package nz.amldock.suspiciousactivity;

import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityDto;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Confirming an upload must check the entry's firm before anything is returned. The idempotent
 * ACTIVE return used to come first, so any firm's compliance officer could read another firm's
 * suspicious-activity report by id (security audit C-03).
 */
@ExtendWith(MockitoExtension.class)
class SuspiciousActivityConfirmScopeTest {

    static final Long ENTRY_ID = 9L;
    static final Long OWN_FIRM = 1L;
    static final Long OTHER_FIRM = 2L;

    @Mock SuspiciousActivityRepository activities;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;

    SuspiciousActivityService service;

    @BeforeEach
    void setUp() {
        service = new SuspiciousActivityService(activities, users, branches, storage, audit, 26214400L, 5L, 5L);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anotherFirmsConfirmedEntryIsRefusedNotReturned() {
        entry(OTHER_FIRM, DocumentStatus.ACTIVE, "sar/2/report.pdf");
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anotherFirmsEntryWithNoUploadIsRefusedRatherThanRevealed() {
        // Was a 400 ("no upload started") ahead of the scope check: an existence oracle.
        entry(OTHER_FIRM, null, null);
        signedInAs(Role.SENIOR_MANAGER, OWN_FIRM);

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID)).isInstanceOf(ForbiddenException.class);
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void ownFirmsConfirmedEntryIsStillIdempotent() {
        entry(OWN_FIRM, DocumentStatus.ACTIVE, "sar/1/report.pdf");
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);

        SuspiciousActivityDto dto = service.confirmUpload(ENTRY_ID);

        assertThat(dto).isNotNull();
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void platformRolesStillSeeEveryFirm() {
        entry(OTHER_FIRM, DocumentStatus.ACTIVE, "sar/2/report.pdf");
        signedInAs(Role.ROOT, null);

        assertThat(service.confirmUpload(ENTRY_ID)).isNotNull();
    }

    /** F7: confirm reads the staged upload; with nothing staged the entry stays PENDING. */
    @Test
    void confirmWithNothingUploadedLeavesItPending() {
        entry(OWN_FIRM, DocumentStatus.PENDING, "sar/1/report.pdf");
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);
        when(storage.promoteUpload("sar/1/report.pdf")).thenReturn(java.util.OptionalLong.empty());

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID))
                .hasMessageContaining("Object not found in S3 yet");
        verify(audit, never()).record(any(), any(), any(), any());
    }

    private void entry(Long firmId, DocumentStatus status, String s3Key) {
        SuspiciousActivity s = new SuspiciousActivity();
        ReflectionTestUtils.setField(s, "id", ENTRY_ID);
        s.setRealEstateFirmId(firmId);
        s.setDocumentStatus(status);
        s.setS3Key(s3Key);
        s.setCreatedByUserId(50L);
        when(activities.findById(ENTRY_ID)).thenReturn(Optional.of(s));
    }

    private static void signedInAs(Role role, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "someone@firm.nz", "Someone", role, firmId, null, true),
                        null, List.of()));
    }
}
