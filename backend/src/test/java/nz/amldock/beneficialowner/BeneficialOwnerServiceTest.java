package nz.amldock.beneficialowner;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentType;
import nz.amldock.document.ocr.ExtractedField;
import nz.amldock.document.ocr.ExtractedIdFields;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * How extraction output becomes people.
 *
 * <p>The behaviour worth guarding is what the service refuses to do: it must not turn two scans
 * of one person into two people, and it must not merge two people it cannot actually identify.
 */
@ExtendWith(MockitoExtension.class)
class BeneficialOwnerServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 100L;

    @Mock BeneficialOwnerRepository owners;
    @Mock DealBeneficialOwnerRepository links;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock OwnershipService ownership;
    @Mock DealLifecycleService lifecycle;

    BeneficialOwnerService service;

    @BeforeEach
    void setUp() {
        service = new BeneficialOwnerService(owners, links, deals, branches, ownership, lifecycle,
                new ObjectMapper());

        Deal deal = new Deal();
        deal.setFirmBranchId(BRANCH_ID);
        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);

        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));
        lenient().when(owners.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(ownership.attachExtractedIndividual(anyLong(), any(), anyString(), any(), any()))
                .thenReturn(new OwnershipNode());
    }

    @Test
    void createsAPersonAndAnOwnershipNodeFromTheFirstScan() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID)).thenReturn(List.of());

        service.recordFromExtraction(document("licence.jpg", DocumentType.DRIVER_LICENCE),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), LocalDate.of(2030, 4, 15)));

        verify(owners).save(any(BeneficialOwner.class));
        verify(links).save(any(DealBeneficialOwner.class));
        verify(ownership).attachExtractedIndividual(
                eq(DEAL_ID), any(), eq("Anna Eriksson"),
                eq(LocalDate.of(1974, 8, 12)), eq("DRIVER_LICENCE"));
    }

    @Test
    void aSecondScanOfTheSamePersonDoesNotCreateASecondPerson() {
        // A client with both a licence and a passport is one human with two documents.
        BeneficialOwner existing = existing(50L, "ANNA ERIKSSON", LocalDate.of(1974, 8, 12), null);
        givenDealHas(existing);

        BeneficialOwner result = service.recordFromExtraction(
                document("passport.jpg", DocumentType.PASSPORT),
                fields("Anna  Eriksson", LocalDate.of(1974, 8, 12), LocalDate.of(2030, 4, 15)));

        assertThat(result).isSameAs(existing);
        verify(owners, never()).save(any());
        verify(links, never()).save(any());
        verify(ownership, never()).attachExtractedIndividual(anyLong(), any(), anyString(), any(), any());
    }

    @Test
    void theSecondScanFillsGapsWithoutOverwriting() {
        BeneficialOwner existing = existing(50L, "ANNA ERIKSSON", LocalDate.of(1974, 8, 12), null);
        givenDealHas(existing);

        service.recordFromExtraction(document("passport.jpg", DocumentType.PASSPORT),
                fields("ANNA ERIKSSON", LocalDate.of(1974, 8, 12), LocalDate.of(2030, 4, 15)));

        // Expiry was missing and is now known.
        assertThat(existing.getIdExpiryDate()).isEqualTo(LocalDate.of(2030, 4, 15));
        // The name was already there and is not disturbed by the rescan.
        assertThat(existing.getFullName()).isEqualTo("ANNA ERIKSSON");
    }

    @Test
    void twoUnreadableScansDoNotBecomeOnePerson() {
        // A null identifies nobody, so the service must not even look for a match — comparing
        // null to null would fuse two unrelated people into a single AML record. Asserting that
        // the deal's existing people are never consulted pins the short-circuit itself, not just
        // its outcome.
        service.recordFromExtraction(document("blurry.jpg", DocumentType.DRIVER_LICENCE),
                fields(null, null, null));

        verify(links, never()).findAllByDealIdOrderByCreatedAtAsc(anyLong());
        verify(owners).save(any(BeneficialOwner.class));
    }

    @Test
    void aMatchingNameWithADifferentBirthDateIsADifferentPerson() {
        BeneficialOwner existing = existing(50L, "ANNA ERIKSSON", LocalDate.of(1974, 8, 12), null);
        givenDealHas(existing);

        service.recordFromExtraction(document("licence.jpg", DocumentType.DRIVER_LICENCE),
                fields("Anna Eriksson", LocalDate.of(1981, 3, 2), null));

        verify(owners).save(any(BeneficialOwner.class));
    }

    @Test
    void anUnreadableScanStillGetsANodeNamedAfterItsEvidence() {
        // ownership_node.display_name is NOT NULL, so this path must produce something — and
        // naming it after the file keeps the node traceable back to the scan.
        service.recordFromExtraction(document("blurry-licence.jpg", DocumentType.DRIVER_LICENCE),
                fields(null, null, null));

        ArgumentCaptor<String> displayName = ArgumentCaptor.forClass(String.class);
        verify(ownership).attachExtractedIndividual(
                anyLong(), any(), displayName.capture(), any(), any());
        assertThat(displayName.getValue()).contains("blurry-licence.jpg");
    }

    @Test
    void recordsPerFieldConfidence() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID)).thenReturn(List.of());

        service.recordFromExtraction(document("licence.jpg", DocumentType.DRIVER_LICENCE),
                new ExtractedIdFields(
                        ExtractedField.of("Anna Eriksson", new BigDecimal("0.940")),
                        ExtractedField.of(LocalDate.of(1974, 8, 12), new BigDecimal("1.000")),
                        ExtractedField.empty(),
                        "raw"));

        ArgumentCaptor<BeneficialOwner> saved = ArgumentCaptor.forClass(BeneficialOwner.class);
        verify(owners).save(saved.capture());
        assertThat(saved.getValue().getExtractionConfidence())
                .contains("\"fullName\":0.940")
                .contains("\"dateOfBirth\":1.000")
                // A field that was never read reports null rather than zero, which would read as
                // "we looked and were certain it was nothing".
                .contains("\"expiryDate\":null");
        assertThat(saved.getValue().getReviewStatus()).isEqualTo(ReviewStatus.UNREVIEWED);
    }

    /* ---------- release on deal deletion ---------- */

    @Test
    void deletingADealRemovesAPersonLeftOnNoOtherDeal() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, 50L, 4L)));
        when(links.countByBeneficialOwnerId(50L)).thenReturn(0L);

        service.releaseFromDeal(DEAL_ID);

        verify(links).deleteAllByDealId(DEAL_ID);
        // Nothing can reach this person any more, so keeping the row would only accumulate
        // identity data no one can review.
        verify(owners).deleteById(50L);
    }

    @Test
    void deletingADealKeepsAPersonWhoAppearsOnAnother() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, 50L, 4L)));
        when(links.countByBeneficialOwnerId(50L)).thenReturn(1L);

        service.releaseFromDeal(DEAL_ID);

        verify(links).deleteAllByDealId(DEAL_ID);
        // Deleting one deal says nothing about the others the same human appears on — which is
        // the entire reason a person is not owned by a single deal.
        verify(owners, never()).deleteById(anyLong());
    }

    @Test
    void countsAreTakenAfterTheLinksAreActuallyGone() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, 50L, 4L)));
        when(links.countByBeneficialOwnerId(50L)).thenReturn(0L);

        service.releaseFromDeal(DEAL_ID);

        // Without the flush the count would still see the rows just deleted and every person
        // would look busy, so nothing would ever be cleaned up.
        InOrder order = inOrder(links);
        order.verify(links).deleteAllByDealId(DEAL_ID);
        order.verify(links).flush();
        order.verify(links).countByBeneficialOwnerId(50L);
    }

    @Test
    void aDealWithNoPeopleTouchesNothing() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID)).thenReturn(List.of());

        service.releaseFromDeal(DEAL_ID);

        verify(links, never()).deleteAllByDealId(anyLong());
        verify(owners, never()).deleteById(anyLong());
    }

    @Test
    void nameNormalisationCollapsesWhitespaceButKeepsCase() {
        assertThat(BeneficialOwnerService.normaliseName("  Anna   Maria  Eriksson "))
                .isEqualTo("Anna Maria Eriksson");
        assertThat(BeneficialOwnerService.normaliseName("   ")).isNull();
        assertThat(BeneficialOwnerService.normaliseName(null)).isNull();
    }

    /* ---------- fixtures ---------- */

    private void givenDealHas(BeneficialOwner owner) {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, owner.getId(), 4L)));
        when(owners.findById(owner.getId())).thenReturn(Optional.of(owner));
    }

    private static Document document(String filename, DocumentType type) {
        Document d = new Document();
        d.setDealId(DEAL_ID);
        d.setOriginalFilename(filename);
        d.setDocumentType(type);
        return d;
    }

    private static ExtractedIdFields fields(String name, LocalDate dob, LocalDate expiry) {
        return new ExtractedIdFields(
                ExtractedField.of(name, name == null ? null : new BigDecimal("0.950")),
                ExtractedField.of(dob, dob == null ? null : new BigDecimal("0.950")),
                ExtractedField.of(expiry, expiry == null ? null : new BigDecimal("0.950")),
                "raw text");
    }

    private static BeneficialOwner existing(Long id, String name, LocalDate dob, LocalDate expiry) {
        BeneficialOwner o = new BeneficialOwner();
        // id is generated by the database, so there is no setter to call.
        ReflectionTestUtils.setField(o, "id", id);
        o.setRealEstateFirmId(FIRM_ID);
        o.setFullName(name);
        o.setDateOfBirth(dob);
        o.setIdExpiryDate(expiry);
        return o;
    }
}
