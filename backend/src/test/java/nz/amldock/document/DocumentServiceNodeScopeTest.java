package nz.amldock.document;

import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.document.dto.UploadUrlRequest;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import nz.amldock.deal.access.DealUserRepository;

/**
 * What a node's document list contains, and what confirming an upload against a node does.
 *
 * <p>Both answers changed in V34, and they are two halves of one decision: a document attached to
 * an ownership node is evidence about someone already in the structure. So the list shows that
 * person's ID scans even though those hang off the person rather than the node — and confirming
 * one does not invent a second person the way it does for a broker's scan.
 */
@ExtendWith(MockitoExtension.class)
class DocumentServiceNodeScopeTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 100L;
    static final Long STRUCTURE_ID = 20L;
    static final Long NODE_ID = 30L;
    static final Long PERSON_ID = 500L;
    static final Long USER_ID = 7L;

    @Mock DocumentRepository documents;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock OwnershipNodeRepository ownershipNodes;
    @Mock OwnershipStructureRepository ownershipStructures;
    @Mock UserRepository users;
    @Mock FileStorageService storage;
    // The real thing, not a mock: it has no dependencies, and the status rule these tests are
    // about lives inside it. A mocked lifecycle made the delete cases pass vacuously.
    final DealLifecycleService lifecycle = new DealLifecycleService(mock(DealUserRepository.class));
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;
    @Mock nz.amldock.deal.version.DealVersionDocumentRepository versionDocuments;

    DocumentService service;

    @BeforeEach
    void setUp() {
        service = new DocumentService(documents, deals, branches, ownershipNodes, ownershipStructures,
                users, storage, lifecycle, beneficialOwners, audit, versionDocuments, 26214400L, 5L, 5L);

        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);
        // Uploading is status-checked now (C-07); NEW is open to every uploader.
        deal.setStatus(DealStatus.NEW);
        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);

        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        structure.setDealId(DEAL_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));
        lenient().when(ownershipStructures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure));

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

    /* ---------- the merged list ---------- */

    @Test
    void anIndividualsListShowsTheirIdScansAsWellAsTheNodesOwnDocuments() {
        // The scans are linked to the person, not the node, so before V34 this tab was empty on
        // every extraction-created individual — which is most of them.
        stubNode(NodeType.INDIVIDUAL, PERSON_ID);
        when(documents.findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(NODE_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(doc(1L, "bank-statement.pdf", Instant.parse("2026-08-01T00:00:00Z"))));
        when(documents.findAllByBeneficialOwnerIdAndStatus(PERSON_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(doc(2L, "licence-front.jpg", Instant.parse("2026-08-05T00:00:00Z"))));

        List<DocumentDto> found = service.listForNode(NODE_ID);

        assertThat(found).extracting(DocumentDto::originalFilename)
                .containsExactly("licence-front.jpg", "bank-statement.pdf");   // newest first
    }

    @Test
    void aDocumentOnBothTheNodeAndThePersonAppearsOnce() {
        stubNode(NodeType.INDIVIDUAL, PERSON_ID);
        Document shared = doc(1L, "passport.jpg", Instant.parse("2026-08-01T00:00:00Z"));
        when(documents.findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(NODE_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(shared));
        when(documents.findAllByBeneficialOwnerIdAndStatus(PERSON_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(shared));

        assertThat(service.listForNode(NODE_ID)).hasSize(1);
    }

    @Test
    void anEntityNodeIsNotSearchedForAPersonsScans() {
        stubNode(NodeType.TRUST, null);
        when(documents.findAllByOwnershipNodeIdAndStatusOrderByCreatedAtDesc(NODE_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(doc(1L, "trust-deed.pdf", Instant.now())));

        assertThat(service.listForNode(NODE_ID)).hasSize(1);
        verify(documents, never()).findAllByBeneficialOwnerIdAndStatus(any(), any());
    }

    /* ---------- confirming an upload made against a node ---------- */

    @Test
    void anIdAttachedToANodeCreatesNoSecondIndividual() {
        // Attaching a passport to someone already in the structure is evidence about them. The
        // old behaviour created a whole new person on the deal, which is the opposite of that.
        Document doc = doc(9L, "passport.jpg", Instant.now());
        doc.setDocumentType(DocumentType.NZ_PASSPORT);
        doc.setStatus(DocumentStatus.PENDING);
        doc.setOwnershipNodeId(NODE_ID);
        doc.setUploadedByUserId(USER_ID);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        when(storage.exists(any())).thenReturn(true);
        when(storage.size(any())).thenReturn(doc.getSizeBytes());

        service.confirmUpload(9L);

        verify(beneficialOwners, never()).createProvisional(any());
        assertThat(doc.getBeneficialOwnerId()).isNull();
        // No person to write into, so a Textract call would be spend with nowhere to land.
        assertThat(doc.getOcrStatus()).isEqualTo(OcrStatus.NOT_APPLICABLE);
        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.ACTIVE);
    }

    @Test
    void abrokersScanStillCreatesThePerson() {
        // The deal-form path is unchanged: no node, so the scan is the discovery of someone new.
        Document doc = doc(9L, "licence-front.jpg", Instant.now());
        doc.setDocumentType(DocumentType.NZ_DRIVER_LICENCE);
        doc.setStatus(DocumentStatus.PENDING);
        doc.setUploadedByUserId(USER_ID);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        when(storage.exists(any())).thenReturn(true);
        when(storage.size(any())).thenReturn(doc.getSizeBytes());
        nz.amldock.beneficialowner.BeneficialOwner person = new nz.amldock.beneficialowner.BeneficialOwner();
        ReflectionTestUtils.setField(person, "id", PERSON_ID);
        when(beneficialOwners.createProvisional(doc)).thenReturn(person);

        service.confirmUpload(9L);

        assertThat(doc.getBeneficialOwnerId()).isEqualTo(PERSON_ID);
        assertThat(doc.getOcrStatus()).isEqualTo(OcrStatus.PENDING);
        // Due straight away, and never NULL while claimable: the claim's index orders by it (V60).
        assertThat(doc.getOcrNextAttemptAt()).isNotNull().isBeforeOrEqualTo(Instant.now());
        assertThat(doc.getIdSide()).isEqualTo(IdSide.FRONT);
    }

    /* ---------- confirming is scoped like reading (security audit C-01) ---------- */

    @Test
    void anotherFirmsConfirmedDocumentIsRefusedNotReturned() {
        // The idempotent ACTIVE return used to come before any check, handing any firm's ID
        // scan (filename, uploader, OCR'd name and date of birth) to whoever guessed its id.
        Document doc = doc(9L, "passport.jpg", Instant.now());
        doc.setUploadedByUserId(123L);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        signedInAs(Role.AML_COMPLIANCE_OFFICER, USER_ID, 200L, 20L);

        assertThatThrownBy(() -> service.confirmUpload(9L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aManagerOfAnotherFirmCannotConfirmItsPendingUpload() {
        Document doc = doc(9L, "licence-front.jpg", Instant.now());
        doc.setDocumentType(DocumentType.NZ_DRIVER_LICENCE);
        doc.setStatus(DocumentStatus.PENDING);
        doc.setUploadedByUserId(123L);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        signedInAs(Role.SALES_MANAGER, USER_ID, 200L, 20L);

        assertThatThrownBy(() -> service.confirmUpload(9L)).isInstanceOf(ForbiddenException.class);
        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PENDING);
        verify(storage, never()).exists(any());
        verify(beneficialOwners, never()).createProvisional(any());
    }

    @Test
    void anAgentWhoCannotReadTheDealCannotConfirmOnIt() {
        Document doc = doc(9L, "passport.jpg", Instant.now());
        doc.setUploadedByUserId(123L);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        // Same firm and branch, but neither the deal's creator nor granted access to it.
        signedInAs(Role.AGENT, 55L, FIRM_ID, BRANCH_ID);

        assertThatThrownBy(() -> service.confirmUpload(9L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void confirmingAnAlreadyActiveDocumentInScopeIsStillIdempotent() {
        Document doc = doc(9L, "passport.jpg", Instant.now());
        when(documents.findById(9L)).thenReturn(Optional.of(doc));

        DocumentDto dto = service.confirmUpload(9L);

        assertThat(dto).isNotNull();
        verify(storage, never()).exists(any());
    }

    /* ---------- the person a scan names is on its own deal (security audit C-02) ---------- */

    @Test
    void aScanCannotNameAPersonFromAnotherDeal() {
        // Deleting or reading the scan acts on that person, so a foreign id would let one deal's
        // author remove or rewrite another firm's individual.
        when(beneficialOwners.isOnDeal(DEAL_ID, PERSON_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.presignUpload(backOfCard(PERSON_ID)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("does not belong to this deal");
        verify(documents, never()).save(any());
    }

    @Test
    void theBackOfACardStillJoinsThePersonOnThisDeal() {
        when(beneficialOwners.isOnDeal(DEAL_ID, PERSON_ID)).thenReturn(true);
        when(documents.save(any())).thenAnswer(i -> {
            Document d = i.getArgument(0);
            ReflectionTestUtils.setField(d, "id", 42L);
            return d;
        });
        when(storage.presignUpload(any(), any(), any())).thenReturn("https://s3.example/put");

        service.presignUpload(backOfCard(PERSON_ID));

        org.mockito.ArgumentCaptor<Document> saved = org.mockito.ArgumentCaptor.forClass(Document.class);
        verify(documents).save(saved.capture());
        assertThat(saved.getValue().getBeneficialOwnerId()).isEqualTo(PERSON_ID);
    }

    @Test
    void deletingAScanRemovesItsPersonOnlyWithinTheScansDeal() {
        Document doc = someoneElsesDocument(DealStatus.REVIEW);
        doc.setBeneficialOwnerId(PERSON_ID);

        service.delete(doc.getId());

        verify(beneficialOwners).removeIfOrphaned(DEAL_ID, PERSON_ID);
    }

    /* ---------- uploading is a write, status-checked (security audit C-07) ---------- */

    static final Long AUTHOR_ID = 321L;

    @Test
    void theAuthoringAgentUploadsOnlyWhileTheDealIsNew() {
        dealStatus(DealStatus.NEW);
        signedInAs(Role.AGENT, AUTHOR_ID);
        assertPresignAllowed();

        for (DealStatus s : java.util.EnumSet.of(DealStatus.REVIEW, DealStatus.ON_HOLD,
                DealStatus.VERIFIED, DealStatus.CLOSED)) {
            dealStatus(s);
            assertPresignRefused(BadRequestException.class);
        }
    }

    @Test
    void branchStaffUploadThroughReviewButNotOnceVerified() {
        for (Role role : java.util.EnumSet.of(Role.SALES_MANAGER, Role.ADMIN)) {
            signedInAs(role, 66L);
            for (DealStatus s : java.util.EnumSet.of(DealStatus.NEW, DealStatus.REVIEW, DealStatus.ON_HOLD)) {
                dealStatus(s);
                assertPresignAllowed();
            }
            for (DealStatus s : java.util.EnumSet.of(DealStatus.VERIFIED, DealStatus.CLOSED)) {
                dealStatus(s);
                assertPresignRefused(BadRequestException.class);
            }
        }
    }

    @Test
    void branchStaffOfAnotherBranchCannotUpload() {
        dealStatus(DealStatus.REVIEW);
        signedInAs(Role.SALES_MANAGER, 66L, FIRM_ID, 11L);
        assertPresignRefused(ForbiddenException.class);
    }

    @Test
    void complianceUploadsOnHoldButNotOnASignedOffDeal() {
        dealStatus(DealStatus.ON_HOLD);
        assertPresignAllowed();   // setUp signs in as the firm's compliance officer

        dealStatus(DealStatus.VERIFIED);
        assertPresignRefused(BadRequestException.class);
        dealStatus(DealStatus.CLOSED);
        assertPresignRefused(BadRequestException.class);
    }

    @Test
    void rootCannotUploadToAFirmsDeal() {
        dealStatus(DealStatus.NEW);
        signedInAs(Role.ROOT, 1L, null, null);
        assertPresignRefused(ForbiddenException.class);
    }

    @Test
    void aDealVerifiedBetweenPresignAndConfirmRefusesTheConfirm() {
        // The case that planted an unverified owner under a sign-off: confirm made the scan live
        // and created its person without looking at the deal's status.
        Document doc = doc(9L, "licence-front.jpg", Instant.now());
        doc.setDocumentType(DocumentType.NZ_DRIVER_LICENCE);
        doc.setStatus(DocumentStatus.PENDING);
        doc.setUploadedByUserId(USER_ID);
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        dealStatus(DealStatus.VERIFIED);

        assertThatThrownBy(() -> service.confirmUpload(9L)).isInstanceOf(BadRequestException.class);

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.PENDING);
        verify(storage, never()).exists(any());
        verify(beneficialOwners, never()).createProvisional(any());
    }

    @Test
    void anAlreadyActiveDocumentOnAVerifiedDealIsStillIdempotent() {
        // A retried confirm after sign-off changes nothing, so it is not refused.
        Document doc = doc(9L, "passport.jpg", Instant.now());
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        dealStatus(DealStatus.VERIFIED);

        assertThat(service.confirmUpload(9L)).isNotNull();
    }

    @Test
    void aBranchAdminMayDeleteTheirOwnUploadInReview() {
        // Upload and delete answer to the same rule for the uploader, so a mistake made in
        // REVIEW can be taken back in REVIEW.
        Document doc = someoneElsesDocument(DealStatus.REVIEW);
        signedInAs(Role.ADMIN, 123L);   // the uploader, not the deal's author

        service.delete(doc.getId());

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.DELETED);
    }

    @Test
    void aBranchAdminMayNotDeleteTheirOwnUploadOnceVerified() {
        Document doc = someoneElsesDocument(DealStatus.VERIFIED);
        signedInAs(Role.ADMIN, 123L);

        assertThatThrownBy(() -> service.delete(doc.getId())).isInstanceOf(BadRequestException.class);
        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.ACTIVE);
    }

    private void dealStatus(DealStatus status) {
        Deal deal = deals.findById(DEAL_ID).orElseThrow();
        deal.setStatus(status);
        deal.setCreatedByUserId(AUTHOR_ID);
    }

    private static UploadUrlRequest licenceScan() {
        return new UploadUrlRequest("licence-front.jpg", "image/jpeg", 1024L, DocumentType.NZ_DRIVER_LICENCE,
                DEAL_ID, null, null, null);
    }

    private void assertPresignAllowed() {
        lenient().when(documents.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(storage.presignUpload(any(), any(), any())).thenReturn("https://s3.example/put");
        org.assertj.core.api.Assertions.assertThatCode(() -> service.presignUpload(licenceScan()))
                .doesNotThrowAnyException();
    }

    private void assertPresignRefused(Class<? extends Throwable> type) {
        DealStatus status = deals.findById(DEAL_ID).orElseThrow().getStatus();
        assertThatThrownBy(() -> service.presignUpload(licenceScan()))
                .as("presign on %s", status)
                .isInstanceOf(type);
    }

    private static UploadUrlRequest backOfCard(Long personId) {
        return new UploadUrlRequest("licence-back.jpg", "image/jpeg", 1024L, DocumentType.NZ_DRIVER_LICENCE,
                DEAL_ID, null, personId, IdSide.BACK);
    }

    /* ---------- accepted document types (V35) ---------- */

    @Test
    void aPrivateCompanyRefusesADocumentTypeItDoesNotProduce() {
        // Enforced at the upload, not only in the picker: a restriction that lives in a dropdown
        // is a suggestion.
        stubNodeForUpload(NodeType.PRIVATE_COMPANY);

        assertThatThrownBy(() -> service.presignUpload(uploadRequest(DocumentType.TRUST_DEED)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("does not accept");

        verify(documents, never()).save(any());
    }

    @Test
    void aPrivateCompanyAcceptsItsOwnEvidence() {
        stubNodeForUpload(NodeType.PRIVATE_COMPANY);
        when(documents.save(any())).thenAnswer(i -> {
            Document d = i.getArgument(0);
            ReflectionTestUtils.setField(d, "id", 42L);
            return d;
        });
        when(storage.presignUpload(any(), any(), any())).thenReturn("https://s3.example/put");

        service.presignUpload(uploadRequest(DocumentType.FINANCIAL_STATEMENTS));

        verify(documents).save(any(Document.class));
    }

    @Test
    void anUnrestrictedTypeStillAcceptsAnything() {
        // Only private company carries a list today. Asserting one for a type nobody has worked
        // through yet would be a guess with teeth.
        stubNodeForUpload(NodeType.TRUST);
        when(documents.save(any())).thenAnswer(i -> {
            Document d = i.getArgument(0);
            ReflectionTestUtils.setField(d, "id", 42L);
            return d;
        });
        when(storage.presignUpload(any(), any(), any())).thenReturn("https://s3.example/put");

        service.presignUpload(uploadRequest(DocumentType.TRUST_DEED));

        verify(documents).save(any(Document.class));
    }

    @Test
    void aTrustAcceptsItsOwnEvidenceAndRefusesACompanyExtract() {
        stubNodeForUpload(NodeType.TRUST);

        assertThatThrownBy(() -> service.presignUpload(uploadRequest(DocumentType.COMPANY_EXTRACT)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("does not accept");

        when(documents.save(any())).thenAnswer(i -> {
            Document d = i.getArgument(0);
            ReflectionTestUtils.setField(d, "id", 42L);
            return d;
        });
        when(storage.presignUpload(any(), any(), any())).thenReturn("https://s3.example/put");

        service.presignUpload(uploadRequest(DocumentType.TRUSTEES_RESOLUTION));

        verify(documents).save(any(Document.class));
    }

    @Test
    void eachEntityTypeAcceptsOnlyItsOwnEvidence() {
        // One case per restricted type, so a list edited in one place and not the other is
        // caught here rather than by a broker hitting a 400.
        assertAccepts(NodeType.TRUSTEE_COMPANY, DocumentType.COMPANY_EXTRACT);
        assertRefuses(NodeType.TRUSTEE_COMPANY, DocumentType.BANK_STATEMENT);

        assertAccepts(NodeType.LIMITED_PARTNERSHIP, DocumentType.LIMITED_PARTNERSHIP_EXTRACT);
        assertRefuses(NodeType.LIMITED_PARTNERSHIP, DocumentType.TRUST_DEED);

        assertAccepts(NodeType.PARTNERSHIP, DocumentType.PARTNERSHIP_AGREEMENT);
        // A partnership has no registry extract of its own — that is the limited one.
        assertRefuses(NodeType.PARTNERSHIP, DocumentType.LIMITED_PARTNERSHIP_EXTRACT);

        assertAccepts(NodeType.LISTED_COMPANY, DocumentType.EXCHANGE_REGISTRATION_SEARCH_RESULT);
        assertRefuses(NodeType.LISTED_COMPANY, DocumentType.BANK_STATEMENT);

        assertAccepts(NodeType.INCORPORATED_SOCIETY, DocumentType.SOCIETY_RULES);
        assertAccepts(NodeType.CHARITY, DocumentType.CHARITIES_REGISTER_INFORMATION);
        assertRefuses(NodeType.CHARITY, DocumentType.REGISTRY_SEARCH_RESULT);

        assertAccepts(NodeType.GOVERNMENT_AGENCY, DocumentType.REGISTRY_SEARCH_RESULT);
        assertAccepts(NodeType.DECEASED_ESTATE, DocumentType.PROBATE_OR_WILL);
        assertRefuses(NodeType.DECEASED_ESTATE, DocumentType.TRUST_DEED);

        // OTHER exists precisely because nobody could say in advance what it holds.
        assertAccepts(NodeType.OTHER, DocumentType.TRUST_DEED);
    }

    private void assertAccepts(NodeType type, DocumentType doc) {
        assertThat(type.accepts(doc))
                .as("%s should accept %s", type, doc).isTrue();
    }

    private void assertRefuses(NodeType type, DocumentType doc) {
        assertThat(type.accepts(doc))
                .as("%s should refuse %s", type, doc).isFalse();
    }

    /* ---------- deleting a document on a submitted deal (the reviewer's window) ---------- */

    @Test
    void aComplianceOfficerMayDeleteADocumentOnASubmittedDeal() {
        // The case that was broken: uploading to a submitted deal worked, deleting from it did
        // not, because upload checked read scope and delete checked the author's edit window.
        Document doc = someoneElsesDocument(DealStatus.REVIEW);

        service.delete(doc.getId());

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.DELETED);
    }

    @Test
    void aComplianceOfficerMayNotDeleteADocumentOnAVerifiedDeal() {
        // A signed-off deal is the boundary the widened window stops at.
        Document doc = someoneElsesDocument(DealStatus.VERIFIED);

        assertThatThrownBy(() -> service.delete(doc.getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot be edited");

        assertThat(doc.getStatus()).isEqualTo(DocumentStatus.ACTIVE);
    }

    @Test
    void anAgentStillCannotDeleteSomebodyElsesDocument() {
        // Widening the reviewer's window must not widen anyone else's.
        Document doc = someoneElsesDocument(DealStatus.REVIEW);
        signedInAs(Role.AGENT, 99L);

        assertThatThrownBy(() -> service.delete(doc.getId()))
                .isInstanceOf(nz.amldock.common.exception.ForbiddenException.class)
                .hasMessageContaining("Only the uploader");
    }

    /** An ACTIVE document uploaded by somebody else, on a deal in the given status. */
    private Document someoneElsesDocument(DealStatus dealStatus) {
        Deal deal = deals.findById(DEAL_ID).orElseThrow();
        deal.setStatus(dealStatus);
        deal.setCreatedByUserId(123L);

        Document doc = doc(9L, "company-extract.pdf", Instant.now());
        doc.setUploadedByUserId(123L);          // not the signed-in reviewer
        when(documents.findById(9L)).thenReturn(Optional.of(doc));
        return doc;
    }

    private void signedInAs(Role role, Long userId) {
        signedInAs(role, userId, FIRM_ID, BRANCH_ID);
    }

    private void signedInAs(Role role, Long userId, Long firmId, Long branchId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(userId, "someone@firm.nz", "Someone",
                                role, firmId, branchId, true),
                        null, List.of()));
    }

    /* ---------- helpers ---------- */

    private void stubNodeForUpload(NodeType type) {
        stubNode(type, null);
    }

    private static UploadUrlRequest uploadRequest(DocumentType type) {
        return new UploadUrlRequest("evidence.pdf", "application/pdf", 1024L, type,
                DEAL_ID, NODE_ID, null, null);
    }


    private void stubNode(NodeType type, Long personId) {
        OwnershipNode node = new OwnershipNode();
        ReflectionTestUtils.setField(node, "id", NODE_ID);
        node.setOwnershipStructureId(STRUCTURE_ID);
        node.setNodeType(type);
        node.setDisplayName("A node");
        node.setBeneficialOwnerId(personId);
        when(ownershipNodes.findById(NODE_ID)).thenReturn(Optional.of(node));
    }

    private static Document doc(Long id, String filename, Instant createdAt) {
        Document d = new Document();
        ReflectionTestUtils.setField(d, "id", id);
        ReflectionTestUtils.setField(d, "createdAt", createdAt);
        d.setS3Key("deals/1/" + filename);
        d.setOriginalFilename(filename);
        d.setContentType("application/octet-stream");
        d.setSizeBytes(1024);
        d.setDocumentType(DocumentType.OTHER);
        d.setStatus(DocumentStatus.ACTIVE);
        d.setDealId(DEAL_ID);
        d.setUploadedByUserId(USER_ID);
        return d;
    }
}
