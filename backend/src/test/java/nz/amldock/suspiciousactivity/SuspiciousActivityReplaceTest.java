package nz.amldock.suspiciousactivity;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.suspiciousactivity.dto.SuspiciousActivityUploadUrlRequest;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** F3, suspicious-activity register: same rule as {@code FundTransactionReplaceTest}. */
@ExtendWith(MockitoExtension.class)
class SuspiciousActivityReplaceTest {

    static final Long ENTRY_ID = 9L;
    static final Long FIRM = 1L;
    static final String OLD_KEY = "suspicious-activities/firms/1/9/old.pdf";

    @Mock SuspiciousActivityRepository activities;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;

    SuspiciousActivityService service;
    SuspiciousActivity entry;

    final SuspiciousActivityUploadUrlRequest req =
            new SuspiciousActivityUploadUrlRequest("new.pdf", "application/pdf", 1024L);

    @BeforeEach
    void setUp() {
        service = new SuspiciousActivityService(activities, users, branches, storage, audit, 26214400L, 5L, 5L);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void aNonDeleterCannotReplaceAConfirmedDocument() {
        // Today SecurityConfig lets only deleters (and read-only AUDIT) reach this register, so this
        // pins the service rule for the day that list grows: any in-scope non-deleter is refused.
        entry(DocumentStatus.ACTIVE, OLD_KEY);
        signedInAs(Role.SALES_MANAGER);

        assertThatThrownBy(() -> service.presignUpload(ENTRY_ID, req))
                .isInstanceOf(ForbiddenException.class);
        verify(storage, never()).delete(any());
        verifyNoInteractions(audit);
        assertThat(entry.getS3Key()).isEqualTo(OLD_KEY);
    }

    @Test
    void aComplianceOfficerMayReplaceItAndTheReplaceIsAudited() {
        entry(DocumentStatus.ACTIVE, OLD_KEY);
        signedInAs(Role.AML_COMPLIANCE_OFFICER);
        when(storage.presignIncomingUpload(anyString(), anyString(), any())).thenReturn("https://s3/put");

        service.presignUpload(ENTRY_ID, req);

        verify(audit).record(eq(AuditAction.DOCUMENT_DELETED), any(), eq(ENTRY_ID), any());
        verify(storage).delete(OLD_KEY);
    }

    @Test
    void anUnconfirmedUploadMayBeRestarted() {
        entry(DocumentStatus.PENDING, OLD_KEY);
        signedInAs(Role.SALES_MANAGER);
        when(storage.presignIncomingUpload(anyString(), anyString(), any())).thenReturn("https://s3/put");

        service.presignUpload(ENTRY_ID, req);

        verify(storage).delete(OLD_KEY);
        verifyNoInteractions(audit);
    }

    private void entry(DocumentStatus status, String s3Key) {
        entry = new SuspiciousActivity();
        ReflectionTestUtils.setField(entry, "id", ENTRY_ID);
        entry.setRealEstateFirmId(FIRM);
        entry.setDocumentStatus(status);
        entry.setS3Key(s3Key);
        entry.setOriginalFilename("old.pdf");
        entry.setCreatedByUserId(50L);
        when(activities.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
    }

    private static void signedInAs(Role role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "someone@firm.nz", null, role, FIRM, null, true),
                        null, List.of()));
    }
}
