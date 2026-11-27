package nz.amldock.report;

import nz.amldock.report.dto.OwnerTypeReportDto;
import nz.amldock.report.dto.PropertyTypeReportDto;
import nz.amldock.report.dto.ReportOverviewDto;
import nz.amldock.report.dto.TrainingReportDto;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The report endpoints as {@code api/reports.js} reaches them: the four routes, the role gate
 * (both the URL matcher and {@code @PreAuthorize}), the query string binding to
 * {@link ReportParams}, and the JSON names the page reads. The numbers themselves are
 * {@link ManagementReportDbTest}'s business; the service is mocked here.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ManagementReportWebTest {

    private static final String BASE = "/api/reports/management";

    @Autowired MockMvc mvc;
    @MockBean ManagementReportService reports;

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void theQueryStringBindsAndTheOverviewSerialisesUnderTheNamesThePageReads() throws Exception {
        Map<String, Long> byAssurance = new LinkedHashMap<>();
        byAssurance.put("ASSURED", 1L);
        byAssurance.put("AWAITING", 1L);
        when(reports.overview(any())).thenReturn(new ReportOverviewDto(6, 2, 1, 2, 1, 4, 3L,
                "2024-07-01", "2025-06-30", new BigDecimal("3300000.00"), new BigDecimal("1500000.00"), byAssurance));

        mvc.perform(get(BASE + "/overview")
                        .param("firmId", "7").param("branchId", "9")
                        .param("from", "2025-07-01").param("to", "2026-06-30").param("tz", "Pacific/Auckland"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(6))
                .andExpect(jsonPath("$.verified").value(1))
                .andExpect(jsonPath("$.sold").value(2))
                .andExpect(jsonPath("$.closedNotSold").value(1))
                .andExpect(jsonPath("$.listed").value(4))
                .andExpect(jsonPath("$.previousListed").value(3))
                .andExpect(jsonPath("$.previousFrom").value("2024-07-01"))
                .andExpect(jsonPath("$.appraisedValue").value(3300000.00))
                .andExpect(jsonPath("$.closingValue").value(1500000.00))
                .andExpect(jsonPath("$.byAssurance.AWAITING").value(1));

        ArgumentCaptor<ReportParams> params = ArgumentCaptor.forClass(ReportParams.class);
        verify(reports).overview(params.capture());
        assertThat(params.getValue()).isEqualTo(
                new ReportParams(7L, 9L, "2025-07-01", "2026-06-30", "Pacific/Auckland"));
    }

    @Test
    @WithMockUser(roles = "SENIOR_MANAGER")
    void theTablesSerialise() throws Exception {
        PropertyTypeReportDto.Row rural = new PropertyTypeReportDto.Row("RURAL", 1, 100.0, 1, 1, 1, 0, 1,
                new BigDecimal("1000000.00"), new BigDecimal("1000000.00"));
        PropertyTypeReportDto.Row total = new PropertyTypeReportDto.Row(null, 1, 100.0, 1, 1, 1, 0, 1,
                new BigDecimal("1000000.00"), new BigDecimal("1000000.00"));
        when(reports.propertyTypes(any())).thenReturn(new PropertyTypeReportDto(List.of(rural), total));
        when(reports.owners(any())).thenReturn(new OwnerTypeReportDto(
                List.of(new OwnerTypeReportDto.Row("TRUST", 2, 1, 1, 1)),
                new OwnerTypeReportDto.Row(null, 2, 1, 1, 1)));
        when(reports.training(any())).thenReturn(new TrainingReportDto(
                new TrainingReportDto.Summary(1, 2, 1, 1, 1, 1, 1, 1, 60),
                List.of(new TrainingReportDto.Person(5L, "Aaron Agent", "AGENT", "Ponsonby", 2, 1, 1, 1, 1, 60,
                        Instant.parse("2025-09-15T00:00:00Z")))));

        mvc.perform(get(BASE + "/property-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].propertyType").value("RURAL"))
                .andExpect(jsonPath("$.rows[0].createdPercent").value(100.0))
                .andExpect(jsonPath("$.rows[0].averageSalePrice").value(1000000.00))
                .andExpect(jsonPath("$.total.verifiedAllTime").value(1));
        mvc.perform(get(BASE + "/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].ownerType").value("TRUST"))
                .andExpect(jsonPath("$.total.reused").value(1))
                .andExpect(jsonPath("$.total.exceptions").value(1));
        mvc.perform(get(BASE + "/training"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.minutesAttended").value(60))
                .andExpect(jsonPath("$.people[0].fullName").value("Aaron Agent"))
                .andExpect(jsonPath("$.people[0].lastCompletedAt").value("2025-09-15T00:00:00Z"));
    }

    @Test
    @WithMockUser(roles = "AUDIT")
    void auditReads() throws Exception {
        when(reports.owners(any())).thenReturn(new OwnerTypeReportDto(List.of(),
                new OwnerTypeReportDto.Row(null, 0, 0, 0, 0)));
        mvc.perform(get(BASE + "/owners").param("firmId", "7")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "FINANCE")
    void financeIsTurnedAway() throws Exception {
        mvc.perform(get(BASE + "/overview")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "SALES_MANAGER")
    void aSalesManagerIsTurnedAway() throws Exception {
        mvc.perform(get(BASE + "/property-types")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "AGENT")
    void anAgentIsTurnedAway() throws Exception {
        mvc.perform(get(BASE + "/training")).andExpect(status().isForbidden());
    }
}
