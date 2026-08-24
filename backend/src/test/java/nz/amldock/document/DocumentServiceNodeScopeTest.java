package nz.amldock.document;

import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.common.exception.BadRequestException;
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
    final DealLifecycleService lifecycle = new DealLifecycleService();
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;

    DocumentService service;

    @BeforeEach
    void setUp() {
        service = new DocumentService(documents, deals, branches, ownershipNodes, ownershipStructures,
                users, storage, lifecycle, beneficialOwners, audit, 26214400L, 5L, 5L);

        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);
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
        assertThat(doc.getIdSide()).isEqualTo(IdSide.FRONT);
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
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(userId, "someone@firm.nz", "Someone",
                                role, FIRM_ID, BRANCH_ID, true),
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
