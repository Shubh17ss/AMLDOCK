package nz.amldock.deal.assurance;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.deal.DealService;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.version.DealVersion;
import nz.amldock.deal.version.DealVersionRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Assuring a signed-off version, and taking assurance back.
 *
 * <p>The menu only offers the move that makes sense from where a version stands, but the server is
 * what has to hold the line: compliance only, same firm only, verified or closed deals only, a
 * real change of position, and always a note.
 */
@ExtendWith(MockitoExtension.class)
class AssuranceServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 1L;
    static final Long OTHER_FIRM_ID = 2L;

    @Mock DealService dealService;
    @Mock DealRepository deals;
    @Mock DealVersionRepository versions;
    @Mock FirmBranchRepository branches;
    @Mock UserRepository users;
    @Mock AuditService audit;

    AssuranceService service;
    Deal deal;
    DealVersion v1;

    final UserPrincipal complianceOfficer = new UserPrincipal(
            5L, "amlco@firm.com", null, Role.AML_COMPLIANCE_OFFICER, FIRM_ID, BRANCH_ID, true);
    final UserPrincipal otherFirmOfficer = new UserPrincipal(
            6L, "amlco@other.com", null, Role.AML_COMPLIANCE_OFFICER, OTHER_FIRM_ID, 20L, true);
    final UserPrincipal agent = new UserPrincipal(
            7L, "agent@firm.com", null, Role.AGENT, FIRM_ID, BRANCH_ID, true);

    @BeforeEach
    void setUp() {
        service = new AssuranceService(dealService, deals, versions,
                new DealLifecycleService(mock(DealUserRepository.class)), branches, users, audit);

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(FIRM_ID);
        branch.setActive(true);
        ReflectionTestUtils.setField(branch, "id", BRANCH_ID);
        lenient().when(branches.findById(BRANCH_ID)).thenReturn(Optional.of(branch));

        deal = new Deal();
        ReflectionTestUtils.setField(deal, "id", DEAL_ID);
        deal.setReference("DEAL-2026-0001");
        deal.setStatus(DealStatus.VERIFIED);
        deal.setFirmBranchId(BRANCH_ID);
        deal.setCreatedByUserId(agent.id());
        lenient().when(deals.findById(DEAL_ID)).thenReturn(Optional.of(deal));

        v1 = DealVersion.copyOf(deal, 1, complianceOfficer.id(), "Checked IDs");
        lenient().when(versions.findByDealIdAndVersionNo(DEAL_ID, 1)).thenReturn(Optional.of(v1));
        lenient().when(users.findAllById(any())).thenReturn(List.of());

        asUser(complianceOfficer);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- marking ---------- */

    @Test
    void aReviewerCanAssureAVersionAndTheMarkIsStamped() {
        AssuranceVersionDto dto = service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "  Looks right  ");

        assertThat(dto.assuranceStatus()).isEqualTo(AssuranceStatus.ASSURED);
        assertThat(v1.getAssuranceNote()).isEqualTo("Looks right");
        assertThat(v1.getAssuranceByUserId()).isEqualTo(complianceOfficer.id());
        assertThat(v1.getAssuranceAt()).isNotNull();
        verify(versions).save(v1);
        verify(audit).record(eq(AuditAction.DEAL_VERSION_ASSURED), eq("Deal"), eq(DEAL_ID),
                contains("Looks right"));
    }

    @Test
    void aClosedDealCanBeAssuredToo() {
        deal.setStatus(DealStatus.CLOSED);

        assertThat(service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Fine").assuranceStatus())
                .isEqualTo(AssuranceStatus.ASSURED);
    }

    @Test
    void anAssuredVersionCanBeUnassuredWithANote() {
        service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right");

        AssuranceVersionDto dto = service.mark(DEAL_ID, 1, AssuranceStatus.UNASSURED, "Missed a PEP");

        assertThat(dto.assuranceStatus()).isEqualTo(AssuranceStatus.UNASSURED);
        assertThat(v1.getAssuranceNote()).isEqualTo("Missed a PEP");
        verify(audit).record(eq(AuditAction.DEAL_VERSION_UNASSURED), eq("Deal"), eq(DEAL_ID),
                contains("Missed a PEP"));
    }

    @Test
    void anUnassuredVersionCanBeAssuredAgain() {
        service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right");
        service.mark(DEAL_ID, 1, AssuranceStatus.UNASSURED, "Missed a PEP");

        assertThat(service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "PEP cleared").assuranceStatus())
                .isEqualTo(AssuranceStatus.ASSURED);
    }

    @Test
    void assuringTwiceIsRefused() {
        service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right");

        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Again"))
                .isInstanceOf(BadRequestException.class);
        assertThat(v1.getAssuranceNote()).isEqualTo("Looks right");
    }

    @Test
    void aVersionNobodyAssuredCannotBeUnassured() {
        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.UNASSURED, "Not right"))
                .isInstanceOf(BadRequestException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    @Test
    void aNoteIsRequired() {
        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "  ok  "))
                .isInstanceOf(BadRequestException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    @Test
    void aDealBackInReviewCannotBeAssured() {
        deal.setStatus(DealStatus.REVIEW);

        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anAgentMayNotAssure() {
        asUser(agent);

        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right"))
                .isInstanceOf(ForbiddenException.class);
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    @Test
    void anotherFirmsOfficerMayNotAssure() {
        asUser(otherFirmOfficer);

        assertThatThrownBy(() -> service.mark(DEAL_ID, 1, AssuranceStatus.ASSURED, "Looks right"))
                .isInstanceOf(ForbiddenException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    /* ---------- the register ---------- */

    @Test
    void theRegisterListsVerifiedAndClosedDealsOnly() {
        DealListItemDto row = mock(DealListItemDto.class);
        when(row.id()).thenReturn(DEAL_ID);
        when(dealService.list(DealStatus.VERIFIED, FIRM_ID, BRANCH_ID)).thenReturn(List.of(row));
        when(dealService.list(DealStatus.CLOSED, FIRM_ID, BRANCH_ID)).thenReturn(List.of());
        DealVersion v2 = DealVersion.copyOf(deal, 2, complianceOfficer.id(), "Rechecked");
        when(versions.findAllByDealIdInOrderByVersionNoDesc(List.of(DEAL_ID))).thenReturn(List.of(v2, v1));

        List<AssuranceDealDto> out = service.list(FIRM_ID, BRANCH_ID);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).versions()).extracting(AssuranceVersionDto::versionNo).containsExactly(2, 1);
        verify(dealService, never()).list(eq(DealStatus.REVIEW), any(), any());
        verify(dealService, never()).list(eq(DealStatus.NEW), any(), any());
        verify(dealService, never()).list(eq(DealStatus.ON_HOLD), any(), any());
    }

    /* ---------- helpers ---------- */

    private void asUser(UserPrincipal who) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(who, null, who.getAuthorities()));
    }
}
