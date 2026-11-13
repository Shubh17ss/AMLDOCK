package nz.amldock.firm;

import nz.amldock.common.exception.ApiException;
import nz.amldock.deal.PublicIds;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.email.EmailService;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;

/**
 * Off-boarding a reporting entity against the real schema: the cascade to branches and staff,
 * reactivation restoring only what it closed, and deletion with its retention rules. Needs the
 * dev Postgres; seeds its own entities and removes whatever is left of them.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class FirmOffboardingDbTest {

    @Autowired FirmOffboardingService offboarding;
    @Autowired FirmDeletionService deletion;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @MockBean FileStorageService storage;
    @MockBean EmailService email;

    final List<Long> firmIds = new ArrayList<>();
    final String tag = UUID.randomUUID().toString().substring(0, 8);

    Long firm;
    String firmName;
    Long branch;
    Long closedBranch;
    Long officer;
    Long agent;
    Long closedAgent;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(1L, "root@amldock.com", null, Role.ROOT, null, null, true), null, List.of()));
        firmName = "Offboarding test " + tag;
        firm = firm(firmName, "AU");
        branch = branch(firm, "Bondi " + tag);
        closedBranch = branch(firm, "Manly " + tag);
        officer = user(Role.AML_COMPLIANCE_OFFICER, firm, null);
        agent = user(Role.AGENT, firm, branch);
        closedAgent = user(Role.AGENT, firm, closedBranch);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        for (Long f : firmIds) {
            Map<String, Object> p = Map.of("f", f);
            jdbc.update("DELETE FROM deal WHERE firm_branch_id IN (SELECT id FROM firm_branch WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM app_user WHERE id IN (SELECT app_user_id FROM firm_membership WHERE real_estate_firm_id = :f)"
                    + " AND id NOT IN (SELECT app_user_id FROM firm_membership WHERE real_estate_firm_id <> :f)", p);
            jdbc.update("DELETE FROM firm_membership WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM app_user WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", p);
        }
    }

    @Test
    void deactivatingClosesEveryBranchAndItsStaffButNotItsOfficers() {
        closeBranchByHand(closedBranch, Instant.now());

        offboarding.deactivate(firm);

        assertThat(bool("SELECT is_active FROM real_estate_firm WHERE id = :id", firm)).isFalse();
        assertThat(str("SELECT deactivation_source FROM firm_branch WHERE id = :id", branch)).isEqualTo("FIRM");
        // Closed by hand first: keeps its own cause.
        assertThat(str("SELECT deactivation_source FROM firm_branch WHERE id = :id", closedBranch)).isEqualTo("MANUAL");
        assertThat(bool("SELECT is_active FROM app_user WHERE id = :id", agent)).isFalse();
        assertThat(bool("SELECT is_active FROM app_user WHERE id = :id", officer)).isTrue();
    }

    @Test
    void reactivatingBringsBackOnlyWhatItClosed() {
        closeBranchByHand(closedBranch, Instant.now());
        offboarding.deactivate(firm);

        offboarding.activate(firm);

        assertThat(bool("SELECT is_active FROM real_estate_firm WHERE id = :id", firm)).isTrue();
        assertThat(bool("SELECT is_active FROM firm_branch WHERE id = :id", branch)).isTrue();
        assertThat(bool("SELECT is_active FROM app_user WHERE id = :id", agent)).isTrue();
        assertThat(bool("SELECT is_active FROM firm_branch WHERE id = :id", closedBranch)).isFalse();
        assertThat(bool("SELECT is_active FROM app_user WHERE id = :id", closedAgent)).isFalse();
    }

    @Test
    void deletingKeepsAnOfficerWhoServesAnotherEntity() {
        Long other = firm("Other " + tag, "NZ");
        membership(officer, other, null, Role.AML_COMPLIANCE_OFFICER, true);
        Long deal = deal(branch, agent);
        String key = "deals/" + deal + "/" + tag + ".pdf";
        jdbc.update("INSERT INTO document (deal_id, s3_key, original_filename, content_type, size_bytes,"
                + " document_type, uploaded_by_user_id) VALUES (:d, :k, 'p.pdf', 'application/pdf', 1,"
                + " 'NZ_PASSPORT', :u)", Map.of("d", deal, "k", key, "u", agent));

        FirmDeletionService.Preview preview = deletion.preview(firm);
        assertThat(preview.eligible()).isTrue();
        assertThat(preview.blockers()).isEmpty();
        assertThat(preview.usersKept()).isEqualTo(1);

        deletion.delete(firm, firmName);

        assertThat(exists("real_estate_firm", firm)).isFalse();
        assertThat(exists("firm_branch", branch)).isFalse();
        assertThat(exists("app_user", agent)).isFalse();
        assertThat(exists("app_user", officer)).isTrue();
        assertThat(jdbc.queryForObject("SELECT real_estate_firm_id FROM app_user WHERE id = :id",
                Map.of("id", officer), Long.class)).isEqualTo(other);
        verify(storage).delete(key);
    }

    @Test
    void aDeactivatedEntityIsHeldForSevenYearsInAustralia() {
        offboarding.deactivate(firm);
        // Six years in: still held.
        backdate("real_estate_firm", firm, Instant.now().minus(6 * 366, ChronoUnit.DAYS));
        backdate("firm_branch", branch, Instant.now().minus(6 * 366, ChronoUnit.DAYS));
        backdate("firm_branch", closedBranch, Instant.now().minus(6 * 366, ChronoUnit.DAYS));

        assertThat(deletion.preview(firm).eligible()).isFalse();
        assertThatThrownBy(() -> deletion.delete(firm, firmName))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("retention period");
        assertThat(exists("real_estate_firm", firm)).isTrue();
    }

    @Test
    void anActiveEntityWithABranchStillOnHoldCannotBeDeleted() {
        closeBranchByHand(closedBranch, Instant.now().minus(30, ChronoUnit.DAYS));

        FirmDeletionService.Preview preview = deletion.preview(firm);

        assertThat(preview.eligible()).isFalse();
        assertThat(preview.eligibleAt()).isAfter(Instant.now().plus(6 * 365, ChronoUnit.DAYS));
        assertThatThrownBy(() -> deletion.delete(firm, firmName)).isInstanceOf(ApiException.class);
    }

    /* ---------- seeding ---------- */

    private void closeBranchByHand(Long branchId, Instant at) {
        jdbc.update("UPDATE firm_branch SET is_active = false, deactivated_at = :at, deactivation_source = 'MANUAL'"
                + " WHERE id = :b", Map.of("b", branchId, "at", Timestamp.from(at)));
        jdbc.update("UPDATE firm_membership SET is_active = false, deactivation_source = 'BRANCH'"
                + " WHERE firm_branch_id = :b", Map.of("b", branchId));
        jdbc.update("UPDATE app_user SET is_active = false WHERE firm_branch_id = :b", Map.of("b", branchId));
    }

    private void backdate(String table, Long id, Instant at) {
        jdbc.update("UPDATE " + table + " SET deactivated_at = :at WHERE id = :id",
                Map.of("id", id, "at", Timestamp.from(at)));
    }

    private Long firm(String name, String country) {
        Long id = insert("INSERT INTO real_estate_firm (name, country, public_id) VALUES (:n, :c, :p) RETURNING id",
                Map.of("n", name, "c", country, "p", FirmPublicIds.newId()));
        firmIds.add(id);
        return id;
    }

    private Long branch(Long firmId, String name) {
        return insert("INSERT INTO firm_branch (real_estate_firm_id, name, public_id) VALUES (:f, :n, :p) RETURNING id",
                Map.of("f", firmId, "n", name, "p", FirmPublicIds.newId()));
    }

    private Long user(Role role, Long firmId, Long branchId) {
        Map<String, Object> p = new HashMap<>();
        p.put("e", "offb-" + UUID.randomUUID() + "@test.invalid");
        p.put("r", role.name());
        p.put("f", firmId);
        p.put("b", branchId);
        Long id = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id, firm_branch_id)"
                + " VALUES (:e, 'Offboarding test', :r, :f, :b) RETURNING id", p);
        membership(id, firmId, branchId, role, true);
        return id;
    }

    private void membership(Long userId, Long firmId, Long branchId, Role role, boolean active) {
        Map<String, Object> p = new HashMap<>();
        p.put("u", userId);
        p.put("f", firmId);
        p.put("b", branchId);
        p.put("r", role.name());
        p.put("a", active);
        jdbc.update("INSERT INTO firm_membership (app_user_id, real_estate_firm_id, firm_branch_id, role, is_active)"
                + " VALUES (:u, :f, :b, :r, :a)", p);
    }

    private Long deal(Long branchId, Long creator) {
        Long property = insert("INSERT INTO property (country) VALUES ('AU') RETURNING id", Map.of());
        Long client = insert("INSERT INTO client DEFAULT VALUES RETURNING id", Map.of());
        return insert("INSERT INTO deal (firm_branch_id, property_id, client_id, status, transaction_type,"
                + " created_by_user_id, public_id) VALUES (:b, :p, :c, 'NEW', 'SALE', :u, :id) RETURNING id",
                Map.of("b", branchId, "p", property, "c", client, "u", creator, "id", PublicIds.newId()));
    }

    private Long insert(String sql, Map<String, ?> params) {
        return jdbc.queryForObject(sql, params, Long.class);
    }

    private boolean exists(String table, Long id) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE id = :id",
                Map.of("id", id), Long.class) > 0;
    }

    private Boolean bool(String sql, Long id) {
        return jdbc.queryForObject(sql, Map.of("id", id), Boolean.class);
    }

    private String str(String sql, Long id) {
        return jdbc.queryForObject(sql, Map.of("id", id), String.class);
    }
}
