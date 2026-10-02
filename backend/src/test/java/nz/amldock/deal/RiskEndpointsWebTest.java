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

import java.time.Instant;
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

    private static final Instant OVERRIDDEN_AT = Instant.parse("2026-09-26T12:04:00Z");

    private static final RiskAssessmentDto ASSESSMENT = new RiskAssessmentDto(
            1L, 8, RiskRating.HIGH, RiskRating.MEDIUM, RiskRatingSource.OVERRIDE,
            "Known to the firm", "Abhi Saluja", OVERRIDDEN_AT,
            false, null, null, null, false,
            List.of(new RiskAssessmentDto.FactorDto("TENURE", "Ownership tenure", "6 months", 6,
                            null, null, null, null),
                    new RiskAssessmentDto.FactorDto("COUNTRY", "Country of residence", null, 1,
                            42L, "Jane Marsh", "INDIVIDUAL", "GB")),
            List.of(new RiskAssessmentDto.GapDto("NOMINEE", "Nominee director/shareholder",
                    43L, "Marsh Holdings", "PRIVATE_COMPANY")));

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
                // The byline the override box renders. Without these the comment reads as the
                // deal saying something about itself rather than a named person deciding - and
                // it is the person's name, not the login behind it.
                .andExpect(jsonPath("$.overriddenByName").value("Abhi Saluja"))
                .andExpect(jsonPath("$.overriddenByEmail").doesNotExist())
                .andExpect(jsonPath("$.overriddenAt").exists())
                .andExpect(jsonPath("$.approved").value(false))
                .andExpect(jsonPath("$.complete").value(false))
                // The question and the answer arrive apart, which is what lets the card lay
                // them out as "Ownership tenure: 6 months" rather than print a fixed sentence.
                .andExpect(jsonPath("$.factors[0].label").value("Ownership tenure"))
                .andExpect(jsonPath("$.factors[0].value").value("6 months"))
                .andExpect(jsonPath("$.factors[0].points").value(6))
                .andExpect(jsonPath("$.factors[0].nodeType").doesNotExist())
                .andExpect(jsonPath("$.factors[1].nodeId").value(42))
                .andExpect(jsonPath("$.factors[1].nodeName").value("Jane Marsh"))
                // Keys the owner-type glyph on the card's second row.
                .andExpect(jsonPath("$.factors[1].nodeType").value("INDIVIDUAL"))
                // The code travels separately from the label so the tab can render a flag and
                // the full country name; a label of "Country of residence: GB" would force the
                // browser to parse a display string back apart.
                .andExpect(jsonPath("$.factors[1].countryCode").value("GB"))
                .andExpect(jsonPath("$.factors[0].countryCode").doesNotExist())
                .andExpect(jsonPath("$.unanswered[0].code").value("NOMINEE"))
                .andExpect(jsonPath("$.unanswered[0].nodeName").value("Marsh Holdings"))
                .andExpect(jsonPath("$.unanswered[0].nodeType").value("PRIVATE_COMPANY"));
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
