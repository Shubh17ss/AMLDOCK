package nz.amldock.individual;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.BeneficialOwnerRepository;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealListService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.document.DocumentService;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
import nz.amldock.document.OcrStatus;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructure;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.ownership.PersonRole;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.dto.PropertyDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What {@code detail} owes its one caller: the whole record, and somebody else's rule about who
 * may see it.
 *
 * <p>The owner picker copies an individual from one deal onto another, so the read behind it
 * crosses a deal boundary that every other ownership read stays inside. That makes "the check is
 * delegated, not reimplemented" the property worth pinning down.
 */
@ExtendWith(MockitoExtension.class)
class IndividualServiceTest {

    static final Long NODE_ID = 5L;
    static final Long STRUCTURE_ID = 20L;
    static final Long DEAL_ID = 1L;
    static final Long PERSON_ID = 7L;
    static final Long PROPERTY_ID = 30L;

    @Mock DealService dealService;
    @Mock DealListService dealList;
    @Mock IndividualQuery query;
    @Mock DealRepository deals;
    @Mock OwnershipStructureRepository structures;
    @Mock OwnershipNodeRepository nodes;
    @Mock BeneficialOwnerRepository owners;
    @Mock PropertyRepository properties;
    @Mock DocumentService documentService;

    IndividualService service;

    @BeforeEach
    void setUp() {
        service = new IndividualService(dealService, dealList, query, deals, structures, nodes, owners, properties,
                documentService);
    }

    /* ---------- the register page ---------- */

