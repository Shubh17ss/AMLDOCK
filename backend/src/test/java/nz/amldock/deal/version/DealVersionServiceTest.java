package nz.amldock.deal.version;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.beneficialowner.DealBeneficialOwnerRepository;
import nz.amldock.client.Client;
import nz.amldock.client.ClientRepository;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentStatus;
import nz.amldock.ownership.OwnershipEdge;
import nz.amldock.ownership.OwnershipEdgeRepository;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * When a version is written, and what it keeps.
 *
 * <p>The load-bearing claim of the whole feature is that a snapshot is a <em>copy</em> — that
 * nothing done to the deal afterwards can reach it. Most of that is guaranteed by the schema
 * rather than by code, so what is worth testing here is the part that is not: that the copy is
 * taken at the right moment, that it carries the frozen row's timestamps rather than the moment it
 * was taken, and that version numbers advance per deal.
 */
@ExtendWith(MockitoExtension.class)
class DealVersionServiceTest {

    static final Long DEAL_ID = 42L;
    static final Long PROPERTY_ID = 7L;
    static final Long CLIENT_ID = 8L;
    static final Long STRUCTURE_ID = 9L;

    @Mock DealVersionRepository versions;
    @Mock DealVersionPropertyRepository versionProperties;
    @Mock DealVersionClientRepository versionClients;
    @Mock DealVersionNodeRepository versionNodes;
    @Mock DealVersionEdgeRepository versionEdges;
    @Mock DealVersionDocumentRepository versionDocuments;
    @Mock DealVersionPersonRepository versionPeople;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock OwnershipEdgeRepository edges;
    @Mock DocumentRepository documents;
    @Mock DealBeneficialOwnerRepository dealOwners;
    @Mock BeneficialOwnerRepository owners;

    DealVersionService service;

    final UserPrincipal amlco =
            new UserPrincipal(20L, "amlco@a.com", null, Role.AML_COMPLIANCE_OFFICER, 1L, null, true);

    @BeforeEach
    void setUp() {
        service = new DealVersionService(versions, versionProperties, versionClients, versionNodes,
                versionEdges, versionDocuments, versionPeople, properties, clients, structures,
                nodes, edges, documents, dealOwners, owners);
    }

    static Deal dealIn(DealStatus status) {
        Deal d = new Deal();
        ReflectionTestUtils.setField(d, "id", DEAL_ID);
        d.setStatus(status);
        d.setReference("DEAL-2026-0042");
        d.setPropertyId(PROPERTY_ID);
        d.setClientId(CLIENT_ID);
        d.setFirmBranchId(10L);
        d.setCreatedByUserId(3L);
        ReflectionTestUtils.setField(d, "createdAt", Instant.parse("2026-01-05T09:00:00Z"));
        ReflectionTestUtils.setField(d, "updatedAt", Instant.parse("2026-02-11T14:30:00Z"));
        return d;
    }

    /** Nothing to copy unless this transition has just produced a sign-off. */
    @Test
    void onlyEnteringVerifiedWritesAVersion() {
        for (DealStatus s : List.of(DealStatus.NEW, DealStatus.REVIEW, DealStatus.ON_HOLD, DealStatus.CLOSED)) {
            service.snapshotIfVerified(dealIn(s), amlco, "a note", DealStatus.REVIEW);
        }
        verify(versions, never()).save(any());
    }

    /**
     * A deal that was already verified is not re-frozen. No rule produces this today, but the
     * guard is what makes a version mean "one verification" rather than "the last time anything
     * touched a verified deal".
     */
    @Test
    void aDealAlreadyVerifiedIsNotFrozenAgain() {
        service.snapshotIfVerified(dealIn(DealStatus.VERIFIED), amlco, "a note", DealStatus.VERIFIED);
        verify(versions, never()).save(any());
    }

    @Test
    void theFirstVerificationWritesVersionOne() {
        stubEmptyGraph();
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.empty());

        DealVersion written = capture(dealIn(DealStatus.VERIFIED), "checked the title");

