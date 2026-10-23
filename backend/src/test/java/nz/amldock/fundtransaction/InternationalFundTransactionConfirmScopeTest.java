package nz.amldock.fundtransaction;

import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.fundtransaction.dto.FundTransactionDto;
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
 * ACTIVE return used to come first, so a FINANCE user of one firm could read another firm's
 * register entry by id (security audit C-08).
 */
@ExtendWith(MockitoExtension.class)
class InternationalFundTransactionConfirmScopeTest {

    static final Long ENTRY_ID = 9L;
    static final Long OWN_FIRM = 1L;
    static final Long OTHER_FIRM = 2L;

    @Mock InternationalFundTransactionRepository transactions;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;

    InternationalFundTransactionService service;

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
    void anotherFirmsConfirmedEntryIsRefusedNotReturned() {
        entry(OTHER_FIRM, DocumentStatus.ACTIVE, "ift/2/statement.pdf");
        signedInAs(Role.FINANCE, OWN_FIRM);

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anotherFirmsEntryWithNoUploadIsRefusedRatherThanRevealed() {
        entry(OTHER_FIRM, null, null);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID)).isInstanceOf(ForbiddenException.class);
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void ownFirmsConfirmedEntryIsStillIdempotent() {
        entry(OWN_FIRM, DocumentStatus.ACTIVE, "ift/1/statement.pdf");
        signedInAs(Role.FINANCE, OWN_FIRM);

        FundTransactionDto dto = service.confirmUpload(ENTRY_ID);

        assertThat(dto).isNotNull();
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void platformRolesStillSeeEveryFirm() {
        entry(OTHER_FIRM, DocumentStatus.ACTIVE, "ift/2/statement.pdf");
        signedInAs(Role.ROOT, null);

        assertThat(service.confirmUpload(ENTRY_ID)).isNotNull();
    }

    /** F7: confirm reads the staged upload; with nothing staged the entry stays PENDING. */
    @Test
    void confirmWithNothingUploadedLeavesItPending() {
        entry(OWN_FIRM, DocumentStatus.PENDING, "ift/1/statement.pdf");
        signedInAs(Role.FINANCE, OWN_FIRM);
        when(storage.promoteUpload("ift/1/statement.pdf")).thenReturn(java.util.OptionalLong.empty());

        assertThatThrownBy(() -> service.confirmUpload(ENTRY_ID))
                .hasMessageContaining("Object not found in S3 yet");
        verify(audit, never()).record(any(), any(), any(), any());
    }

    private void entry(Long firmId, DocumentStatus status, String s3Key) {
        InternationalFundTransaction t = new InternationalFundTransaction();
        ReflectionTestUtils.setField(t, "id", ENTRY_ID);
        t.setRealEstateFirmId(firmId);
        t.setDocumentStatus(status);
        t.setS3Key(s3Key);
        t.setCreatedByUserId(50L);
        when(transactions.findById(ENTRY_ID)).thenReturn(Optional.of(t));
    }

    private static void signedInAs(Role role, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "someone@firm.nz", "Someone", role, firmId, null, true),
                        null, List.of()));
    }
}
