package nz.amldock.deal.assurance;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.PageResponse;
import nz.amldock.deal.DealListService;
import nz.amldock.deal.DealScope;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.access.DealUserRepository;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.assurance.dto.UpdateAssuranceRequest;
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

    @Mock DealListService dealList;
    @Mock AssuranceQuery query;
    @Mock DealRepository deals;
    @Mock DealVersionRepository versions;
    @Mock AssuranceIssueRepository issues;
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
        // The real scope rule, so the scoping test exercises it rather than a stub of it.
        lenient().when(dealList.scopeForCurrentUser(any(), any())).thenAnswer(inv ->
                DealScope.forActor(complianceOfficer, inv.getArgument(0), inv.getArgument(1)));
        service = new AssuranceService(dealList, query, deals, versions, issues,
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
    // Which deals are in range or awaiting a verdict is decided in SQL (AssuranceQuery) and is
    // checked against a real database by the perf suite. These cover what happens around it.

    @Test
    void theRegisterShowsEachDealsLatestVersionOnly() {
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-20T00:00:00Z"));
        stubPage(new AssuranceQuery.Row(DEAL_ID, 101L), v2);

        PageResponse<AssuranceDealDto> out = service.list(filter(), PageRequests.of(0, 25));

        assertThat(out.items()).hasSize(1);
        assertThat(out.items().get(0).latestVersion().versionNo()).isEqualTo(2);
        assertThat(out.totalElements()).isEqualTo(1);
    }

    @Test
    void theLatestVersionCarriesItsVerdictAndIssues() {
        DealVersion v2 = version(2, 101L, Instant.parse("2026-09-20T00:00:00Z"));
        Instant at = Instant.parse("2026-09-25T15:30:00Z");
        v2.markAssurance(AssuranceStatus.ACTION_REQUIRED, 5L, at);
        stubPage(new AssuranceQuery.Row(DEAL_ID, 101L), v2);
        AssuranceIssue found = mock(AssuranceIssue.class);
        when(found.getDealVersionId()).thenReturn(101L);
        when(found.getIssue()).thenReturn("Trust deed missing");
        when(found.getRemediation()).thenReturn("Request from solicitor");
        when(issues.findAllByDealVersionIdInOrderBySortOrderAsc(List.of(101L))).thenReturn(List.of(found));

        AssuranceVersionDto latest = service.list(filter(), PageRequests.of(0, 25)).items().get(0).latestVersion();

        assertThat(latest.assuranceStatus()).isEqualTo(AssuranceStatus.ACTION_REQUIRED);
        assertThat(latest.assuranceAt()).isEqualTo(at);
        assertThat(latest.issues()).extracting(AssuranceVersionDto.IssueDto::issue).containsExactly("Trust deed missing");
    }

    @Test
    void aDealWithNoSignedOffVersionIsListedWithoutOne() {
        stubPage(new AssuranceQuery.Row(DEAL_ID, null));

        AssuranceDealDto row = service.list(filter(), PageRequests.of(0, 25)).items().get(0);

        assertThat(row.latestVersion()).isNull();
        verify(versions, never()).findAllById(any());
    }

    @Test
    void theQueryIsScopedToTheCallersFirmWhateverFirmIsAskedFor() {
        when(query.page(any(), any(), any())).thenReturn(new AssuranceQuery.RowPage(List.of(), 0, true));
        AssuranceQuery.Filter askedForAnotherFirm =
                new AssuranceQuery.Filter(OTHER_FIRM_ID, null, null, null, null, null);

        PageResponse<AssuranceDealDto> out = service.list(askedForAnotherFirm, PageRequests.of(0, 25));

        assertThat(out.items()).isEmpty();
        verify(query).page(eq(new DealScope(null, FIRM_ID, null)), eq(askedForAnotherFirm), any());
    }

    /* ---------- helpers ---------- */

    private AssuranceQuery.Filter filter() {
        return new AssuranceQuery.Filter(FIRM_ID, BRANCH_ID, null, null, null, null);
    }

    private void stubPage(AssuranceQuery.Row row, DealVersion... vs) {
        when(query.page(any(), any(), any())).thenReturn(new AssuranceQuery.RowPage(List.of(row), 1, true));
        DealListItemDto item = mock(DealListItemDto.class);
        lenient().when(item.id()).thenReturn(DEAL_ID);
        when(dealList.loadInOrder(List.of(DEAL_ID))).thenReturn(List.of(deal));
        when(dealList.toListItems(List.of(deal))).thenReturn(List.of(item));
        lenient().when(versions.findAllById(any())).thenReturn(List.of(vs));
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
