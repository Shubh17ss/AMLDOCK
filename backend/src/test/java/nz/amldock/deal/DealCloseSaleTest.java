package nz.amldock.deal;

import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.deal.dto.CloseDealRequest;
import nz.amldock.deal.dto.SaleDto;
import nz.amldock.deal.sale.DealSaleUnit;
import nz.amldock.deal.sale.DealSaleUnitRepository;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Closing a deal, and what it finished as.
 *
 * <p>The rules live here rather than on the request DTO because the one that matters most cannot
 * be expressed as an annotation: which shape of answer is legal depends on the deal's own property
 * type, and the request must not get a say in that.
 */
@ExtendWith(MockitoExtension.class)
class DealCloseSaleTest {

    @Mock DealRepository deals;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock FirmBranchRepository branches;
    @Mock RealEstateFirmRepository firms;
    @Mock UserRepository users;
    @Mock DealNoteRepository dealNotes;
    @Mock DocumentRepository documents;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock DealRiskService risk;
    @Mock nz.amldock.ownership.OwnershipService ownership;
    @Mock nz.amldock.audit.AuditService audit;
    @Mock nz.amldock.notification.DealNotificationEnqueuer notifier;
    @Mock nz.amldock.deal.version.DealVersionService versions;
    @Mock DealSaleUnitRepository saleUnits;

    DealService service;

