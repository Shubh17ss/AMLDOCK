package nz.amldock.document;

import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.dto.DocumentDto;
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
    @Mock DealLifecycleService lifecycle;
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

    /* ---------- helpers ---------- */

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
