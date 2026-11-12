package nz.amldock.document;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.ownership.VerificationReset;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** Moving a document from one owner to one other owner on the same deal. */
@ExtendWith(MockitoExtension.class)
class DocumentMoveTest {

    static final Long DEAL_ID = 1L;
    static final Long OTHER_DEAL_ID = 2L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 100L;
    static final Long STRUCTURE_ID = 20L;
    static final Long OTHER_STRUCTURE_ID = 21L;

    @Mock DocumentRepository documents;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock OwnershipNodeRepository nodes;
    @Mock OwnershipStructureRepository structures;
    @Mock UserRepository users;
    @Mock FileStorageService storage;
    final DealLifecycleService lifecycle = new DealLifecycleService(mock(DealUserRepository.class));
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock AuditService audit;
    @Mock nz.amldock.deal.version.DealVersionDocumentRepository versionDocuments;

    DocumentService service;
    OwnershipNode anna;
    OwnershipNode ben;
    OwnershipNode trust;
    OwnershipNode elsewhere;

    @BeforeEach
    void setUp() {
        service = new DocumentService(documents, deals, branches, nodes, structures,
                users, storage, lifecycle, beneficialOwners, audit, versionDocuments,
                new VerificationReset(nodes, audit), 26214400L, 5L, 5L);

        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);
        deal.setStatus(DealStatus.REVIEW);
        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);
        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));
        structure(STRUCTURE_ID, DEAL_ID);
        structure(OTHER_STRUCTURE_ID, OTHER_DEAL_ID);

        anna = node(31L, NodeType.INDIVIDUAL, "Anna", STRUCTURE_ID);
        ben = node(32L, NodeType.INDIVIDUAL, "Ben", STRUCTURE_ID);
        trust = node(33L, NodeType.TRUST, "Family Trust", STRUCTURE_ID);
        elsewhere = node(34L, NodeType.INDIVIDUAL, "Someone else", OTHER_STRUCTURE_ID);

        actAs(Role.AML_COMPLIANCE_OFFICER, 7L);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void movesToAnotherOwnerAndWithdrawsBothVerifications() {
        markVerified(anna);
        markVerified(ben);
        Document d = doc(DocumentType.OTHER, anna.getId());

        service.move(d.getId(), ben.getId());

        assertThat(d.getOwnershipNodeId()).isEqualTo(ben.getId());
        assertThat(anna.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
        assertThat(ben.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
        verify(audit).record(eq(AuditAction.DOCUMENT_MOVED), eq("Document"), eq(d.getId()), anyString());
    }

    /* ---------- to and from the property ---------- */

    @Test
    void movesFromAnOwnerToThePropertyAndWithdrawsTheOwnersVerification() {
        markVerified(anna);
        Document d = doc(DocumentType.PROOF_OF_ADDRESS, anna.getId());

        service.move(d.getId(), null);

        assertThat(d.getOwnershipNodeId()).isNull();
        assertThat(anna.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
    }

    @Test
    void movesFromThePropertyToAnOwnerAndWithdrawsTheirVerification() {
        markVerified(ben);
        Document d = doc(DocumentType.OTHER, null);

        service.move(d.getId(), ben.getId());

        assertThat(d.getOwnershipNodeId()).isEqualTo(ben.getId());
        assertThat(ben.getVerificationStatus()).isEqualTo(NodeVerificationStatus.NOT_STARTED);
    }

    @Test
    void refusesMovingAPropertyDocumentToTheProperty() {
        Document d = doc(DocumentType.OTHER, null);
        assertThatThrownBy(() -> service.move(d.getId(), null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("already on the property");
    }

    @Test
    void refusesParkingAPassportOnTheProperty() {
        Document d = doc(DocumentType.PASSPORT, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("does not take");
        assertThat(d.getOwnershipNodeId()).isEqualTo(anna.getId());
    }

    /* ---------- refiled and renamed on the way ---------- */

    @Test
    void movesAPassportToThePropertyOnceRefiledAsSomethingItTakes() {
        Document d = doc(DocumentType.PASSPORT, anna.getId());

        service.move(d.getId(), null, DocumentType.OTHER, null);

        assertThat(d.getOwnershipNodeId()).isNull();
        assertThat(d.getDocumentType()).isEqualTo(DocumentType.OTHER);
        verify(audit).record(eq(AuditAction.DOCUMENT_MOVED), eq("Document"), eq(d.getId()),
                org.mockito.ArgumentMatchers.contains("type PASSPORT"));
    }

    @Test
    void checksTheTargetAgainstTheNewType() {
        Document d = doc(DocumentType.OTHER, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), trust.getId(), DocumentType.PASSPORT, null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("does not accept");
        assertThat(d.getDocumentType()).isEqualTo(DocumentType.OTHER);
        assertThat(d.getOwnershipNodeId()).isEqualTo(anna.getId());
    }

    @Test
    void renamesAndKeepsTheExtension() {
        Document d = doc(DocumentType.OTHER, anna.getId());

        service.move(d.getId(), ben.getId(), null, "  Anna rates notice ");

        assertThat(d.getOriginalFilename()).isEqualTo("Anna rates notice.pdf");
        assertThat(d.getDocumentType()).isEqualTo(DocumentType.OTHER);
    }

    @Test
    void aBlankNameKeepsTheOldOne() {
        assertThat(DocumentService.renamed("file.pdf", "   ")).isEqualTo("file.pdf");
        assertThat(DocumentService.renamed("file.pdf", "new.PDF")).isEqualTo("new.PDF");
        assertThat(DocumentService.renamed("file.pdf", "a/b")).isEqualTo("a_b.pdf");
    }

    @Test
    void refusesRefilingAFileAsAVoiceNote() {
        Document d = doc(DocumentType.OTHER, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), ben.getId(), DocumentType.VOICE_NOTE, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesAnOwnerOnAnotherDeal() {
        Document d = doc(DocumentType.OTHER, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), elsewhere.getId()))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("same deal");
        assertThat(d.getOwnershipNodeId()).isEqualTo(anna.getId());
    }

    @Test
    void refusesTheOwnerItIsAlreadyOn() {
        Document d = doc(DocumentType.OTHER, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), anna.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesAnOwnerWhoseTypeDoesNotTakeThatDocument() {
        Document d = doc(DocumentType.PASSPORT, anna.getId());
        assertThatThrownBy(() -> service.move(d.getId(), trust.getId()))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("does not accept");
    }

    @Test
    void refusesAnIdScanThatHangsOffThePerson() {
        Document d = doc(DocumentType.PASSPORT, null);
        d.setBeneficialOwnerId(500L);
        assertThatThrownBy(() -> service.move(d.getId(), ben.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesADeletedDocument() {
        Document d = doc(DocumentType.OTHER, anna.getId());
        d.setStatus(DocumentStatus.DELETED);
        assertThatThrownBy(() -> service.move(d.getId(), ben.getId()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesSomeoneElsesDocumentWithoutAnElevatedRole() {
        actAs(Role.SALES_MANAGER, 8L);
        Document d = doc(DocumentType.OTHER, anna.getId());   // uploaded by user 7
        assertThatThrownBy(() -> service.move(d.getId(), ben.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    /* ---------- fixtures ---------- */

    private void actAs(Role role, Long userId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(userId, "user@firm.nz", "User", role, FIRM_ID, BRANCH_ID, true),
                null, List.of()));
    }

    private void structure(Long id, Long dealId) {
        OwnershipStructure s = new OwnershipStructure();
        ReflectionTestUtils.setField(s, "id", id);
        s.setDealId(dealId);
        lenient().when(structures.findById(id)).thenReturn(Optional.of(s));
    }

    private OwnershipNode node(Long id, NodeType type, String name, Long structureId) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        n.setNodeType(type);
        n.setDisplayName(name);
        n.setOwnershipStructureId(structureId);
        lenient().when(nodes.findById(id)).thenReturn(Optional.of(n));
        return n;
    }

    private static void markVerified(OwnershipNode n) {
        n.setVerificationStatus(NodeVerificationStatus.VERIFIED);
        n.setVerifiedByUserId(7L);
        n.setVerifiedAt(Instant.now());
    }

    private Document doc(DocumentType type, Long nodeId) {
        Document d = new Document();
        ReflectionTestUtils.setField(d, "id", 90L);
        d.setDealId(DEAL_ID);
        d.setOwnershipNodeId(nodeId);
        d.setDocumentType(type);
        d.setStatus(DocumentStatus.ACTIVE);
        d.setOriginalFilename("file.pdf");
        d.setUploadedByUserId(7L);
        lenient().when(documents.findById(90L)).thenReturn(Optional.of(d));
        return d;
    }
}
