package nz.amldock.deal;

import nz.amldock.deal.dto.RiskAssessmentDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The risk endpoints as the browser actually reaches them.
 *
 * <p>Everything below the controller is unit-tested elsewhere; what only a booted context can
 * check is the part that has no unit test by construction — that the three routes are mapped
 * where {@code api/risk.js} expects them, that {@code @PreAuthorize} lets the right roles
 * through and turns the rest away, and that {@code RiskAssessmentDto} serialises to the field
 * names the Risk tab reads. A typo in any of those compiles, passes every unit test, and fails
 * only in a browser.
 *
 * <p>{@code DealService} is mocked so this stays a test of the web layer and touches no data.
 * The security filter chain, the method-security annotations and the JSON mapper are all real.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class RiskEndpointsWebTest {

    @Autowired MockMvc mvc;
    @MockBean DealService deals;

    private static final RiskAssessmentDto ASSESSMENT = new RiskAssessmentDto(
            1L, 8, RiskRating.HIGH, RiskRating.MEDIUM, RiskRatingSource.OVERRIDE,
            "Known to the firm", false, null, null, null, false,
            List.of(new RiskAssessmentDto.FactorDto("TENURE", "Owned for 6 months", 6, null, null),
                    new RiskAssessmentDto.FactorDto("COUNTRY", "Country of residence: GB", 1,
                            42L, "Jane Marsh")),
            List.of(new RiskAssessmentDto.GapDto("NOMINEE", "Whether there is a nominee",
                    43L, "Marsh Holdings")));

    /* ---------- the read ---------- */

    @Test
    @WithMockUser(roles = "AGENT")
    void theWorkingsAreReadableAndSeriliseUnderTheNamesTheUiReads() throws Exception {
        when(deals.risk(1L)).thenReturn(ASSESSMENT);

        mvc.perform(get("/api/deals/1/risk"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riskValue").value(8))
                .andExpect(jsonPath("$.calculatedRating").value("HIGH"))
                .andExpect(jsonPath("$.rating").value("MEDIUM"))
                .andExpect(jsonPath("$.source").value("OVERRIDE"))
                .andExpect(jsonPath("$.overrideComment").value("Known to the firm"))
                .andExpect(jsonPath("$.approved").value(false))
                .andExpect(jsonPath("$.complete").value(false))
                .andExpect(jsonPath("$.factors[0].label").value("Owned for 6 months"))
                .andExpect(jsonPath("$.factors[0].points").value(6))
                .andExpect(jsonPath("$.factors[1].nodeId").value(42))
                .andExpect(jsonPath("$.factors[1].nodeName").value("Jane Marsh"))
                .andExpect(jsonPath("$.unanswered[0].code").value("NOMINEE"))
                .andExpect(jsonPath("$.unanswered[0].nodeName").value("Marsh Holdings"));
    }

    @Test
    void anAnonymousCallerGetsNothing() throws Exception {
        mvc.perform(get("/api/deals/1/risk")).andExpect(status().isUnauthorized());
    }

    /* ---------- approving ---------- */

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void complianceMayApprove() throws Exception {
        when(deals.approveRisk(1L)).thenReturn(ASSESSMENT);

        mvc.perform(post("/api/deals/1/risk/approve").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "SENIOR_MANAGER")
    void aSeniorManagerMayApprove() throws Exception {
        when(deals.approveRisk(1L)).thenReturn(ASSESSMENT);

        mvc.perform(post("/api/deals/1/risk/approve").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "AGENT")
    void anAgentMayNotApprove() throws Exception {
        mvc.perform(post("/api/deals/1/risk/approve").with(csrf()))
                .andExpect(status().isForbidden());
    }

    /* ---------- overriding ---------- */

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void complianceMayOverride() throws Exception {
        when(deals.overrideRisk(eq(1L), any(), anyString())).thenReturn(ASSESSMENT);

        mvc.perform(post("/api/deals/1/risk/override").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":\"HIGH\",\"comment\":\"Known to the firm\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void anOverrideWithoutAReasonIsRefusedByValidationRatherThanStored() throws Exception {
        // The dialog will not submit one, but the endpoint is what has to hold the line: a
        // rating that disagrees with its own workings is only defensible with a reason on it.
        mvc.perform(post("/api/deals/1/risk/override").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":\"HIGH\",\"comment\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void anOverrideWithoutARatingIsRefused() throws Exception {
        mvc.perform(post("/api/deals/1/risk/override").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":\"Known to the firm\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "AGENT")
    void anAgentMayNotOverride() throws Exception {
        mvc.perform(post("/api/deals/1/risk/override").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":\"HIGH\",\"comment\":\"Known to the firm\"}"))
                .andExpect(status().isForbidden());
    }

    /** Imported here rather than statically at the top so the intent reads at each call site. */
    private static org.springframework.test.web.servlet.request.RequestPostProcessor csrf() {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf();
    }
}
