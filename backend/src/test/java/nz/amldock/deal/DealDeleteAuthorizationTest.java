package nz.amldock.deal;

import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.PropertyRepository;
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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Who may destroy a deal.
 *
 * <p>Deleting one is the most destructive thing the app does — the property, the client, the
 * ownership structure, the documents, the timeline and any signed-off version go with it — and
 * until now the rule behind it had no test at all. It is also now reachable in two clicks from
 * the register, which is the reason to pin it.
 *
 * <p>Three shapes of deleter: ROOT anywhere; the two firm-level deciders within their own firm;
 * and the broker who filed it, only while it is still theirs to finish.
 */
@ExtendWith(MockitoExtension.class)
class DealDeleteAuthorizationTest {

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
    @Mock nz.amldock.deal.sale.DealSaleUnitRepository saleUnits;

    DealService service;

    /** Branch 10 belongs to firm 1; branch 20 belongs to firm 2. */
    private static final Long OWN_BRANCH = 10L;
    private static final Long OTHER_FIRM_BRANCH = 20L;
    private static final Long AUTHOR_ID = 7L;

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService(mock(DealUserRepository.class)),
                new DealNoteService(dealNotes, documents, users),
                beneficialOwners, risk, ownership, audit, notifier, versions, saleUnits);

        lenient().when(branches.findById(OWN_BRANCH)).thenReturn(Optional.of(branch(OWN_BRANCH, 1L)));
        lenient().when(branches.findById(OTHER_FIRM_BRANCH))
                .thenReturn(Optional.of(branch(OTHER_FIRM_BRANCH, 2L)));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- ROOT ---------- */

    @Test
    void rootDeletesAnyDealInAnyFirm() {
        Deal d = dealIn(OTHER_FIRM_BRANCH, DealStatus.VERIFIED, AUTHOR_ID);
        signedInAs(Role.ROOT, 1L, null, 99L);

        assertThatCode(() -> service.delete(1L)).doesNotThrowAnyException();
        verify(deals).delete(d);
    }

    /* ---------- the two firm-level deciders ---------- */

    @Test
    void aComplianceOfficerDeletesWithinTheirOwnFirm() {
        Deal d = dealIn(OWN_BRANCH, DealStatus.REVIEW, AUTHOR_ID);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, 1L, null, 20L);

        assertThatCode(() -> service.delete(1L)).doesNotThrowAnyException();
        verify(deals).delete(d);
    }

    @Test
    void aComplianceOfficerIsRefusedAnotherFirmsDeal() {
        dealIn(OTHER_FIRM_BRANCH, DealStatus.REVIEW, AUTHOR_ID);
        signedInAs(Role.AML_COMPLIANCE_OFFICER, 1L, null, 20L);

        assertThatThrownBy(() -> service.delete(1L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("within your own firm");
        verify(deals, never()).delete(any());
    }

    @Test
    void aSeniorManagerDeletesWithinTheirOwnFirm() {
        Deal d = dealIn(OWN_BRANCH, DealStatus.CLOSED, AUTHOR_ID);
        signedInAs(Role.SENIOR_MANAGER, 1L, null, 40L);

        assertThatCode(() -> service.delete(1L)).doesNotThrowAnyException();
        verify(deals).delete(d);
    }

    @Test
    void aSeniorManagerIsRefusedAnotherFirmsDeal() {
        dealIn(OTHER_FIRM_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.SENIOR_MANAGER, 1L, null, 40L);

        assertThatThrownBy(() -> service.delete(1L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("within your own firm");
    }

    /* ---------- the broker who filed it ---------- */

    @Test
    void theAuthorDiscardsTheirOwnUnfinishedDeal() {
        Deal d = dealIn(OWN_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.AGENT, 1L, OWN_BRANCH, AUTHOR_ID);

        assertThatCode(() -> service.delete(1L)).doesNotThrowAnyException();
        verify(deals).delete(d);
    }

    @Test
    void theAuthorCannotDeleteItOnceItHasBeenHandedOver() {
        dealIn(OWN_BRANCH, DealStatus.REVIEW, AUTHOR_ID);
        signedInAs(Role.AGENT, 1L, OWN_BRANCH, AUTHOR_ID);

        // Submitting is the handover. After it the deal is compliance's to judge, and a broker
        // who could still delete it could withdraw a file already under review.
        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
        verify(deals, never()).delete(any());
    }

    @Test
    void anAgentCannotDeleteSomebodyElsesDeal() {
        dealIn(OWN_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.AGENT, 1L, OWN_BRANCH, 8L);

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
        verify(deals, never()).delete(any());
    }

    /* ---------- everybody else ---------- */

    @Test
    void aReadOnlyAuditorIsRefused() {
        dealIn(OWN_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.AUDIT, 1L, null, 60L);

        assertThatThrownBy(() -> service.delete(1L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("may delete a deal");
    }

    @Test
    void aSalesManagerIsRefused() {
        dealIn(OWN_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.SALES_MANAGER, 1L, OWN_BRANCH, 50L);

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
    }

    /* ---------- what a delete takes with it ---------- */

    @Test
    void theDealsPeopleAreReleasedBeforeTheRowGoes() {
        dealIn(OWN_BRANCH, DealStatus.NEW, AUTHOR_ID);
        signedInAs(Role.ROOT, 1L, null, 99L);

        service.delete(1L);

        // Afterwards deal_beneficial_owner has cascaded away, so there is no longer any way to
        // tell which people this deal held - the release has to happen while there still is.
        var order = org.mockito.Mockito.inOrder(beneficialOwners, deals);
        order.verify(beneficialOwners).releaseFromDeal(1L);
        order.verify(deals).delete(any());
        verify(properties).deleteById(2L);
        verify(clients).deleteById(3L);
    }

    /* ---------- helpers ---------- */

    private Deal dealIn(Long branchId, DealStatus status, Long createdBy) {
        Deal d = new Deal();
        ReflectionTestUtils.setField(d, "id", 1L);
        d.setStatus(status);
        d.setFirmBranchId(branchId);
        d.setCreatedByUserId(createdBy);
        d.setPropertyId(2L);
        d.setClientId(3L);
        lenient().when(deals.findById(1L)).thenReturn(Optional.of(d));
        return d;
    }

    private static void signedInAs(Role role, Long firmId, Long branchId, Long userId) {
        UserPrincipal p =
                new UserPrincipal(userId, role + "@firm.com", null, role, firmId, branchId, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));
    }

    private static FirmBranch branch(Long id, Long firmId) {
        FirmBranch b = new FirmBranch();
        b.setRealEstateFirmId(firmId);
        b.setActive(true);
        ReflectionTestUtils.setField(b, "id", id);
        return b;
    }
}
