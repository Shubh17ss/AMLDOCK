package nz.amldock.beneficialowner;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.document.Document;
import nz.amldock.document.DocumentRepository;
import nz.amldock.document.DocumentStatus;
import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
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
 * How scanned IDs become people.
 *
 * <p>The behaviour worth guarding is the rule that a document never chooses whose evidence it is:
 * the person is decided at upload and extraction only fills them in. Everything else follows from
 * that — including the deliberate absence of any merging.
 */
@ExtendWith(MockitoExtension.class)
class BeneficialOwnerServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 100L;
    static final Long OWNER_ID = 50L;

    @Mock BeneficialOwnerRepository owners;
    @Mock DealBeneficialOwnerRepository links;
    @Mock DealRepository deals;
    @Mock DocumentRepository documents;
    @Mock FirmBranchRepository branches;
    @Mock OwnershipService ownership;
    @Mock DealLifecycleService lifecycle;

    BeneficialOwnerService service;

    @BeforeEach
    void setUp() {
        service = new BeneficialOwnerService(owners, links, deals, documents, branches, ownership,
                lifecycle, new ObjectMapper());

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

    /* ---------- creation at upload ---------- */

    @Test
    void confirmingAScanCreatesThePersonBeforeAnythingIsRead() {
        // The individual must exist from upload, not from a successful extraction — a card
        // Textract cannot read is still evidence that someone was presented.
        service.createProvisional(document("licence-front.jpg", DocumentType.NZ_DRIVER_LICENCE));

        ArgumentCaptor<BeneficialOwner> saved = ArgumentCaptor.forClass(BeneficialOwner.class);
        verify(owners).save(saved.capture());
        assertThat(saved.getValue().getFullName()).isNull();
        assertThat(saved.getValue().getDateOfBirth()).isNull();
        assertThat(saved.getValue().getReviewStatus()).isEqualTo(ReviewStatus.UNREVIEWED);
        assertThat(saved.getValue().getRealEstateFirmId()).isEqualTo(FIRM_ID);

        verify(links).save(any(DealBeneficialOwner.class));
        verify(ownership).attachExtractedIndividual(
                eq(DEAL_ID), any(), anyString(), eq(null), eq("NZ_DRIVER_LICENCE"));
    }

    @Test
    void anUnreadPersonIsNamedAfterTheirScan() {
        // ownership_node.display_name is NOT NULL, and naming the node after the file keeps it
        // traceable to its evidence in a way "Unknown" would not.
        service.createProvisional(document("blurry-licence.jpg", DocumentType.NZ_DRIVER_LICENCE));

        ArgumentCaptor<String> displayName = ArgumentCaptor.forClass(String.class);
        verify(ownership).attachExtractedIndividual(
                anyLong(), any(), displayName.capture(), any(), any());
        assertThat(displayName.getValue()).contains("blurry-licence.jpg");
    }

    /* ---------- extraction fills the person in ---------- */

    @Test
    void extractionFillsTheOwnerTheScanAlreadyBelongsTo() {
        BeneficialOwner owner = existing(OWNER_ID, null, null, null);
        when(owners.findById(OWNER_ID)).thenReturn(Optional.of(owner));

        service.applyExtraction(scan(OWNER_ID, IdSide.FRONT),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), LocalDate.of(2030, 4, 15), "0.950"));

        assertThat(owner.getFullName()).isEqualTo("Anna Eriksson");
        assertThat(owner.getDateOfBirth()).isEqualTo(LocalDate.of(1974, 8, 12));
        assertThat(owner.getIdExpiryDate()).isEqualTo(LocalDate.of(2030, 4, 15));
        verify(ownership).refreshExtractedIndividual(
                eq(OWNER_ID), eq("Anna Eriksson"), eq(LocalDate.of(1974, 8, 12)));
    }

    @Test
    void theBackOfACardDoesNotEraseWhatTheFrontRead() {
        // A licence back typically reads nothing. Front and back arrive in either order, so
        // neither may assume it went first.
        BeneficialOwner owner = existing(OWNER_ID, "Anna Eriksson", LocalDate.of(1974, 8, 12), null);
        owner.setExtractionConfidence("{\"fullName\":0.950,\"dateOfBirth\":0.950,\"expiryDate\":null}");
        when(owners.findById(OWNER_ID)).thenReturn(Optional.of(owner));

        service.applyExtraction(scan(OWNER_ID, IdSide.BACK), fields(null, null, null, null));

        assertThat(owner.getFullName()).isEqualTo("Anna Eriksson");
        assertThat(owner.getDateOfBirth()).isEqualTo(LocalDate.of(1974, 8, 12));
    }

    @Test
    void theBackFillsAGapTheFrontLeft() {
        BeneficialOwner owner = existing(OWNER_ID, "Anna Eriksson", LocalDate.of(1974, 8, 12), null);
        when(owners.findById(OWNER_ID)).thenReturn(Optional.of(owner));

        service.applyExtraction(scan(OWNER_ID, IdSide.BACK),
                fields(null, null, LocalDate.of(2030, 4, 15), "0.800"));

        assertThat(owner.getIdExpiryDate()).isEqualTo(LocalDate.of(2030, 4, 15));
    }

    @Test
    void extractionIsAnUpdateOnlyAndNeverCreatesAPerson() {
        BeneficialOwner owner = existing(OWNER_ID, null, null, null);
        when(owners.findById(OWNER_ID)).thenReturn(Optional.of(owner));

        service.applyExtraction(scan(OWNER_ID, IdSide.FRONT),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), null, "0.950"));

        verify(owners, never()).save(any());
        verify(links, never()).save(any());
        verify(ownership, never()).attachExtractedIndividual(anyLong(), any(), anyString(), any(), any());
    }

    @Test
    void aScanWhoseOwnerVanishedMidExtractionIsDropped() {
        // The broker can delete a scan while Textract is still reading it.
        when(owners.findById(OWNER_ID)).thenReturn(Optional.empty());

        service.applyExtraction(scan(OWNER_ID, IdSide.FRONT),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), null, "0.950"));

        verify(ownership, never()).refreshExtractedIndividual(anyLong(), any(), any());
    }

    @Test
    void aDocumentWithNoOwnerIsIgnored() {
        service.applyExtraction(scan(null, null),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), null, "0.950"));

        verify(owners, never()).findById(any());
    }

    /* ---------- no merging, ever ---------- */

    @Test
    void twoDocumentsReadingAsTheSamePersonStayTwoPeople() {
        // The previous round merged these on an exact name + date-of-birth match. It no longer
        // does: a different card is a different individual, and deciding otherwise is a
        // judgement rather than an extraction result. Asserted so it cannot regress quietly.
        BeneficialOwner first = existing(OWNER_ID, "Anna Eriksson", LocalDate.of(1974, 8, 12), null);
        BeneficialOwner second = existing(51L, null, null, null);
        when(owners.findById(51L)).thenReturn(Optional.of(second));

        service.applyExtraction(scan(51L, IdSide.FRONT),
                fields("Anna Eriksson", LocalDate.of(1974, 8, 12), null, "0.950"));

        // The second person is filled in on their own terms and the first is untouched.
        assertThat(second.getFullName()).isEqualTo("Anna Eriksson");
        assertThat(first.getFullName()).isEqualTo("Anna Eriksson");
        verify(owners, never()).deleteById(anyLong());
        // Nothing looked at who else is on the deal, because nothing needed to.
        verify(links, never()).findAllByDealIdOrderByCreatedAtAsc(anyLong());
    }

    /* ---------- fill-or-improve ---------- */

    @Test
    void aGapIsFilledWhateverTheConfidence() {
        assertThat(BeneficialOwnerService.shouldWrite(
                null, null, ExtractedField.of("X", new BigDecimal("0.100")))).isTrue();
    }

    @Test
    void onlyAStrictlyBetterReadingDisplacesAValue() {
        BigDecimal stored = new BigDecimal("0.900");
        assertThat(BeneficialOwnerService.shouldWrite(
                "old", stored, ExtractedField.of("new", new BigDecimal("0.950")))).isTrue();
        assertThat(BeneficialOwnerService.shouldWrite(
                "old", stored, ExtractedField.of("new", new BigDecimal("0.900")))).isFalse();
        assertThat(BeneficialOwnerService.shouldWrite(
                "old", stored, ExtractedField.of("new", new BigDecimal("0.100")))).isFalse();
    }

    @Test
    void anUnmeasuredReadingNeverDisplacesAMeasuredOne() {
        // Without a number to compare, "different" is not evidence of "better".
        assertThat(BeneficialOwnerService.shouldWrite(
                "old", new BigDecimal("0.900"), ExtractedField.of("new", null))).isFalse();
    }

    @Test
    void nothingReadMeansNothingWritten() {
        assertThat(BeneficialOwnerService.shouldWrite(
                "old", new BigDecimal("0.900"), ExtractedField.empty())).isFalse();
    }

    /* ---------- removal ---------- */

    @Test
    void removingOneSideOfACardKeepsThePerson() {
        // They were still presented, and the remaining image still evidences them.
        when(documents.findAllByBeneficialOwnerIdAndStatus(OWNER_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of(scan(OWNER_ID, IdSide.BACK)));

        service.removeIfOrphaned(OWNER_ID);

        verify(owners, never()).deleteById(anyLong());
        verify(ownership, never()).removeExtractedIndividual(anyLong());
    }

    @Test
    void removingTheLastScanRemovesThePerson() {
        when(documents.findAllByBeneficialOwnerIdAndStatus(OWNER_ID, DocumentStatus.ACTIVE))
                .thenReturn(List.of());

        service.removeIfOrphaned(OWNER_ID);

        verify(ownership).removeExtractedIndividual(OWNER_ID);
        verify(links).deleteAllByBeneficialOwnerId(OWNER_ID);
        verify(owners).deleteById(OWNER_ID);
    }

    @Test
    void aDocumentThatNeverHadAnOwnerRemovesNothing() {
        service.removeIfOrphaned(null);

        verify(owners, never()).deleteById(anyLong());
    }

    /* ---------- release on deal deletion ---------- */

    @Test
    void deletingADealRemovesAPersonLeftOnNoOtherDeal() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, OWNER_ID, 4L)));
        when(links.countByBeneficialOwnerId(OWNER_ID)).thenReturn(0L);

        service.releaseFromDeal(DEAL_ID);

        verify(links).deleteAllByDealId(DEAL_ID);
        verify(owners).deleteById(OWNER_ID);
    }

    @Test
    void deletingADealKeepsAPersonWhoAppearsOnAnother() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, OWNER_ID, 4L)));
        when(links.countByBeneficialOwnerId(OWNER_ID)).thenReturn(1L);

        service.releaseFromDeal(DEAL_ID);

        verify(links).deleteAllByDealId(DEAL_ID);
        verify(owners, never()).deleteById(anyLong());
    }

    @Test
    void countsAreTakenAfterTheLinksAreActuallyGone() {
        when(links.findAllByDealIdOrderByCreatedAtAsc(DEAL_ID))
                .thenReturn(List.of(new DealBeneficialOwner(DEAL_ID, OWNER_ID, 4L)));
        when(links.countByBeneficialOwnerId(OWNER_ID)).thenReturn(0L);

        service.releaseFromDeal(DEAL_ID);

        // Without the flush the count would still see the rows just deleted and every person
        // would look busy, so nothing would ever be cleaned up.
        InOrder order = inOrder(links);
        order.verify(links).deleteAllByDealId(DEAL_ID);
        order.verify(links).flush();
        order.verify(links).countByBeneficialOwnerId(OWNER_ID);
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

    private static Document document(String filename, DocumentType type) {
        Document d = new Document();
        d.setDealId(DEAL_ID);
        d.setOriginalFilename(filename);
        d.setDocumentType(type);
        return d;
    }

    private static Document scan(Long ownerId, IdSide side) {
        Document d = document("licence.jpg", DocumentType.NZ_DRIVER_LICENCE);
        d.setBeneficialOwnerId(ownerId);
        d.setIdSide(side);
        return d;
    }

    private static ExtractedIdFields fields(String name, LocalDate dob, LocalDate expiry, String confidence) {
        BigDecimal c = confidence == null ? null : new BigDecimal(confidence);
        return new ExtractedIdFields(
                ExtractedField.of(name, c),
                ExtractedField.of(dob, c),
                ExtractedField.of(expiry, c),
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