    @Test
    void aRegisterPageMapsOnlyItsOwnRowsInTheQuerysOrder() {
        OwnershipNode first = individualNode();
        OwnershipNode second = individualNode();
        ReflectionTestUtils.setField(second, "id", 6L);
        second.setDisplayName("Mei Chen");
        second.setBeneficialOwnerId(null);
        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setReference(null);

        when(dealList.scopeForCurrentUser(null, null)).thenReturn(new nz.amldock.deal.DealScope(null, 1L, null));
        when(query.page(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(25), org.mockito.ArgumentMatchers.eq(0L)))
                .thenReturn(new nz.amldock.common.web.IdPage(List.of(6L, NODE_ID), 40));
        // findAllById hands rows back in any order; the page must keep the query's.
        when(nodes.findAllById(List.of(6L, NODE_ID))).thenReturn(List.of(first, second));
        when(structures.findAllById(List.of(STRUCTURE_ID))).thenReturn(List.of(structure()));
        when(deals.findAllById(List.of(DEAL_ID))).thenReturn(List.of(deal));
        when(owners.findAllById(List.of(PERSON_ID))).thenReturn(List.of(person()));

        var page = service.list(new IndividualQuery.Filter(null, null, false, null, null, null),
                nz.amldock.common.web.PageRequests.of(0, 25));

        assertThat(page.totalElements()).isEqualTo(40);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.items()).extracting(IndividualRowDto::nodeId).containsExactly(6L, NODE_ID);
        assertThat(page.items().get(0).countryOfResidence()).isNull();
        assertThat(page.items().get(1).countryOfResidence()).isEqualTo("NZ");
        assertThat(page.items().get(0).dealReference()).isEqualTo("#" + DEAL_ID);
    }

    @Test
    void returnsTheWholeRecordForAReadableIndividual() {
        when(nodes.findById(NODE_ID)).thenReturn(Optional.of(individualNode()));
        when(structures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure()));
        when(dealService.get(DEAL_ID)).thenReturn(dealDto("D-2291"));
        when(properties.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));
        when(owners.findById(PERSON_ID)).thenReturn(Optional.of(person()));
        when(documentService.listForNode(NODE_ID)).thenReturn(List.of(passport()));

        IndividualDetailDto d = service.detail(NODE_ID);

        assertThat(d.nodeId()).isEqualTo(NODE_ID);
        assertThat(d.displayName()).isEqualTo("John Aroha Smith");
        assertThat(d.dateOfBirth()).isEqualTo(LocalDate.of(1978, 3, 12));
        assertThat(d.personRoles()).containsExactly(PersonRole.EFFECTIVE_CONTROLLER);
        assertThat(d.verificationStatus()).isEqualTo(NodeVerificationStatus.VERIFIED);
        // The two lines that tell apart two people who happen to share a name.
        assertThat(d.dealReference()).isEqualTo("D-2291");
        assertThat(d.propertyAddress()).isEqualTo("14 Ridgeway Rd, Remuera, Auckland");
        // The contact fields are the reason this endpoint exists — the register row has none.
        assertThat(d.person()).isNotNull();
        assertThat(d.person().email()).isEqualTo("j.smith@example.com");
        assertThat(d.person().occupation()).isEqualTo("Builder");
        assertThat(d.person().countryOfResidence()).isEqualTo("NZ");
        // Named, not counted: the picker says what it is about to copy before anyone commits.
        assertThat(d.documents()).singleElement()
                .satisfies(doc -> {
                    assertThat(doc.originalFilename()).isEqualTo("passport-front.jpg");
                    assertThat(doc.idSide()).isEqualTo(IdSide.FRONT);
                    assertThat(doc.sizeBytes()).isEqualTo(2_100_000L);
                });
    }

    @Test
    void aDealTheCallerCannotOpenHidesItsPeopleToo() {
        when(nodes.findById(NODE_ID)).thenReturn(Optional.of(individualNode()));
        when(structures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure()));
        // DealService.get runs lifecycle.assertCanRead. Delegating means this service never gets
        // its own copy of the role rules to drift out of step with that one.
        when(dealService.get(DEAL_ID)).thenThrow(new ForbiddenException("Not your firm's deal"));

        assertThatThrownBy(() -> service.detail(NODE_ID))
                .isInstanceOf(ForbiddenException.class);

        // Nothing about the person is read once the deal is refused.
        verify(owners, never()).findById(PERSON_ID);
    }

    @Test
    void aNodeThatIsNotAnIndividualIsNotFoundHere() {
        OwnershipNode company = individualNode();
        company.setNodeType(NodeType.PRIVATE_COMPANY);
        when(nodes.findById(NODE_ID)).thenReturn(Optional.of(company));

        assertThatThrownBy(() -> service.detail(NODE_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void anUnknownNodeIsNotFound() {
        when(nodes.findById(NODE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(NODE_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void survivesAPersonRecordDeletedOutFromUnderTheNode() {
        OwnershipNode orphan = individualNode();
        orphan.setBeneficialOwnerId(null);   // beneficial_owner_id is ON DELETE SET NULL
        when(nodes.findById(NODE_ID)).thenReturn(Optional.of(orphan));
        when(structures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure()));
        when(dealService.get(DEAL_ID)).thenReturn(dealDto("D-2291"));
        when(properties.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));

        when(documentService.listForNode(NODE_ID)).thenReturn(List.of());

        IndividualDetailDto d = service.detail(NODE_ID);

        assertThat(d.person()).isNull();
        assertThat(d.displayName()).isEqualTo("John Aroha Smith");
    }

    @Test
    void namesADealThatNeverGotAReference() {
        when(nodes.findById(NODE_ID)).thenReturn(Optional.of(individualNode()));
        when(structures.findById(STRUCTURE_ID)).thenReturn(Optional.of(structure()));
        when(dealService.get(DEAL_ID)).thenReturn(dealDto(null));
        when(properties.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));
        when(owners.findById(PERSON_ID)).thenReturn(Optional.of(person()));
        when(documentService.listForNode(NODE_ID)).thenReturn(List.of());

        // Same fallback the register uses, so one person reads the same in both places.
        assertThat(service.detail(NODE_ID).dealReference()).isEqualTo("#" + DEAL_ID);
    }

    /* ---------- fixtures ---------- */

    private static OwnershipNode individualNode() {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", NODE_ID);
        n.setOwnershipStructureId(STRUCTURE_ID);
        n.setNodeType(NodeType.INDIVIDUAL);
        n.setDisplayName("John Aroha Smith");
        n.setDateOfBirth(LocalDate.of(1978, 3, 12));
        n.setPersonRoles(java.util.Set.of(PersonRole.EFFECTIVE_CONTROLLER));
        n.setVerificationStatus(NodeVerificationStatus.VERIFIED);
        n.setBeneficialOwnerId(PERSON_ID);
        return n;
    }

    private static OwnershipStructure structure() {
        OwnershipStructure s = new OwnershipStructure();
        ReflectionTestUtils.setField(s, "id", STRUCTURE_ID);
        s.setDealId(DEAL_ID);
        return s;
    }

    private static DealDto dealDto(String reference) {
        Deal deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        ReflectionTestUtils.setField(deal, "reference", reference);
        PropertyDto p = new PropertyDto(PROPERTY_ID, "14 Ridgeway Rd", null, "Remuera",
                "Auckland", null, "NZ", null, null, null, null, null, null);
        return DealDto.from(deal, "Bayleys", "Remuera", p, null, "agent@example.com");
    }

    private static Property property() {
        Property p = new Property();
        p.setAddressLine1("14 Ridgeway Rd");
        p.setSuburb("Remuera");
        p.setDistrict("Auckland");
        return p;
    }

    private static DocumentDto passport() {
        return new DocumentDto(99L, "passport-front.jpg", "image/jpeg", 2_100_000L,
                DocumentType.PASSPORT, DocumentStatus.ACTIVE,
                DEAL_ID, NODE_ID, PERSON_ID, IdSide.FRONT,
                3L, "agent@example.com",
                OcrStatus.DONE, "textract", null, null, Instant.now(),
                Instant.now(), Instant.now());
    }

    private static BeneficialOwner person() {
        BeneficialOwner o = new BeneficialOwner();
        ReflectionTestUtils.setField(o, "id", PERSON_ID);
        o.setFullName("John Aroha Smith");
        o.setEmail("j.smith@example.com");
        o.setOccupation("Builder");
        o.setCountryOfResidence("NZ");
        return o;
    }
}
