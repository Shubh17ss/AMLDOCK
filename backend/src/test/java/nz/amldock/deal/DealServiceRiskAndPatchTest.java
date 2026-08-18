package nz.amldock.deal;

import nz.amldock.client.Client;
import nz.amldock.client.ClientRepository;
import nz.amldock.client.ClientType;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
import nz.amldock.property.dto.PropertyInput;
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

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Covers the two things the deal-creation rework depends on being true:
 * the risk rating is derived from the deal's own inputs on every write, and a partial PATCH
 * never disturbs a field it didn't mention.
 */
@ExtendWith(MockitoExtension.class)
class DealServiceRiskAndPatchTest {

    @Mock DealRepository deals;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock FirmBranchRepository branches;
    @Mock RealEstateFirmRepository firms;
    @Mock UserRepository users;

    DealService service;

    /** An agent in firm 1, branch 10 — the only shape of user that may create a deal. */
    final UserPrincipal agent =
            new UserPrincipal(7L, "agent@firm.com", null, Role.AGENT, 1L, 10L, true);

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(agent, null, agent.getAuthorities()));

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(1L);
        branch.setActive(true);
        setId(branch, 10L);
        lenient().when(branches.findById(10L)).thenReturn(Optional.of(branch));
        lenient().when(properties.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(clients.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(deals.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- risk rating ---------- */

    @Test
    void newDealDefaultsToLowRisk() {
        Deal d = service.create(request(null));

        assertThat(d.getRiskRating()).isEqualTo(RiskRating.LOW);
        assertThat(d.getRiskRatingSource()).isEqualTo(RiskRatingSource.DERIVED);
    }

    @Test
    void onSoldQuicklyMakesTheDealHighRisk() {
        Deal d = service.create(request(true));

        assertThat(d.getRiskRating()).isEqualTo(RiskRating.HIGH);
    }

    @Test
    void patchingOnSoldQuicklyRederivesTheRating() {
        Deal d = draftInRepo();
        d.setOnSoldQuickly(false);
        d.setRiskRating(RiskRating.LOW);

        service.update(1L, update(u -> u.onSoldQuickly(true)));
        assertThat(d.getRiskRating()).isEqualTo(RiskRating.HIGH);

        service.update(1L, update(u -> u.onSoldQuickly(false)));
        assertThat(d.getRiskRating()).isEqualTo(RiskRating.LOW);
    }

    @Test
    void anOverriddenRatingSurvivesFurtherEdits() {
        Deal d = draftInRepo();
        d.setRiskRatingSource(RiskRatingSource.OVERRIDE);
        d.setRiskRating(RiskRating.MEDIUM);

        service.update(1L, update(u -> u.onSoldQuickly(true)));

        assertThat(d.getRiskRating()).isEqualTo(RiskRating.MEDIUM);
    }

    /* ---------- partial patches ---------- */

    /**
     * The regression the deal form's persistence engine exists to prevent: the old wizard
     * created a draft and then only ever re-sent {@code notes}, silently dropping edits made
     * to earlier steps.
     */
    @Test
    void patchingOneFieldLeavesEveryOtherFieldAlone() {
        Deal d = draftInRepo();
        d.setTransactionPurpose("Downsizing after retirement");
        d.setTrustInvolved(true);
        d.setForeignExposureCountry("NONE");
        d.setValuationMin(new BigDecimal("800000"));
        d.setValuationMax(new BigDecimal("900000"));

        service.update(1L, update(u -> u.notes("Called the vendor back")));

        assertThat(d.getNotes()).isEqualTo("Called the vendor back");
        assertThat(d.getTransactionPurpose()).isEqualTo("Downsizing after retirement");
        assertThat(d.getTrustInvolved()).isTrue();
        assertThat(d.getForeignExposureCountry()).isEqualTo("NONE");
        assertThat(d.getValuationMin()).isEqualByComparingTo("800000");
        assertThat(d.getValuationMax()).isEqualByComparingTo("900000");
    }

    @Test
    void theNoneSentinelReplacesAPreviouslyChosenCountry() {
        Deal d = draftInRepo();
        d.setForeignExposureCountry("FR");

        service.update(1L, update(u -> u.foreignExposureCountry("NONE")));

        assertThat(d.getForeignExposureCountry()).isEqualTo("NONE");
    }

    @Test
    void patchingTheClientNameKeepsItsContactDetails() {
        draftInRepo();
        Client c = new Client();
        c.setEmail("jane@example.com");
        c.setPhone("021 555 0100");
        when(clients.findById(any())).thenReturn(Optional.of(c));

        service.updateClient(1L, new ClientInput("Jane Marsh", null, null, null));

        assertThat(c.getDisplayName()).isEqualTo("Jane Marsh");
        assertThat(c.getEmail()).isEqualTo("jane@example.com");
        assertThat(c.getPhone()).isEqualTo("021 555 0100");
    }

    @Test
    void propertyTypeAndReasonSurviveALaterDealPatch() {
        draftInRepo();
        Property p = new Property();
        p.setPropertyType(PropertyType.APARTMENT);
        p.setReasonForSelling("DOWNSIZING");
        when(properties.findById(any())).thenReturn(Optional.of(p));

        // A property patch that only carries the address must not clear the classification.
        service.updateProperty(1L, new PropertyInput("12 Queen St", null, null, null, null,
                null, null, null, null, null, null, null));

        assertThat(p.getAddressLine1()).isEqualTo("12 Queen St");
        assertThat(p.getPropertyType()).isEqualTo(PropertyType.APARTMENT);
        assertThat(p.getReasonForSelling()).isEqualTo("DOWNSIZING");
    }

    /* ---------- valuation range ---------- */

    @Test
    void aMaximumBelowTheMinimumIsRejected() {
        draftInRepo();

        assertThatThrownBy(() -> service.update(1L, update(u -> u
                .valuationMin(new BigDecimal("900000"))
                .valuationMax(new BigDecimal("800000")))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot be below the minimum");
    }

    /**
     * The check runs against the merged state, not the request, so a PATCH carrying one bound
     * is still measured against the bound already stored.
     */
    @Test
    void aSingleBoundIsCheckedAgainstTheStoredOne() {
        Deal d = draftInRepo();
        d.setValuationMax(new BigDecimal("800000"));

        assertThatThrownBy(() -> service.update(1L, update(u -> u.valuationMin(new BigDecimal("900000")))))
                .isInstanceOf(BadRequestException.class);
    }

    /* ---------- creation ---------- */

    @Test
    void theBranchIsDerivedFromTheAgentWhenTheRequestOmitsIt() {
        Deal d = service.create(request(null));

        assertThat(d.getFirmBranchId()).isEqualTo(10L);
    }

    /**
     * The client is provisional until admin/AMLCo runs the ownership review, so creation must
     * tolerate a name with no type behind it.
     */
    @Test
    void aClientWithNoTypeIsAccepted() {
        CreateDealRequest req = new CreateDealRequest(
                null, TransactionType.SALE, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                new PropertyInput("12 Queen St", null, null, null, null, null, null, null, null, null, null, null),
                new ClientInput("Jane Marsh", null, null, null));

        service.create(req);

        assertThat(savedClient().getDisplayName()).isEqualTo("Jane Marsh");
        assertThat(savedClient().getClientType()).isNull();
    }

    @Test
    void aClientTypeIsStillStoredWhenOneIsGiven() {
        CreateDealRequest req = new CreateDealRequest(
                null, TransactionType.SALE, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                new ClientInput("Marsh Family Trust", ClientType.ENTITY, null, null));

        service.create(req);

        assertThat(savedClient().getClientType()).isEqualTo(ClientType.ENTITY);
    }

    /* ---------- helpers ---------- */

    private CreateDealRequest request(Boolean onSoldQuickly) {
        return new CreateDealRequest(
                null, TransactionType.SALE, null, null, null, null, null, null,
                "Retiring overseas", false, onSoldQuickly, "NONE", false, null, null,
                new PropertyInput("12 Queen St", null, null, null, null, null, null, null, null,
                        null, PropertyType.RESIDENTIAL_HOUSE, "RETIREMENT_OR_CARE"),
                new ClientInput("Jane Marsh", null, null, null));
    }

    /** A DRAFT deal owned by {@link #agent}, findable at id 1, that update() can load. */
    private Deal draftInRepo() {
        Deal d = new Deal();
        setId(d, 1L);
        d.setStatus(DealStatus.DRAFT);
        d.setCreatedByUserId(agent.id());
        d.setFirmBranchId(10L);
        d.setPropertyId(2L);
        d.setClientId(3L);
        d.setTransactionType(TransactionType.SALE);
        when(deals.findById(1L)).thenReturn(Optional.of(d));
        return d;
    }

    private Client savedClient() {
        var captor = org.mockito.ArgumentCaptor.forClass(Client.class);
        org.mockito.Mockito.verify(clients).save(captor.capture());
        return captor.getValue();
    }

    /**
     * UpdateDealRequest is a 15-field positional record, so tests build one through a small
     * builder rather than counting nulls at every call site.
     */
    private UpdateDealRequest update(java.util.function.UnaryOperator<Patch> fn) {
        return fn.apply(new Patch()).build();
    }

    static final class Patch {
        String notes, transactionPurpose, foreignExposureCountry;
        Boolean trustInvolved, onSoldQuickly, redFlagPresent;
        BigDecimal valuationMin, valuationMax;

        Patch notes(String v) { this.notes = v; return this; }
        Patch transactionPurpose(String v) { this.transactionPurpose = v; return this; }
        Patch foreignExposureCountry(String v) { this.foreignExposureCountry = v; return this; }
        Patch trustInvolved(Boolean v) { this.trustInvolved = v; return this; }
        Patch onSoldQuickly(Boolean v) { this.onSoldQuickly = v; return this; }
        Patch redFlagPresent(Boolean v) { this.redFlagPresent = v; return this; }
        Patch valuationMin(BigDecimal v) { this.valuationMin = v; return this; }
        Patch valuationMax(BigDecimal v) { this.valuationMax = v; return this; }

        UpdateDealRequest build() {
            return new UpdateDealRequest(null, null, null, null, null, null, null, notes,
                    transactionPurpose, trustInvolved, onSoldQuickly, foreignExposureCountry,
                    redFlagPresent, valuationMin, valuationMax);
        }
    }

    /** Entity ids are generated by the DB, so tests set them through the field directly. */
    private static void setId(Object entity, Long id) {
        try {
            var f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
