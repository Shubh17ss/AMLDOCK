package nz.amldock.deal;

import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentRepository;
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

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * F4 defence in depth: a deal note is gated by read scope, and AUDIT reads every deal, so the
 * service itself must refuse AUDIT, not only AuditReadOnlyFilter.
 */
@ExtendWith(MockitoExtension.class)
class DealCommentReadOnlyTest {

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

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService(mock(DealUserRepository.class)),
                new DealNoteService(dealNotes, documents, users),
                beneficialOwners, risk, ownership, audit, notifier, versions, saleUnits,
                mock(nz.amldock.deal.readiness.VerificationReadinessService.class),
                mock(nz.amldock.deal.monitoring.TransactionMonitoringService.class));

        Deal d = new Deal();
        ReflectionTestUtils.setField(d, "id", 1L);
        d.setStatus(DealStatus.REVIEW);
        d.setFirmBranchId(10L);
        d.setCreatedByUserId(7L);
        lenient().when(deals.findById(1L)).thenReturn(Optional.of(d));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void auditorCannotAddANote() {
        UserPrincipal p = new UserPrincipal(60L, "audit@x.com", null, Role.AUDIT, null, null, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));

        assertThatThrownBy(() -> service.comment(1L, "planted note"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("read-only");
        verify(dealNotes, never()).save(any());
    }
}
