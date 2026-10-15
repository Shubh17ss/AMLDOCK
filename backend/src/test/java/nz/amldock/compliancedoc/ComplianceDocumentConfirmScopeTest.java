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
        verify(storage, never()).exists(any());
    }

    @Test
    void ownFirmsActiveDocumentIsStillIdempotent() {
        document(OWN_FIRM, DocumentStatus.ACTIVE);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, OWN_FIRM);

        ComplianceDocumentDto dto = service.confirmUpload(DOC_ID);

        assertThat(dto).isNotNull();
        verify(storage, never()).exists(any());
    }

    @Test
    void platformRolesStillSeeEveryFirm() {
        document(OTHER_FIRM, DocumentStatus.ACTIVE);
        signedInAs(Role.AUDIT, null);

        assertThat(service.confirmUpload(DOC_ID)).isNotNull();
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
