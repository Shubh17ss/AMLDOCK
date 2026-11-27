package nz.amldock.report;

import nz.amldock.report.dto.OwnerTypeReportDto;
import nz.amldock.report.dto.PropertyTypeReportDto;
import nz.amldock.report.dto.ReportOverviewDto;
import nz.amldock.report.dto.TrainingReportDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reporting › Management Reports. Four sections, one request each, all taking the same
 * {@link ReportParams}: {@code firmId}, {@code branchId}, {@code from}, {@code to}, {@code tz}.
 *
 * <p>Read-only, so AUDIT's GET-only rule (AuditReadOnlyFilter) needs no exception for it.
 */
@RestController
@RequestMapping("/api/reports/management")
@PreAuthorize("hasAnyRole('ROOT','AUDIT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
public class ManagementReportController {

    private final ManagementReportService reports;

    public ManagementReportController(ManagementReportService reports) {
        this.reports = reports;
    }

    /** Deals created in the window by status, risk rating and assurance verdict. */
    @GetMapping("/overview")
    public ReportOverviewDto overview(@ModelAttribute ReportParams params) {
        return reports.overview(params);
    }

    /** Deals by property type: created, verified and closed in the window, all-time, sale prices. */
    @GetMapping("/property-types")
    public PropertyTypeReportDto propertyTypes(@ModelAttribute ReportParams params) {
        return reports.propertyTypes(params);
    }

    /** Owners on the window's deals by owner type: overseas, re-used and exceptions. */
    @GetMapping("/owners")
    public OwnerTypeReportDto owners(@ModelAttribute ReportParams params) {
        return reports.owners(params);
    }

    /** Staff training: courses as they stand, sessions inside the window, one row per person. */
    @GetMapping("/training")
    public TrainingReportDto training(@ModelAttribute ReportParams params) {
        return reports.training(params);
    }
}
