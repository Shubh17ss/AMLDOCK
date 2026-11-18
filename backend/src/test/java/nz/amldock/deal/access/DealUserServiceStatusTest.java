package nz.amldock.deal.access;

import nz.amldock.firm.ScopeStatusGuard;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.deal.DealStatus;
import nz.amldock.user.Role;
import nz.amldock.user.User;
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

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Access to a deal can be granted and revoked whatever the deal's status. */
@ExtendWith(MockitoExtension.class)
class DealUserServiceStatusTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long AUTHOR_ID = 7L;
    static final Long GRANTEE_ID = 8L;

    @Mock DealUserRepository dealUsers;
    @Mock DealRepository deals;
    @Mock UserRepository users;
    @Mock DealService dealService;
    @Mock AuditService audit;

    DealUserService service;
    Deal deal;
    User grantee;

    @BeforeEach
    void setUp() {
        service = new DealUserService(dealUsers, deals, users, dealService, audit, mock(ScopeStatusGuard.class));

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setFirmBranchId(BRANCH_ID);
        deal.setCreatedByUserId(AUTHOR_ID);
        deal.setStatus(DealStatus.CLOSED);
        when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));

        grantee = new User();
        ReflectionTestUtils.setField(grantee, "id", GRANTEE_ID);
        grantee.setFullName("Second Agent");
        grantee.setRole(Role.AGENT);
        grantee.setFirmBranchId(BRANCH_ID);
        grantee.setActive(true);
        lenient().when(users.findAllById(any())).thenReturn(List.of(grantee));
        lenient().when(users.findById(GRANTEE_ID)).thenReturn(Optional.of(grantee));

        UserPrincipal amlco = new UserPrincipal(5L, "amlco@firm.com", null,
                Role.AML_COMPLIANCE_OFFICER, 1L, BRANCH_ID, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(amlco, null, amlco.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void accessCanBeGrantedOnAVerifiedOrClosedDeal() {
        for (DealStatus s : List.of(DealStatus.VERIFIED, DealStatus.CLOSED)) {
            deal.setStatus(s);
            service.add(DEAL_ID, Set.of(GRANTEE_ID));
        }
        verify(dealUsers, org.mockito.Mockito.times(2)).save(any(DealUser.class));
        verify(audit, org.mockito.Mockito.times(2))
                .record(eq(AuditAction.DEAL_USER_ADDED), eq("Deal"), eq(DEAL_ID), anyString());
    }

    @Test
    void accessCanBeRevokedOnAClosedDeal() {
        DealUser grant = new DealUser(DEAL_ID, GRANTEE_ID, 5L);
        when(dealUsers.findByDealIdAndUserId(DEAL_ID, GRANTEE_ID)).thenReturn(Optional.of(grant));

        service.remove(DEAL_ID, GRANTEE_ID);

        verify(dealUsers).delete(grant);
        verify(audit).record(eq(AuditAction.DEAL_USER_REMOVED), eq("Deal"), eq(DEAL_ID), anyString());
    }
}
