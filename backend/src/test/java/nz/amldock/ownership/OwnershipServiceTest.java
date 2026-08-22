package nz.amldock.ownership;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.beneficialowner.DealBeneficialOwner;
import nz.amldock.beneficialowner.DealBeneficialOwnerRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.dto.CreateEdgeRequest;
import nz.amldock.ownership.dto.CreateNodeRequest;
import nz.amldock.ownership.dto.NodeDto;
import nz.amldock.ownership.dto.PersonPatch;
import nz.amldock.ownership.dto.UpdateNodeRequest;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The rules the ownership graph enforces that a schema cannot.
 *
 * <p>Two of them, and both span more than one row: an individual is always a leaf, and an
 * individual always has a person record behind them. A CHECK constraint can see neither.
 */
@ExtendWith(MockitoExtension.class)
class OwnershipServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 100L;
    static final Long STRUCTURE_ID = 20L;

    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock OwnershipEdgeRepository edges;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock DealLifecycleService lifecycle;
    @Mock BeneficialOwnerRepository owners;
    @Mock DealBeneficialOwnerRepository ownerLinks;
    @Mock nz.amldock.deal.DealRiskService risk;

    OwnershipService service;
    Deal deal;

    private final AtomicLong nextNodeId = new AtomicLong(1000);

    @BeforeEach
    void setUp() {
        service = new OwnershipService(structures, nodes, edges, deals, branches, lifecycle,
                owners, ownerLinks, risk);

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);

        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        structure.setDealId(DEAL_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.of(structure));
        lenient().when(structures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure));
        lenient().when(nodes.save(any())).thenAnswer(i -> {
            OwnershipNode n = i.getArgument(0);
            if (n.getId() == null) ReflectionTestUtils.setField(n, "id", nextNodeId.incrementAndGet());
            return n;
        });
        lenient().when(owners.save(any())).thenAnswer(i -> {
            BeneficialOwner o = i.getArgument(0);
            if (o.getId() == null) ReflectionTestUtils.setField(o, "id", 500L);
            return o;
        });

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new UserPrincipal(7L, "officer@firm.nz", "Officer",
                                Role.AML_COMPLIANCE_OFFICER, FIRM_ID, BRANCH_ID, true),
                        null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- an individual is always a leaf ---------- */

    @Test
    void anIndividualCannotOwnAnotherNode() {
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        stubNodes(person, company);

        assertThatThrownBy(() -> service.createEdge(DEAL_ID, new CreateEdgeRequest(1L, 2L, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Anna Eriksson");

        verify(edges, never()).save(any());
    }

    @Test
    void anEntityCanOwnAnIndividual() {
        // The same edge the other way round is the ordinary case and must still work.
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        stubNodes(person, company);
        when(edges.findByParentNodeIdAndChildNodeId(2L, 1L)).thenReturn(Optional.empty());
        when(edges.findAllByParentNodeId(1L)).thenReturn(List.of());
        when(edges.save(any())).thenAnswer(i -> i.getArgument(0));

        service.createEdge(DEAL_ID, new CreateEdgeRequest(2L, 1L, null, EdgeRole.SHAREHOLDER));

        verify(edges).save(any(OwnershipEdge.class));
    }

    @Test
    void aNodeWithChildrenCannotBecomeAnIndividual() {
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        stubNodes(company);
        when(edges.findAllByParentNodeId(2L)).thenReturn(List.of(new OwnershipEdge()));

        assertThatThrownBy(() -> service.updateNode(DEAL_ID, 2L, patch(NodeType.INDIVIDUAL, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Detach them first");

        assertThat(company.getNodeType()).isEqualTo(NodeType.PRIVATE_COMPANY);
    }

    /* ---------- an individual always has a person ---------- */

    @Test
    void creatingAnIndividualCreatesTheirPersonRecordAndDealLink() {
        // The shared fields live on beneficial_owner, so a node without one has nowhere to put
        // an email address and the form would silently discard what is typed into it.
        NodeDto created = service.createNode(DEAL_ID, createRequest(NodeType.INDIVIDUAL, "Anna Eriksson"));

        ArgumentCaptor<BeneficialOwner> person = ArgumentCaptor.forClass(BeneficialOwner.class);
        verify(owners).save(person.capture());
        assertThat(person.getValue().getRealEstateFirmId()).isEqualTo(FIRM_ID);
        assertThat(person.getValue().getFullName()).isEqualTo("Anna Eriksson");

        verify(ownerLinks).save(any(DealBeneficialOwner.class));
        assertThat(created.beneficialOwnerId()).isEqualTo(500L);
        assertThat(created.person()).isNotNull();
    }

    @Test
    void creatingAnEntityCreatesNoPersonRecord() {
        service.createNode(DEAL_ID, createRequest(NodeType.TRUST, "The Eriksson Family Trust"));

        verify(owners, never()).save(any());
        verify(ownerLinks, never()).save(any());
    }

    /* ---------- the shared person block ---------- */

    @Test
    void patchingThePersonWritesTheSharedRecordAndRenamesTheNode() {
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Unread ID - licence.jpg");
        person.setBeneficialOwnerId(500L);
        stubNodes(person);
        BeneficialOwner owner = owner(500L, FIRM_ID);
        when(owners.findById(500L)).thenReturn(Optional.of(owner));

        service.updateNode(DEAL_ID, 1L, patch(null, new PersonPatch(
                "Anna Eriksson", "anna@example.com", "NZ", "21 555 0123", "Architect",
                "Sale of a rental property, evidenced by the settlement statement")));

        assertThat(owner.getFullName()).isEqualTo("Anna Eriksson");
        assertThat(owner.getEmail()).isEqualTo("anna@example.com");
        assertThat(owner.getPhoneCountry()).isEqualTo("NZ");
        assertThat(owner.getOccupation()).isEqualTo("Architect");
        // display_name is NOT NULL and is what the tree renders, so it follows the name.
        assertThat(person.getDisplayName()).isEqualTo("Anna Eriksson");
    }

    @Test
    void aBlankFieldClearsItButANullOneLeavesItAlone() {
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        person.setBeneficialOwnerId(500L);
        stubNodes(person);
        BeneficialOwner owner = owner(500L, FIRM_ID);
        owner.setEmail("old@example.com");
        owner.setOccupation("Architect");
        when(owners.findById(500L)).thenReturn(Optional.of(owner));

        service.updateNode(DEAL_ID, 1L,
                patch(null, new PersonPatch(null, "", null, null, null, null)));

        assertThat(owner.getEmail()).isNull();          // "" is an instruction to clear
        assertThat(owner.getOccupation()).isEqualTo("Architect");  // null is "leave alone"
    }

    @Test
    void aPersonBelongingToAnotherFirmIsRefused() {
        // The write leaves the deal, so it cannot inherit authorisation from the deal-scoped URL.
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        person.setBeneficialOwnerId(500L);
        stubNodes(person);
        BeneficialOwner otherFirmsPerson = owner(500L, 999L);
        when(owners.findById(500L)).thenReturn(Optional.of(otherFirmsPerson));

        assertThatThrownBy(() -> service.updateNode(DEAL_ID, 1L,
                patch(null, new PersonPatch(null, "leaked@example.com", null, null, null, null))))
                .isInstanceOf(ForbiddenException.class);

        assertThat(otherFirmsPerson.getEmail()).isNull();
    }

    /* ---------- deleting a node ---------- */

    @Test
    void deletingAHandAddedIndividualRemovesTheirPersonRecord() {
        // Nobody scanned an ID for them, so the person exists only as this node. Leaving them
        // behind would leave a name on the deal's people list that is nowhere in the structure.
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        person.setBeneficialOwnerId(500L);
        stubNodes(person);
        when(edges.findAllByParentNodeId(1L)).thenReturn(List.of());
        when(edges.findAllByChildNodeId(1L)).thenReturn(List.of());
        when(ownerLinks.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, 500L, null)));
        when(ownerLinks.countByBeneficialOwnerId(500L)).thenReturn(0L);

        service.deleteNode(DEAL_ID, 1L, false);

        verify(owners).deleteById(500L);
    }

    @Test
    void deletingAScannedIndividualLeavesTheirPersonRecordAlone() {
        // Their evidence is still in the deal. Removing them is the document lifecycle's call —
        // the source document on the link is what tells the two cases apart.
        OwnershipNode person = node(1L, NodeType.INDIVIDUAL, "Anna Eriksson");
        person.setBeneficialOwnerId(500L);
        stubNodes(person);
        when(edges.findAllByParentNodeId(1L)).thenReturn(List.of());
        when(edges.findAllByChildNodeId(1L)).thenReturn(List.of());
        when(ownerLinks.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, 500L, 77L)));

        service.deleteNode(DEAL_ID, 1L, false);

        verify(owners, never()).deleteById(anyLong());
        verify(ownerLinks, never()).delete(any());
    }

    /* ---------- the deal's risk follows the node (V35) ---------- */

    @Test
    void savingACompanyAnswerRecomputesTheDealsRisk() {
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        stubNodes(company);

        service.updateNode(DEAL_ID, 2L, patchOf(Map.of("nomineeStatus", "YES")));

        assertThat(company.getNomineeStatus()).isEqualTo(NomineeStatus.YES);
        verify(risk).recomputeFor(DEAL_ID);
    }

    @Test
    void theRecomputeRunsOnEverySaveNotJustRiskBearingOnes() {
        // Deciding whether this particular patch touched a risk-bearing field would be a second
        // copy of the rule, living somewhere the rule cannot see.
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        stubNodes(company);

        service.updateNode(DEAL_ID, 2L, patchOf(Map.of("companyPersonalAssets", true)));

        verify(risk).recomputeFor(DEAL_ID);
    }

    @Test
    void deletingTheNodeThatRaisedTheRiskRecomputesToo() {
        OwnershipNode company = node(2L, NodeType.PRIVATE_COMPANY, "Eriksson Holdings");
        company.setNomineeStatus(NomineeStatus.YES);
        stubNodes(company);
        when(edges.findAllByParentNodeId(2L)).thenReturn(List.of());
        when(edges.findAllByChildNodeId(2L)).thenReturn(List.of());

        service.deleteNode(DEAL_ID, 2L, false);

        verify(risk).recomputeFor(DEAL_ID);
    }

    @Test
    void theCompanyBlockRoundTripsThroughACreate() {
        NodeDto created = service.createNode(DEAL_ID, JSON.convertValue(Map.of(
                "nodeType", NodeType.PRIVATE_COMPANY,
                "displayName", "Eriksson Holdings",
                "jurisdictionCountry", "NZ",
                "businessNumber", "9429039000123",
                "companyNumber", "1234567",
                "companyHasConstitution", true,
                "nomineeStatus", "NOT_ASKED",
                "companyComplexOwnership", false,
                "companyNewDeveloper", true), CreateNodeRequest.class));

        assertThat(created.jurisdictionCountry()).isEqualTo("NZ");
        assertThat(created.businessNumber()).isEqualTo("9429039000123");
        assertThat(created.companyNumber()).isEqualTo("1234567");
        assertThat(created.companyHasConstitution()).isTrue();
        assertThat(created.nomineeStatus()).isEqualTo(NomineeStatus.NOT_ASKED);
        assertThat(created.companyNewDeveloper()).isTrue();
        // No person record: only individuals get one.
        assertThat(created.person()).isNull();
    }

    @Test
    void theTrustBlockRoundTripsThroughACreate() {
        NodeDto created = service.createNode(DEAL_ID, JSON.convertValue(Map.of(
                "nodeType", NodeType.TRUST,
                "displayName", "The Eriksson Family Trust",
                "trustType", "FAMILY",
                "trustDiscretionary", true,
                "trustHoldingComplexity", "EXTENSIVE_DIVERSE_PORTFOLIO"), CreateNodeRequest.class));

        assertThat(created.trustType()).isEqualTo(TrustType.FAMILY);
        assertThat(created.trustDiscretionary()).isTrue();
        assertThat(created.trustHoldingComplexity())
                .isEqualTo(TrustHoldingComplexity.EXTENSIVE_DIVERSE_PORTFOLIO);
        // Creating the node is one of the ways the deal's rating can move.
        verify(risk).recomputeFor(DEAL_ID);
    }

    @Test
    void aJurisdictionOnlyTypeRoundTripsThroughACreate() {
        // Society, charity, agency and estate share one shape: a name and where they are
        // governed from. None of them is incorporated, which is why the column is not named
        // for incorporation any more.
        NodeDto created = service.createNode(DEAL_ID, JSON.convertValue(Map.of(
                "nodeType", NodeType.DECEASED_ESTATE,
                "displayName", "Estate of A. Eriksson",
                "jurisdictionCountry", "NZ"), CreateNodeRequest.class));

        assertThat(created.jurisdictionCountry()).isEqualTo("NZ");
        assertThat(created.person()).isNull();
    }

    @Test
    void aPartnershipCarriesItsOwnSourceOfFunds() {
        // Node-level: a partnership is not a person and has no beneficial_owner record for
        // the person-level field to live on.
        NodeDto created = service.createNode(DEAL_ID, JSON.convertValue(Map.of(
                "nodeType", NodeType.PARTNERSHIP,
                "displayName", "Eriksson & Co",
                "sourceOfFunds", "Partner capital contributions",
                "reference", "DEAL-2026-0001"), CreateNodeRequest.class));

        assertThat(created.sourceOfFunds()).isEqualTo("Partner capital contributions");
        assertThat(created.reference()).isEqualTo("DEAL-2026-0001");
    }

    /* ---------- helpers ---------- */

    private OwnershipNode node(Long id, NodeType type, String name) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        n.setOwnershipStructureId(STRUCTURE_ID);
        n.setNodeType(type);
        n.setDisplayName(name);
        return n;
    }

    private void stubNodes(OwnershipNode... all) {
        for (OwnershipNode n : all) {
            lenient().when(nodes.findById(n.getId())).thenReturn(Optional.of(n));
        }
    }

    private static BeneficialOwner owner(Long id, Long firmId) {
        BeneficialOwner o = new BeneficialOwner();
        ReflectionTestUtils.setField(o, "id", id);
        o.setRealEstateFirmId(firmId);
        return o;
    }

    /**
     * Requests are built from a map of the fields under test rather than positionally.
     *
     * <p>These records carry twenty-odd optional components and grow with every entity type
     * worked through. A positional constructor call here silently shifts arguments the moment
     * one is inserted, and names the fields nowhere — this reads as what it sets, and goes
     * through the same deserialisation the controller does.
     */
    private static final ObjectMapper JSON = new ObjectMapper();

    private static CreateNodeRequest createRequest(NodeType type, String name) {
        return JSON.convertValue(Map.of("nodeType", type, "displayName", name),
                CreateNodeRequest.class);
    }

    private static UpdateNodeRequest patch(NodeType type, PersonPatch person) {
        Map<String, Object> fields = new HashMap<>();
        if (type != null) fields.put("nodeType", type);
        if (person != null) fields.put("person", person);
        return JSON.convertValue(fields, UpdateNodeRequest.class);
    }

    /** A patch that sets arbitrary named fields — used by the private-company cases. */
    private static UpdateNodeRequest patchOf(Map<String, Object> fields) {
        return JSON.convertValue(fields, UpdateNodeRequest.class);
    }
}
