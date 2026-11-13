package nz.amldock.auth;

import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/** Staff still signed in to a deactivated entity may read it and switch away, nothing else. */
class InactiveScopeReadOnlyFilterTest {

    static final Long FIRM = 7L;

    final RealEstateFirmRepository firms = mock(RealEstateFirmRepository.class);
    final InactiveScopeReadOnlyFilter filter = new InactiveScopeReadOnlyFilter(firms);
    final RealEstateFirm firm = new RealEstateFirm();

    @BeforeEach
    void setUp() {
        firm.setName("Harbour Realty");
        lenient().when(firms.findById(FIRM)).thenReturn(Optional.of(firm));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void signIn(Role role, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(2L, "x@a.com", null, role, firmId, null, true), null, List.of()));
    }

    private MockHttpServletResponse send(String method, String path) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        req.setServletPath(path);
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        return res;
    }

    @Test
    void writesInADeactivatedEntityAreRefused() throws Exception {
        signIn(Role.AML_COMPLIANCE_OFFICER, FIRM);
        firm.setActive(false);

        MockHttpServletResponse res = send("POST", "/api/deals/abc/notes");

        assertThat(res.getStatus()).isEqualTo(403);
        assertThat(res.getErrorMessage()).contains("Harbour Realty is deactivated");
    }

    @Test
    void readsAndSwitchingAwayAreNot() throws Exception {
        signIn(Role.SENIOR_MANAGER, FIRM);
        firm.setActive(false);

        assertThat(send("GET", "/api/deals").getStatus()).isEqualTo(200);
        assertThat(send("POST", "/api/auth/switch-entity").getStatus()).isEqualTo(200);
        assertThat(send("POST", "/api/auth/logout").getStatus()).isEqualTo(200);
    }

    @Test
    void anActiveEntityIsUntouched() throws Exception {
        signIn(Role.AML_COMPLIANCE_OFFICER, FIRM);

        assertThat(send("POST", "/api/deals/abc/notes").getStatus()).isEqualTo(200);
    }

    @Test
    void rootBelongsToNoEntityAndIsLeftToTheRecordChecks() throws Exception {
        signIn(Role.ROOT, null);

        assertThat(send("DELETE", "/api/deals/abc").getStatus()).isEqualTo(200);
    }
}