        assertThat(written.getVersionNo()).isEqualTo(1);
        assertThat(written.getDealId()).isEqualTo(DEAL_ID);
        assertThat(written.getVerifiedByUserId()).isEqualTo(amlco.id());
        assertThat(written.getVerifyNote()).isEqualTo("checked the title");
        assertThat(written.getReopenedAt()).as("a fresh version has not been reopened").isNull();
    }

    @Test
    void theNextVerificationNumbersItselfAfterTheLast() {
        stubEmptyGraph();
        DealVersion existing = new DealVersion();
        ReflectionTestUtils.setField(existing, "versionNo", 2);
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.of(existing));

        assertThat(capture(dealIn(DealStatus.VERIFIED), "second look").getVersionNo()).isEqualTo(3);
    }

    /**
     * The snapshot carries the <em>deal's</em> timestamps, not the moment it was copied.
     *
     * <p>{@code BaseEntity} would otherwise stamp both columns on persist, which would make every
     * version claim the deal was raised at the instant it was verified — destroying the fact it
     * was copying. {@code stampsOwnTimestamps()} is what stops that, and this is the test that
     * says so.
     */
    @Test
    void aVersionKeepsTheDealsOwnTimestamps() {
        stubEmptyGraph();
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.empty());
        Deal deal = dealIn(DealStatus.VERIFIED);

        DealVersion written = capture(deal, "checked the title");

        assertThat(written.getCreatedAt()).isEqualTo(deal.getCreatedAt());
        assertThat(written.getUpdatedAt()).isEqualTo(deal.getUpdatedAt());
        assertThat(written.stampsOwnTimestamps()).isFalse();
        // And the moment of the copy is recorded properly, as a fact of its own.
        assertThat(written.getVerifiedAt()).isCloseTo(Instant.now(), within(5));
    }

    /** Every column of the deal reaches the copy — the point of the shared DealFields. */
    @Test
    void aVersionCarriesTheDealsOwnColumns() {
        stubEmptyGraph();
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.empty());
        Deal deal = dealIn(DealStatus.VERIFIED);
        deal.setTransactionPurpose("Relocating");
        deal.setOnSoldQuickly(true);
        deal.setForeignExposureCountry("AU");

        DealVersion written = capture(deal, "checked the title");

        assertThat(written.getReference()).isEqualTo("DEAL-2026-0042");
        assertThat(written.getTransactionPurpose()).isEqualTo("Relocating");
        assertThat(written.getOnSoldQuickly()).isTrue();
        assertThat(written.getForeignExposureCountry()).isEqualTo("AU");
        assertThat(written.getStatus()).isEqualTo(DealStatus.VERIFIED);
    }

    /**
     * The structure's own two columns fold into the header, and every node, edge, document and
     * person is copied with it.
     */
    @Test
    void theWholeGraphIsCopied() {
        OwnershipStructure structure = new OwnershipStructure();
        ReflectionTestUtils.setField(structure, "id", STRUCTURE_ID);
        structure.setDealId(DEAL_ID);
        structure.setRootNodeId(100L);
        structure.setNotes("Two-tier trust");
        when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.of(structure));
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.empty());
        when(versions.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 500L));

        when(properties.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));
        when(clients.findById(CLIENT_ID)).thenReturn(Optional.of(client()));
        when(nodes.findAllByOwnershipStructureIdOrderByIdAsc(STRUCTURE_ID))
                .thenReturn(List.of(node(100L), node(101L)));
        when(edges.findAllByParentNodeIdIn(List.of(100L, 101L))).thenReturn(List.of(edge(100L, 101L)));
        when(documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(DEAL_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(document(200L)));
        when(dealOwners.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID)).thenReturn(List.of(
                new nz.amldock.beneficialowner.DealBeneficialOwner(DEAL_ID, 300L, 200L)));
        when(owners.findAllById(any())).thenReturn(List.of(person(300L)));

        DealVersion written = capture(dealIn(DealStatus.VERIFIED), "checked the title");

        assertThat(written.getRootNodeId()).isEqualTo(100L);
        assertThat(written.getStructureNotes()).isEqualTo("Two-tier trust");

        assertThat(savedNodes()).extracting(DealVersionNode::getNodeId).containsExactly(100L, 101L);
        assertThat(savedEdges()).hasSize(1);
        verify(versionProperties).save(any());
        verify(versionClients).save(any());

        ArgumentCaptor<List<DealVersionDocument>> docs = listCaptor();
        verify(versionDocuments).saveAll(docs.capture());
        assertThat(docs.getValue()).extracting(DealVersionDocument::getDocumentId).containsExactly(200L);

        ArgumentCaptor<List<DealVersionPerson>> people = listCaptor();
        verify(versionPeople).saveAll(people.capture());
        assertThat(people.getValue()).singleElement()
                .satisfies(p -> {
                    assertThat(p.getBeneficialOwnerId()).isEqualTo(300L);
                    // The link row's own column: which scan put this person on the deal.
                    assertThat(p.getSourceDocumentId()).isEqualTo(200L);
                });
    }

    /**
     * Edges keep the live node ids rather than the copies' own, which is what lets both be copied
     * in one pass with no remapping — and what makes a version's tree render with the same DTOs
     * the live deal uses.
     */
    @Test
    void copiedEdgesStillNameTheNodesTheyDidBefore() {
        DealVersionEdge copy = DealVersionEdge.copyOf(edge(100L, 101L), 500L);
        assertThat(copy.getParentNodeId()).isEqualTo(100L);
        assertThat(copy.getChildNodeId()).isEqualTo(101L);
        assertThat(copy.getDealVersionId()).isEqualTo(500L);
    }

    /* ---------- reopen ---------- */

    @Test
    void reopeningStampsTheVersionItLeaves() {
        DealVersion current = new DealVersion();
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.of(current));

        service.recordReopen(dealIn(DealStatus.REVIEW), amlco, "new ID supplied");

        assertThat(current.getReopenedByUserId()).isEqualTo(amlco.id());
        assertThat(current.getReopenedAt()).isCloseTo(Instant.now(), within(5));
        assertThat(current.getReopenNote()).isEqualTo("new ID supplied");
        verify(versions).save(current);
    }

    /**
     * A deal verified before versioning existed has nothing to stamp. Tolerated rather than
     * treated as an error — refusing the reopen would strand exactly the deals the feature is
     * meant to unstick.
     */
    @Test
    void reopeningADealWithNoVersionsIsNotAnError() {
        when(versions.findTopByDealIdOrderByVersionNoDesc(DEAL_ID)).thenReturn(Optional.empty());
        service.recordReopen(dealIn(DealStatus.REVIEW), amlco, "new ID supplied");
        verify(versions, never()).save(any());
    }

    /* ---------- fixtures ---------- */

    /** A deal with no structure, documents or people — the shape most of these tests need. */
    private void stubEmptyGraph() {
        lenient().when(structures.findByDealId(DEAL_ID)).thenReturn(Optional.empty());
        lenient().when(properties.findById(PROPERTY_ID)).thenReturn(Optional.empty());
        lenient().when(clients.findById(CLIENT_ID)).thenReturn(Optional.empty());
        lenient().when(documents.findAllByDealIdAndStatusOrderByCreatedAtDesc(DEAL_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(dealOwners.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID)).thenReturn(List.of());
        lenient().when(versions.save(any())).thenAnswer(inv -> withId(inv.getArgument(0), 500L));
    }

    private DealVersion capture(Deal deal, String note) {
        service.snapshotIfVerified(deal, amlco, note, DealStatus.REVIEW);
        ArgumentCaptor<DealVersion> c = ArgumentCaptor.forClass(DealVersion.class);
        verify(versions).save(c.capture());
        return c.getValue();
    }

    private List<DealVersionNode> savedNodes() {
        ArgumentCaptor<List<DealVersionNode>> c = listCaptor();
        verify(versionNodes).saveAll(c.capture());
        return c.getValue();
    }

    private List<DealVersionEdge> savedEdges() {
        ArgumentCaptor<List<DealVersionEdge>> c = listCaptor();
        verify(versionEdges).saveAll(c.capture());
        return c.getValue();
    }

    @SuppressWarnings("unchecked")
    private static <T> ArgumentCaptor<List<T>> listCaptor() {
        return ArgumentCaptor.forClass((Class<List<T>>) (Class<?>) List.class);
    }

    private static DealVersion withId(DealVersion v, Long id) {
        ReflectionTestUtils.setField(v, "id", id);
        return v;
    }

    private static org.assertj.core.data.TemporalUnitOffset within(long seconds) {
        return new org.assertj.core.data.TemporalUnitWithinOffset(seconds, ChronoUnit.SECONDS);
    }

    private static Property property() {
        Property p = new Property();
        ReflectionTestUtils.setField(p, "id", PROPERTY_ID);
        stamp(p);
        p.setAddressLine1("1 Queen Street");
        p.setPropertyType(PropertyType.RESIDENTIAL);
        return p;
    }

    private static Client client() {
        Client c = new Client();
        ReflectionTestUtils.setField(c, "id", CLIENT_ID);
        stamp(c);
        c.setDisplayName("A Vendor");
        return c;
    }

    private static OwnershipNode node(Long id) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        stamp(n);
        n.setOwnershipStructureId(STRUCTURE_ID);
        n.setNodeType(nz.amldock.ownership.NodeType.INDIVIDUAL);
        n.setDisplayName("Node " + id);
        n.setBeneficialOwnerId(300L);
        return n;
    }

    private static OwnershipEdge edge(Long parent, Long child) {
        OwnershipEdge e = new OwnershipEdge();
        ReflectionTestUtils.setField(e, "id", 400L);
        e.setParentNodeId(parent);
        e.setChildNodeId(child);
        return e;
    }

    private static Document document(Long id) {
        Document d = new Document();
        ReflectionTestUtils.setField(d, "id", id);
        stamp(d);
        d.setS3Key("deals/42/uuid-passport.pdf");
        d.setOriginalFilename("passport.pdf");
        d.setDealId(DEAL_ID);
        d.setBeneficialOwnerId(300L);
        d.setStatus(DocumentStatus.ACTIVE);
        return d;
    }

    private static BeneficialOwner person(Long id) {
        BeneficialOwner o = new BeneficialOwner();
        ReflectionTestUtils.setField(o, "id", id);
        stamp(o);
        o.setFullName("Jane Doe");
        return o;
    }

    /** Copies read these back, so they must be set — the live rows always have them. */
    private static void stamp(Object entity) {
        ReflectionTestUtils.setField(entity, "createdAt", Instant.parse("2026-01-05T09:00:00Z"));
        ReflectionTestUtils.setField(entity, "updatedAt", Instant.parse("2026-02-11T14:30:00Z"));
    }
}
