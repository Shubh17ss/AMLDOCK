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
import nz.amldock.deal.assurance.dto.UpdateAssuranceRequest;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.version.DealVersion;
import nz.amldock.deal.version.DealVersionRepository;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
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

import java.time.Instant;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Recording an assurance verdict on a signed-off version, and the register that lists them.
 *
 * <p>The dialog only offers what makes sense, but the server holds the line: compliance only,
 * same firm only, verified or closed deals only, issues only with ACTION_REQUIRED and always with
 * it, and passing a version clears what was found.
 */
@ExtendWith(MockitoExtension.class)
class AssuranceServiceTest {

    static final Long DEAL_ID = 1L;
    static final Long VERSION_ROW_ID = 100L;
    static final Long BRANCH_ID = 10L;
    static final Long FIRM_ID = 1L;
    static final Long OTHER_FIRM_ID = 2L;

    @Mock DealService dealService;
    @Mock DealRepository deals;
    @Mock DealVersionRepository versions;
    @Mock AssuranceIssueRepository issues;
    @Mock DealNoteRepository notes;
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
        service = new AssuranceService(dealService, deals, versions, issues, notes,
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

        v1 = version(1, VERSION_ROW_ID, Instant.parse("2026-09-10T00:00:00Z"));
        lenient().when(versions.findByDealIdAndVersionNo(DEAL_ID, 1)).thenReturn(Optional.of(v1));
        lenient().when(users.findAllById(any())).thenReturn(List.of());

        asUser(complianceOfficer);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- recording a verdict ---------- */

    @Test
    void passingAVersionAssuresItAndClearsItsIssues() {
        AssuranceVersionDto dto = service.update(DEAL_ID, 1, assured());

        assertThat(dto.assuranceStatus()).isEqualTo(AssuranceStatus.ASSURED);
        assertThat(dto.issues()).isEmpty();
        assertThat(v1.getAssuranceByUserId()).isEqualTo(complianceOfficer.id());
        assertThat(v1.getAssuranceAt()).isNotNull();
        verify(issues).deleteAllForVersion(VERSION_ROW_ID);
        verify(issues, never()).save(any());
        verify(audit).record(eq(AuditAction.DEAL_VERSION_ASSURED), eq("Deal"), eq(DEAL_ID), anyString());
    }

    @Test
    void actionRequiredStoresEachIssueInOrder() {
        AssuranceVersionDto dto = service.update(DEAL_ID, 1, actionRequired(
                issue("  PEP not screened  ", "Run the PEP check"),
                issue("Address proof expired", "Request a current one")));

        assertThat(dto.assuranceStatus()).isEqualTo(AssuranceStatus.ACTION_REQUIRED);
        assertThat(dto.issues()).extracting(AssuranceVersionDto.IssueDto::issue)
                .containsExactly("PEP not screened", "Address proof expired");

        ArgumentCaptor<AssuranceIssue> saved = ArgumentCaptor.forClass(AssuranceIssue.class);
        verify(issues, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(AssuranceIssue::getSortOrder).containsExactly(0, 1);
        assertThat(saved.getAllValues()).extracting(AssuranceIssue::getDealVersionId)
                .containsOnly(VERSION_ROW_ID);
        verify(audit).record(eq(AuditAction.DEAL_VERSION_ACTION_REQUIRED), eq("Deal"), eq(DEAL_ID),
                contains("PEP not screened"));
    }

    @Test
    void actionRequiredReplacesTheEarlierIssues() {
        service.update(DEAL_ID, 1, actionRequired(issue("First finding", "First fix")));
        service.update(DEAL_ID, 1, actionRequired(issue("Second finding", "Second fix")));

        // Cleared before each write, so the second list is the whole list.
        verify(issues, times(2)).deleteAllForVersion(VERSION_ROW_ID);
    }

    @Test
    void anAssuredVersionCanLaterNeedAction() {
        service.update(DEAL_ID, 1, assured());

        AssuranceVersionDto dto = service.update(DEAL_ID, 1, actionRequired(issue("Missed a PEP", "Screen again")));

        assertThat(dto.assuranceStatus()).isEqualTo(AssuranceStatus.ACTION_REQUIRED);
    }

    @Test
    void actionRequiredNeedsAtLeastOneIssue() {
        assertThatThrownBy(() -> service.update(DEAL_ID, 1, actionRequired()))
                .isInstanceOf(BadRequestException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    @Test
    void anIssueAndItsRemediationNeedRealText() {
        assertThatThrownBy(() -> service.update(DEAL_ID, 1, actionRequired(issue("ok", "  x  "))))
                .isInstanceOf(BadRequestException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    @Test
    void aPassCannotCarryIssues() {
        UpdateAssuranceRequest req = new UpdateAssuranceRequest(AssuranceStatus.ASSURED,
                List.of(issue("Something", "Something else")));

        assertThatThrownBy(() -> service.update(DEAL_ID, 1, req)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void aClosedDealCanBeAssuredToo() {
        deal.setStatus(DealStatus.CLOSED);

        assertThat(service.update(DEAL_ID, 1, assured()).assuranceStatus()).isEqualTo(AssuranceStatus.ASSURED);
    }

    @Test
    void aDealBackInReviewCannotBeAssured() {
        deal.setStatus(DealStatus.REVIEW);

        assertThatThrownBy(() -> service.update(DEAL_ID, 1, assured()))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anAgentMayNotAssure() {
        asUser(agent);

        assertThatThrownBy(() -> service.update(DEAL_ID, 1, assured()))
                .isInstanceOf(ForbiddenException.class);
        verify(audit, never()).record(any(), anyString(), anyLong(), anyString());
    }

    @Test
    void anotherFirmsOfficerMayNotAssure() {
        asUser(otherFirmOfficer);

        assertThatThrownBy(() -> service.update(DEAL_ID, 1, assured()))
                .isInstanceOf(ForbiddenException.class);
        assertThat(v1.getAssuranceStatus()).isNull();
    }

    /* ---------- the register ---------- */

    @Test
    void theRegisterListsVerifiedAndClosedDealsOnly() {
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-20T00:00:00Z"));
        stubRegister(DealStatus.VERIFIED, v2, v1);

        List<AssuranceDealDto> out = service.list(FIRM_ID, BRANCH_ID, null, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).versions()).extracting(AssuranceVersionDto::versionNo).containsExactly(2, 1);
        verify(dealService, never()).list(eq(DealStatus.REVIEW), any(), any());
        verify(dealService, never()).list(eq(DealStatus.NEW), any(), any());
        verify(dealService, never()).list(eq(DealStatus.ON_HOLD), any(), any());
    }

    @Test
    void theDealRowCarriesItsLatestAssuranceChange() {
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-20T00:00:00Z"));
        Instant earlier = Instant.parse("2026-09-21T09:00:00Z");
        Instant later = Instant.parse("2026-09-25T15:30:00Z");
        v1.markAssurance(AssuranceStatus.ASSURED, 5L, later);
        v2.markAssurance(AssuranceStatus.ASSURED, 5L, earlier);
        stubRegister(DealStatus.VERIFIED, v2, v1);

        assertThat(service.list(FIRM_ID, BRANCH_ID, null, null).get(0).lastAssuredAt()).isEqualTo(later);
    }

    @Test
    void aRangeKeepsVersionsVerifiedInsideIt() {
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-20T00:00:00Z"));
        stubRegister(DealStatus.VERIFIED, v2, v1);

        List<AssuranceDealDto> out = service.list(FIRM_ID, BRANCH_ID,
                Instant.parse("2026-09-15T00:00:00Z"), Instant.parse("2026-09-30T23:59:59Z"));

        assertThat(out.get(0).versions()).extracting(AssuranceVersionDto::versionNo).containsExactly(2);
    }

    @Test
    void closingInsideTheRangeBringsInTheLatestVersionOnly() {
        // Both versions were verified before the range; the deal was closed inside it.
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-05T00:00:00Z"));
        v1 = version(1, VERSION_ROW_ID, Instant.parse("2026-08-01T00:00:00Z"));
        stubRegister(DealStatus.CLOSED, v2, v1);
        when(notes.latestTransitionAt(List.of(DEAL_ID), DealStatus.CLOSED))
                .thenReturn(List.<Object[]>of(new Object[] {DEAL_ID, Instant.parse("2026-09-18T00:00:00Z")}));

        List<AssuranceDealDto> out = service.list(FIRM_ID, BRANCH_ID,
                Instant.parse("2026-09-15T00:00:00Z"), Instant.parse("2026-09-30T23:59:59Z"));

        assertThat(out.get(0).versions()).extracting(AssuranceVersionDto::versionNo).containsExactly(2);
    }

    @Test
    void aDealWithNothingInTheRangeIsLeftOut() {
        stubRegister(DealStatus.VERIFIED, v1);

        assertThat(service.list(FIRM_ID, BRANCH_ID,
                Instant.parse("2026-10-01T00:00:00Z"), null)).isEmpty();
    }

    /* ---------- helpers ---------- */

    private void stubRegister(DealStatus status, DealVersion... vs) {
        DealListItemDto row = mock(DealListItemDto.class);
        lenient().when(row.id()).thenReturn(DEAL_ID);
        lenient().when(row.status()).thenReturn(status);
        when(dealService.list(DealStatus.VERIFIED, FIRM_ID, BRANCH_ID))
                .thenReturn(status == DealStatus.VERIFIED ? List.of(row) : List.of());
        when(dealService.list(DealStatus.CLOSED, FIRM_ID, BRANCH_ID))
                .thenReturn(status == DealStatus.CLOSED ? List.of(row) : List.of());
        when(versions.findAllByDealIdInOrderByVersionNoDesc(List.of(DEAL_ID))).thenReturn(List.of(vs));
    }

    private DealVersion version(int no, Long rowId, Instant verifiedAt) {
        DealVersion v = DealVersion.copyOf(deal, no, complianceOfficer.id(), "Checked IDs");
        ReflectionTestUtils.setField(v, "id", rowId);
        ReflectionTestUtils.setField(v, "verifiedAt", verifiedAt);
        return v;
    }

    private static UpdateAssuranceRequest assured() {
        return new UpdateAssuranceRequest(AssuranceStatus.ASSURED, List.of());
    }

    private static UpdateAssuranceRequest actionRequired(UpdateAssuranceRequest.Issue... items) {
        return new UpdateAssuranceRequest(AssuranceStatus.ACTION_REQUIRED, List.of(items));
    }

    private static UpdateAssuranceRequest.Issue issue(String issue, String remediation) {
        return new UpdateAssuranceRequest.Issue(issue, remediation);
    }

    private void asUser(UserPrincipal who) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(who, null, who.getAuthorities()));
    }
}
