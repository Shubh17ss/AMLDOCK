package nz.amldock.compliancedoc;

import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.compliancedoc.dto.ComplianceDocumentDto;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Confirming an upload must check the document's firm before anything is returned. The
 * idempotent ACTIVE return used to come first, leaking another firm's compliance-document
 * metadata by id (security audit C-11).
 */
@ExtendWith(MockitoExtension.class)
class ComplianceDocumentConfirmScopeTest {

    static final Long DOC_ID = 9L;
    static final Long OWN_FIRM = 1L;
    static final Long OTHER_FIRM = 2L;

    @Mock ComplianceDocumentRepository docs;
    @Mock DocumentReviewRepository reviews;
    @Mock UserRepository users;
    @Mock FirmBranchRepository branches;
    @Mock FileStorageService storage;
    @Mock AuditService audit;

    ComplianceDocumentService service;

    @BeforeEach
    void setUp() {
        service = new ComplianceDocumentService(docs, reviews, users, branches, storage, audit,
                26214400L, 5L, 5L);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anotherFirmsActiveDocumentIsRefusedNotReturned() {
        document(OTHER_FIRM, DocumentStatus.ACTIVE);
        signedInAs(Role.SENIOR_MANAGER, OWN_FIRM);

        assertThatThrownBy(() -> service.confirmUpload(DOC_ID)).isInstanceOf(ForbiddenException.class);
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void ownFirmsActiveDocumentIsStillIdempotent() {
        document(OWN_FIRM, DocumentStatus.ACTIVE);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);

        ComplianceDocumentDto dto = service.confirmUpload(DOC_ID);

        assertThat(dto).isNotNull();
        verify(storage, never()).promoteUpload(any());
    }

    @Test
    void rootStillSeesEveryFirm() {
        document(OTHER_FIRM, DocumentStatus.ACTIVE);
        signedInAs(Role.ROOT, null);

        assertThat(service.confirmUpload(DOC_ID)).isNotNull();
    }

    /** F4: AUDIT reads every firm's register but must not activate an upload in any of them. */
    @Test
    void auditorCannotConfirmAnUpload() {
        document(OTHER_FIRM, DocumentStatus.PENDING);
        signedInAs(Role.AUDIT, null);

        assertThatThrownBy(() -> service.confirmUpload(DOC_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("read-only");
        verify(storage, never()).promoteUpload(any());
    }

    /** F4: nor open one: no version row is created and no upload URL is issued. */
    @Test
    void auditorCannotRequestAnUploadUrl() {
        signedInAs(Role.AUDIT, null);
        var req = new nz.amldock.compliancedoc.dto.ComplianceUploadUrlRequest(
                ComplianceDocCategory.values()[0], "Forged programme", null,
                "programme.pdf", "application/pdf", 1024L, OTHER_FIRM, null);

        assertThatThrownBy(() -> service.presignUpload(req))
                .isInstanceOf(ForbiddenException.class);
        verify(docs, never()).save(any());
        verify(storage, never()).presignIncomingUpload(any(), any(), any());
    }

    /** F7: confirm reads the staged upload; with nothing staged the document stays PENDING. */
    @Test
    void confirmWithNothingUploadedLeavesItPending() {
        document(OWN_FIRM, DocumentStatus.PENDING);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);
        when(storage.promoteUpload(any())).thenReturn(java.util.OptionalLong.empty());

        assertThatThrownBy(() -> service.confirmUpload(DOC_ID))
                .hasMessageContaining("Object not found in S3 yet");
        verify(audit, never()).record(any(), any(), any(), any());
    }

    private void document(Long firmId, DocumentStatus status) {
        ComplianceDocument d = new ComplianceDocument();
        ReflectionTestUtils.setField(d, "id", DOC_ID);
        d.setRealEstateFirmId(firmId);
        d.setStatus(status);
        d.setS3Key("compliance/" + firmId + "/policy.pdf");
        d.setUploadedByUserId(50L);
        when(docs.findById(DOC_ID)).thenReturn(Optional.of(d));
    }

    private static void signedInAs(Role role, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "someone@firm.nz", "Someone", role, firmId, null, true),
                        null, List.of()));
    }
}