    /** A compliance officer of firm 1 — closing is a reviewer's move. */
    final UserPrincipal amlco =
            new UserPrincipal(20L, "amlco@firm.com", null, Role.AML_COMPLIANCE_OFFICER, 1L, null, true);

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService(mock(DealUserRepository.class)),
                new DealNoteService(dealNotes, documents, users),
                beneficialOwners, risk, ownership, audit, notifier, versions, saleUnits);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(amlco, null, amlco.getAuthorities()));

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(1L);
        ReflectionTestUtils.setField(branch, "id", 10L);
        lenient().when(branches.findById(10L)).thenReturn(Optional.of(branch));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- an ordinary sale ---------- */

    @Test
    void aSoldPropertyRecordsItsPrice() {
        Deal d = verifiedDeal(PropertyType.RESIDENTIAL);

        service.closeWithSale(1L, sold(new BigDecimal("1250000"), null));

        assertThat(d.getStatus()).isEqualTo(DealStatus.CLOSED);
        assertThat(d.getPropertySold()).isTrue();
        assertThat(d.getSalePrice()).isEqualByComparingTo("1250000");
        verify(saleUnits, never()).saveAll(any());
    }

    @Test
    void anUnsoldPropertyStillCloses() {
        Deal d = verifiedDeal(PropertyType.RESIDENTIAL);

        service.closeWithSale(1L, new CloseDealRequest(false, null, null));

        assertThat(d.getStatus()).isEqualTo(DealStatus.CLOSED);
        assertThat(d.getPropertySold()).isFalse();
        assertThat(d.getSalePrice()).isNull();
    }

    @Test
    void soldWithNoPriceIsRefused() {
        Deal d = verifiedDeal(PropertyType.RESIDENTIAL);

        assertThatThrownBy(() -> service.closeWithSale(1L, sold(null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("what the property sold for");

        // Refused before the transition, so the deal is exactly where it was.
        assertThat(d.getStatus()).isEqualTo(DealStatus.VERIFIED);
    }

    @Test
    void aPriceOnAnUnsoldPropertyIsRefused() {
        verifiedDeal(PropertyType.RESIDENTIAL);

        assertThatThrownBy(() -> service.closeWithSale(1L,
                new CloseDealRequest(false, new BigDecimal("10"), null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("did not sell");
    }

    @Test
    void unitsOnAnOrdinaryPropertyAreRefused() {
        verifiedDeal(PropertyType.RESIDENTIAL);

        assertThatThrownBy(() -> service.closeWithSale(1L,
                sold(null, List.of(unit("Flat 1", "100")))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Only a development");
    }

    /* ---------- a development sells as units ---------- */

    @Test
    void aDevelopmentRecordsAPricePerUnit() {
        Deal d = verifiedDeal(PropertyType.DEVELOPMENT);

        service.closeWithSale(1L, sold(null,
                List.of(unit("Unit 1", "500000"), unit("  Unit 2  ", "650000"))));

        assertThat(d.getPropertySold()).isTrue();
        // The deal-level figure stays empty: the total is summed from the rows on read, so a
        // stored copy could only ever go stale.
        assertThat(d.getSalePrice()).isNull();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DealSaleUnit>> saved = ArgumentCaptor.forClass(List.class);
        verify(saleUnits).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(DealSaleUnit::getUnitName)
                .containsExactly("Unit 1", "Unit 2");
        assertThat(saved.getValue()).extracting(DealSaleUnit::getSortOrder)
                .containsExactly(0, 1);
    }

    @Test
    void aDevelopmentWithNoUnitsIsRefused() {
        verifiedDeal(PropertyType.DEVELOPMENT);

        assertThatThrownBy(() -> service.closeWithSale(1L, sold(null, List.of())))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at least one unit");
    }

    @Test
    void aDevelopmentSentASingleFigureIsRefused() {
        verifiedDeal(PropertyType.DEVELOPMENT);

        assertThatThrownBy(() -> service.closeWithSale(1L,
                sold(new BigDecimal("1150000"), List.of(unit("Unit 1", "500000")))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("price per unit");
    }

    @Test
    void aUnitWithoutANameIsRefused() {
        verifiedDeal(PropertyType.DEVELOPMENT);

        assertThatThrownBy(() -> service.closeWithSale(1L,
                sold(null, List.of(unit("   ", "500000")))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("needs a name");
    }

    @Test
    void aUnitWithoutAPriceIsRefused() {
        verifiedDeal(PropertyType.DEVELOPMENT);

        assertThatThrownBy(() -> service.closeWithSale(1L,
                sold(null, List.of(unit("Unit 1", null)))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Unit 1");
    }

    /* ---------- re-closing overrides ---------- */

    @Test
    void reClosingReplacesTheUnitsRatherThanAddingToThem() {
        verifiedDeal(PropertyType.DEVELOPMENT);

        service.closeWithSale(1L, sold(null, List.of(unit("Unit 1", "500000"))));

        var order = inOrder(saleUnits);
        order.verify(saleUnits).deleteAllByDealId(1L);
        order.verify(saleUnits).flush();
        order.verify(saleUnits).saveAll(any());
    }

    @Test
    void closingAsUnsoldClearsUnitsLeftByAnEarlierClose() {
        Deal d = verifiedDeal(PropertyType.DEVELOPMENT);
        d.setSalePrice(new BigDecimal("500000"));

        service.closeWithSale(1L, new CloseDealRequest(false, null, null));

        assertThat(d.getSalePrice()).isNull();
        verify(saleUnits).deleteAllByDealId(1L);
        verify(saleUnits, never()).saveAll(any());
    }

    /* ---------- reading it back ---------- */

    @Test
    void theTotalOfADevelopmentIsSummedFromItsUnits() {
        Deal d = verifiedDeal(PropertyType.DEVELOPMENT);
        d.setPropertySold(true);
        when(saleUnits.findAllByDealIdOrderBySortOrderAsc(1L)).thenReturn(List.of(
                new DealSaleUnit(1L, "Unit 1", new BigDecimal("500000"), 0),
                new DealSaleUnit(1L, "Unit 2", new BigDecimal("650000"), 1)));

        SaleDto dto = service.sale(1L);

        assertThat(dto.propertySold()).isTrue();
        assertThat(dto.salePrice()).isNull();
        assertThat(dto.total()).isEqualByComparingTo("1150000");
        assertThat(dto.units()).extracting(SaleDto.SaleUnitDto::unitName)
                .containsExactly("Unit 1", "Unit 2");
    }

    @Test
    void theTotalOfAnOrdinarySaleIsItsOwnPrice() {
        Deal d = verifiedDeal(PropertyType.RESIDENTIAL);
        d.setPropertySold(true);
        d.setSalePrice(new BigDecimal("1250000"));
        when(saleUnits.findAllByDealIdOrderBySortOrderAsc(1L)).thenReturn(List.of());

        SaleDto dto = service.sale(1L);

        assertThat(dto.total()).isEqualByComparingTo("1250000");
        assertThat(dto.units()).isEmpty();
    }

    @Test
    void aDealNeverClosedHasNothingRecorded() {
        verifiedDeal(PropertyType.RESIDENTIAL);
        when(saleUnits.findAllByDealIdOrderBySortOrderAsc(1L)).thenReturn(List.of());

        SaleDto dto = service.sale(1L);

        // Null rather than false: nobody has been asked, which reads differently from a No.
        assertThat(dto.propertySold()).isNull();
        assertThat(dto.total()).isNull();
    }

    /* ---------- helpers ---------- */

    private Deal verifiedDeal(PropertyType type) {
        Deal d = new Deal();
        ReflectionTestUtils.setField(d, "id", 1L);
        d.setStatus(DealStatus.VERIFIED);
        d.setCreatedByUserId(7L);
        d.setFirmBranchId(10L);
        d.setPropertyId(2L);
        d.setReference("DEAL-2026-0001");
        when(deals.findById(1L)).thenReturn(Optional.of(d));

        Property p = new Property();
        ReflectionTestUtils.setField(p, "id", 2L);
        p.setPropertyType(type);
        lenient().when(properties.findById(2L)).thenReturn(Optional.of(p));
        return d;
    }

    private static CloseDealRequest sold(BigDecimal price, List<CloseDealRequest.SaleUnitInput> units) {
        return new CloseDealRequest(true, price, units);
    }

    private static CloseDealRequest.SaleUnitInput unit(String name, String price) {
        return new CloseDealRequest.SaleUnitInput(name, price == null ? null : new BigDecimal(price));
    }
}
