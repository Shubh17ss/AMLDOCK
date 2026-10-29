package nz.amldock.fundtransaction;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.fundtransaction.dto.FundTransactionUploadUrlRequest;
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

/**
 * F3: asking for a new upload URL used to delete the entry's confirmed evidence for anyone in the
 * firm, FINANCE included, with no audit row. Replacing an ACTIVE attachment now needs the same
 * right as deleting it, and is audited.
 */
@ExtendWith(MockitoExtension.class)
class FundTransactionReplaceTest {

    static final Long ENTRY_ID = 9L;
    static final Long FIRM = 1L;
    static final String OLD_KEY = "fund-transactions/firms/1/9/old-statement.pdf";

    @Mock InternationalFundTransactionRepository transactions;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;

    InternationalFundTransactionService service;
    InternationalFundTransaction entry;

    final FundTransactionUploadUrlRequest req =
            new FundTransactionUploadUrlRequest("new.pdf", "application/pdf", 1024L);

    @BeforeEach
    void setUp() {
        service = new InternationalFundTransactionService(transactions, users, branches, storage, audit,
                26214400L, 5L, 5L);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void financeCannotReplaceAConfirmedDocument() {
        entry(DocumentStatus.ACTIVE, OLD_KEY);
        signedInAs(Role.FINANCE);

        assertThatThrownBy(() -> service.presignUpload(ENTRY_ID, req))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("delete rights");
        verify(storage, never()).delete(any());
        verify(storage, never()).presignIncomingUpload(any(), any(), any());
        verifyNoInteractions(audit);
        assertThat(entry.getS3Key()).isEqualTo(OLD_KEY);
        assertThat(entry.getDocumentStatus()).isEqualTo(DocumentStatus.ACTIVE);
    }

    @Test
    void aDeleterMayReplaceItAndTheReplaceIsAudited() {
        entry(DocumentStatus.ACTIVE, OLD_KEY);
        signedInAs(Role.SENIOR_MANAGER);
        when(storage.presignIncomingUpload(anyString(), anyString(), any())).thenReturn("https://s3/put");

        service.presignUpload(ENTRY_ID, req);

        verify(audit).record(eq(AuditAction.DOCUMENT_DELETED), any(), eq(ENTRY_ID), any());
        verify(storage).delete(OLD_KEY);
        assertThat(entry.getDocumentStatus()).isEqualTo(DocumentStatus.PENDING);
    }

    @Test
    void financeMayRestartAnUnconfirmedUpload() {
        entry(DocumentStatus.PENDING, OLD_KEY);
        signedInAs(Role.FINANCE);
        when(storage.presignIncomingUpload(anyString(), anyString(), any())).thenReturn("https://s3/put");

        service.presignUpload(ENTRY_ID, req);

        verify(storage).delete(OLD_KEY);
        verifyNoInteractions(audit);
    }

    @Test
    void financeMayAttachTheFirstDocument() {
        entry(null, null);
        signedInAs(Role.FINANCE);
        when(storage.presignIncomingUpload(anyString(), anyString(), any())).thenReturn("https://s3/put");

        assertThat(service.presignUpload(ENTRY_ID, req)).isNotNull();
        verify(storage, never()).delete(any());
    }

    private void entry(DocumentStatus status, String s3Key) {
        entry = new InternationalFundTransaction();
        ReflectionTestUtils.setField(entry, "id", ENTRY_ID);
        entry.setRealEstateFirmId(FIRM);
        entry.setDocumentStatus(status);
        entry.setS3Key(s3Key);
        entry.setOriginalFilename(s3Key == null ? null : "old-statement.pdf");
        entry.setCreatedByUserId(50L);
        when(transactions.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
    }

    private static void signedInAs(Role role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "someone@firm.nz", null, role, FIRM, null, true),
                        null, List.of()));
    }
}
