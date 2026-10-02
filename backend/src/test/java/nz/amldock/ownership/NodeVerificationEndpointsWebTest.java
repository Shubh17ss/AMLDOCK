package nz.amldock.ownership;

import nz.amldock.ownership.dto.NodeDto;
import nz.amldock.ownership.dto.UpdateNodeRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.RecordComponent;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The verify verb as the browser actually reaches it.
 *
 * <p>Everything below the controller is unit-tested in {@code OwnershipServiceTest}; what only a
 * booted context can check is that the route is mapped where {@code api/ownership.js} posts to,
 * that {@code @PreAuthorize} matches the patch beside it, that {@code NodeDto} serialises the
 * byline under the names the Verification tab reads — and that the two fields this route
 * replaced are genuinely gone from the patch, which is the whole reason the route exists.
 *
 * <p>{@code OwnershipService} is mocked, so this touches no data. The security filter chain, the
 * method-security annotations and the JSON mapper are all real.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class NodeVerificationEndpointsWebTest {

    @Autowired MockMvc mvc;
    @MockBean OwnershipService ownership;

    private static final Instant VERIFIED_AT = Instant.parse("2026-09-27T09:15:00Z");
    private static final String ROUTE = "/api/deals/1/ownership/nodes/42/verification";

    private static NodeDto verified(NodeVerificationStatus status, String notes) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", 42L);
        n.setNodeType(NodeType.INDIVIDUAL);
        n.setDisplayName("Lionel Messi");
        n.setVerificationStatus(status);
        n.setVerificationNotes(notes);
        n.setVerifiedByUserId(7L);
        n.setVerifiedAt(VERIFIED_AT);
        return NodeDto.from(n, null, "Olivia Officer");
    }

    /* ---------- the byline the tab renders ---------- */

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void grantingAVerificationReturnsTheBylineUnderTheNamesTheTabReads() throws Exception {
        when(ownership.verifyNode(eq(1L), eq(42L), any()))
                .thenReturn(verified(NodeVerificationStatus.VERIFIED, null));

        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"VERIFIED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("VERIFIED"))
                .andExpect(jsonPath("$.verifiedByName").value("Olivia Officer"))
                .andExpect(jsonPath("$.verifiedAt").exists())
                // A name, never the login behind it — the reviewer is asking who cleared this
                // owner, not which account happened to be open at the time.
                .andExpect(jsonPath("$.verifiedByEmail").doesNotExist())
                .andExpect(jsonPath("$.verificationNotes").doesNotExist());
    }

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void anExceptionCarriesItsReasonBack() throws Exception {
        when(ownership.verifyNode(eq(1L), eq(42L), any())).thenReturn(
                verified(NodeVerificationStatus.VERIFIED_WITH_EXCEPTION, "Passport expired"));

        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"VERIFIED_WITH_EXCEPTION\",\"notes\":\"Passport expired\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("VERIFIED_WITH_EXCEPTION"))
                .andExpect(jsonPath("$.verificationNotes").value("Passport expired"));
    }

    @Test
    @WithMockUser(roles = "AML_COMPLIANCE_OFFICER")
    void anOutcomeIsRequired() throws Exception {
        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    /* ---------- who may grant one ---------- */

    @Test
    @WithMockUser(roles = "SENIOR_MANAGER")
    void aSeniorManagerMayVerify() throws Exception {
        when(ownership.verifyNode(eq(1L), eq(42L), any()))
                .thenReturn(verified(NodeVerificationStatus.VERIFIED, null));

        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"VERIFIED\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "AGENT")
    void anAgentMayNotVerify() throws Exception {
        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"VERIFIED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anAnonymousCallerMayNotVerify() throws Exception {
        mvc.perform(post(ROUTE)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"VERIFIED\"}"))
                .andExpect(status().isUnauthorized());
    }

    /* ---------- the back door that used to exist ---------- */

    @Test
    void thePatchNoLongerCarriesAVerificationAtAll() {
        // Not a route test. UpdateNodeRequest used to accept verificationStatus, which meant any
        // caller could set a node to VERIFIED with nobody named against it — and a byline the
        // client can write is no byline. Granting one now has its own verb, and this is the
        // assertion that stops the fields quietly reappearing on the patch beside it.
        assertThat(UpdateNodeRequest.class.getRecordComponents())
                .extracting(RecordComponent::getName)
                .doesNotContain("verificationStatus", "verificationNotes");
    }
}
