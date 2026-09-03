package nz.amldock.document;

import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.version.DealVersionDocumentRepository;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructureRepository;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Deleting a document must not reach into a version that was signed off with it.
 *
 * <p>The DB row was always kept — {@code delete} sets it {@code DELETED} rather than removing it —
 * so a version's own copy of the metadata was never in danger. The bytes were: {@code delete}
 * removed the S3 object outright, which would have left every past version listing a document it
 * could not produce, and a sign-off that could name the passport it checked but not show it.
 *
 * <p>Versions share one object rather than each holding a copy, because a key carries a UUID and
 * is therefore written once and never overwritten. What that arrangement costs is this one guard,
 * and these are the tests that hold it in place.
 */
@ExtendWith(MockitoExtension.class)
class DocumentVersionRetentionTest {

    static final Long DEAL_ID = 42L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 1L;
    static final Long USER_ID = 20L;
    static final Long DOC_ID = 9L;
    static final String S3_KEY = "deals/42/a1b2c3-passport.pdf";

    @Mock DocumentRepository documents;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock OwnershipNodeRepository ownershipNodes;
    @Mock OwnershipStructureRepository ownershipStructures;
    @Mock UserRepository users;
    @Mock FileStorageService storage;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;
    @Mock DealVersionDocumentRepository versionDocuments;

    DocumentService service;

    @BeforeEach
    void setUp() {
        service = new DocumentService(documents, deals, branches, ownershipNodes, ownershipStructures,
                users, storage, new DealLifecycleService(), beneficialOwners, audit,
                versionDocuments, 26214400L, 5L, 5L);

        // REVIEW, because that is the status a reopened deal is in — the only one in which a
        // reviewer can delete a document that an earlier version already froze.
        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);
        deal.setStatus(DealStatus.REVIEW);
        deal.setCreatedByUserId(123L);

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(USER_ID, "officer@firm.nz", "Officer",
                                Role.AML_COMPLIANCE_OFFICER, FIRM_ID, BRANCH_ID, true),
                        null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    /**
     * The case the whole guard exists for: verify, reopen, delete. The document leaves the live
     * deal, and the version that was signed off with it can still produce it.
     */
    @Test
    void aDocumentAVersionStillNamesKeepsItsBytes() {
        Document doc = activeDocument();
        when(versionDocuments.existsBySourceDocumentId(DOC_ID)).thenReturn(true);

        service.delete(DOC_ID);

        verify(storage, never()).delete(S3_KEY);
        assertThat(doc.getStatus())
                .as("it still leaves the live deal — listForDeal filters on ACTIVE")
                .isEqualTo(DocumentStatus.DELETED);
    }

    /**
     * And the guard is narrow. A document no sign-off refers to is deleted as it always was —
     * this is not a licence to keep every object forever.
     */
    @Test
    void aDocumentNoVersionNamesIsStillRemovedFromS3() {
        Document doc = activeDocument();
        when(versionDocuments.existsBySourceDocumentId(DOC_ID)).thenReturn(false);

        service.delete(DOC_ID);

        verify(storage).delete(S3_KEY);
        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.DELETED);
    }

    /** Deleting twice is still a no-op, and still asks S3 for nothing. */
    @Test
    void deletingAnAlreadyDeletedDocumentTouchesNothing() {
        Document doc = activeDocument();
        doc.setStatus(DocumentStatus.DELETED);

        service.delete(DOC_ID);

        verify(storage, never()).delete(S3_KEY);
        verify(versionDocuments, never()).existsBySourceDocumentId(DOC_ID);
    }

    private Document activeDocument() {
        Document d = new Document();
        ReflectionTestUtils.setField(d, "id", DOC_ID);
        ReflectionTestUtils.setField(d, "createdAt", Instant.now());
        ReflectionTestUtils.setField(d, "updatedAt", Instant.now());
        d.setS3Key(S3_KEY);
        d.setOriginalFilename("passport.pdf");
        d.setDealId(DEAL_ID);
        d.setStatus(DocumentStatus.ACTIVE);
        d.setUploadedByUserId(123L);
        when(documents.findById(DOC_ID)).thenReturn(Optional.of(d));
        return d;
    }
}
