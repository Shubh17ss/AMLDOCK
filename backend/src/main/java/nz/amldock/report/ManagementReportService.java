package nz.amldock.report;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.deal.DealScope;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.report.dto.OwnerTypeReportDto;
import nz.amldock.report.dto.PropertyTypeReportDto;
import nz.amldock.report.dto.ReportOverviewDto;
import nz.amldock.report.dto.TrainingReportDto;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;

/**
 * Reporting › Management Reports: one firm's (or one branch's) deals, owners and training,
 * aggregated over a window of days.
 *
 * <p>Each section is its own request, so the page can draw the top of the report while the rest
 * is still being counted, and a slow section holds up only itself. Every request resolves and
 * checks its scope the same way, here, before any query runs.
 *
 * <p>Firm-level reading only: compliance officers and senior managers for their own firm, ROOT and
 * AUDIT for whichever firm they name. FINANCE does not get the report, nor do branch staff.
 */
@Service
public class ManagementReportService {

    private final ManagementReportQuery query;
    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;

    public ManagementReportService(ManagementReportQuery query, RealEstateFirmRepository firms,
                                   FirmBranchRepository branches) {
        this.query = query;
        this.firms = firms;
        this.branches = branches;
    }

    @Transactional(readOnly = true)
    public ReportOverviewDto overview(ReportParams params) {
        return query.overview(resolve(params));
    }

    @Transactional(readOnly = true)
    public PropertyTypeReportDto propertyTypes(ReportParams params) {
        return query.propertyTypes(resolve(params));
    }

    @Transactional(readOnly = true)
    public OwnerTypeReportDto owners(ReportParams params) {
        return query.owners(resolve(params));
    }

    @Transactional(readOnly = true)
    public TrainingReportDto training(ReportParams params) {
        return query.training(resolve(params));
    }

    /**
     * The firm, branch and window this request may see. Runs inside the caller's read-only
     * transaction so the statement timeout it sets covers the section's queries.
     */
    private ReportScope resolve(ReportParams params) {
        UserPrincipal actor = currentPrincipal();
        // The controller already admits only these roles. Stated again here because DealScope
        // narrows the others in ways that do not suit a firm report (an agent to their own deals,
        // a sales manager to their branch), and a widened controller list should fail closed.
        switch (actor.role()) {
            case ROOT, AUDIT, AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> { }
            default -> throw new ForbiddenException("The management report is not available to your role");
        }

        // Pins the firm for officers and managers; ROOT and AUDIT keep the firm they asked for.
        DealScope deals = DealScope.forActor(actor, params.firmId(), params.branchId());
        Long firmId = deals.firmId();
        if (firmId == null) {
            throw new BadRequestException("Choose a reporting entity to report on");
        }
        RealEstateFirm firm = firms.findById(firmId)
                .orElseThrow(() -> new NotFoundException("Reporting entity not found"));
        // The deal queries would merely come back empty for another firm's branch, but the owner and
        // training queries filter on the firm and the branch separately, so it is checked once here.
        if (deals.branchId() != null) {
            branches.findById(deals.branchId())
                    .filter(b -> firmId.equals(b.getRealEstateFirmId()))
                    .orElseThrow(() -> new NotFoundException("Branch not found"));
        }

        ReportWindow window = ReportWindow.parse(params.from(), params.to(), params.tz(),
                defaultZone(firm.getCountry()));
        query.limitStatementTime();
        return new ReportScope(deals, firmId, deals.branchId(), window);
    }

    /** Where a firm's day starts when the client does not say. NZ and AU are the only countries. */
    private static ZoneId defaultZone(String country) {
        return "AU".equals(country) ? ZoneId.of("Australia/Sydney") : ZoneId.of("Pacific/Auckland");
    }

    private static UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
