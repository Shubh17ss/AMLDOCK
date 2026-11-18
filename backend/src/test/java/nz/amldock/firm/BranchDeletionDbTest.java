package nz.amldock.firm;

import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Deleting a branch against the real schema: the order of the deletes is only proven by Postgres
 * accepting it. Needs the dev Postgres, like the other {@code @SpringBootTest} classes. Each test
 * seeds its own entity with random names and removes whatever is left of it afterwards; stored
 * files are a mock, so nothing touches S3.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class BranchDeletionDbTest {

    @Autowired BranchDeletionService deletion;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @MockBean FileStorageService storage;
    @MockBean EmailService email;

    final List<Long> firmIds = new ArrayList<>();
    final String tag = UUID.randomUUID().toString().substring(0, 8);

    Long firm;
    Long branch;
    Long otherBranch;
    Long officer;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(1L, "root@amldock.com", null, Role.ROOT, null, null, true), null, List.of()));
        firm = firm("NZ");
        branch = branch(firm, "Ponsonby " + tag);
        otherBranch = branch(firm, "Remuera " + tag);
        officer = user(Role.AML_COMPLIANCE_OFFICER, firm, null);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        // Whatever a refused delete left behind, children first.
        for (Long f : firmIds) {
            Map<String, Object> p = Map.of("f", f);
            jdbc.update("DELETE FROM deal WHERE firm_branch_id IN (SELECT id FROM firm_branch WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM training_course WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM compliance_document WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM app_user WHERE id IN (SELECT app_user_id FROM firm_membership WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM app_user WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", p);
        }
    }

    @Test
    void deletesEverythingInTheBranchAndNothingOutsideIt() {
        Long agent = user(Role.AGENT, firm, branch);
        // Also an agent in another entity, switched off there: keeps the account, moves home.
        Long firm2 = firm("NZ");
        Long branch2 = branch(firm2, "Takapuna " + tag);
        Long mover = user(Role.AGENT, firm, branch);
        membership(mover, firm2, branch2, Role.AGENT, false);

        Long deal = deal(branch, agent);
        String docKey = "deals/" + deal + "/" + tag + "-passport.pdf";
        insert("INSERT INTO document (deal_id, s3_key, original_filename, content_type, size_bytes,"
                + " document_type, uploaded_by_user_id) VALUES (:d, :k, 'p.pdf', 'application/pdf', 1,"
                + " 'NZ_PASSPORT', :u) RETURNING id", Map.of("d", deal, "k", docKey, "u", agent));
        Long owner = insert("INSERT INTO beneficial_owner (real_estate_firm_id) VALUES (:f) RETURNING id",
                Map.of("f", firm));
        jdbc.update("INSERT INTO deal_beneficial_owner (deal_id, beneficial_owner_id) VALUES (:d, :o)",
                Map.of("d", deal, "o", owner));
        jdbc.update("INSERT INTO deal_note (deal_id, author_user_id, body) VALUES (:d, :u, 'A note')",
                Map.of("d", deal, "u", officer));
        String complianceKey = "compliance/" + tag + ".pdf";
        insert("INSERT INTO compliance_document (category, name, version_no, s3_key, original_filename,"
                + " content_type, size_bytes, uploaded_by_user_id, real_estate_firm_id, firm_branch_id)"
                + " VALUES ('RISK_ASSESSMENT', 'RA', 1, :k, 'ra.pdf', 'application/pdf', 1, :u, :f, :b) RETURNING id",
                Map.of("k", complianceKey, "u", officer, "f", firm, "b", branch));
        // Entity-wide training the agent was assigned: the assignment goes with them, the course stays.
        Long course = insert("INSERT INTO training_course (name, pass_mark_percent, created_by_user_id,"
                + " real_estate_firm_id) VALUES ('AML 101', 80, :u, :f) RETURNING id",
                Map.of("u", officer, "f", firm));
        jdbc.update("INSERT INTO training_course_assignee (training_course_id, user_id) VALUES (:c, :u)",
                Map.of("c", course, "u", agent));
        Long survivor = deal(otherBranch, user(Role.AGENT, firm, otherBranch));

        BranchDeletionService.Preview preview = deletion.preview(branch);
        assertThat(preview.eligible()).isTrue();
        assertThat(preview.blockers()).isEmpty();
        assertThat(preview.deals()).isEqualTo(1);
        assertThat(preview.documents()).isEqualTo(1);
        assertThat(preview.usersDeleted()).isEqualTo(1);
        assertThat(preview.usersKept()).isEqualTo(1);

        deletion.delete(branch, "Ponsonby " + tag);

        assertThat(exists("firm_branch", branch)).isFalse();
        assertThat(exists("deal", deal)).isFalse();
        assertThat(exists("beneficial_owner", owner)).isFalse();
        assertThat(exists("app_user", agent)).isFalse();
        assertThat(count("SELECT count(*) FROM compliance_document WHERE s3_key = :k", Map.of("k", complianceKey))).isZero();
        assertThat(count("SELECT count(*) FROM training_course_assignee WHERE training_course_id = :c", Map.of("c", course))).isZero();
        // Outside the branch, untouched.
        assertThat(exists("training_course", course)).isTrue();
        assertThat(exists("deal", survivor)).isTrue();
        assertThat(exists("app_user", officer)).isTrue();
        // The mover keeps the account, now homed in the entity they still belong to.
        assertThat(jdbc.queryForObject("SELECT firm_branch_id FROM app_user WHERE id = :u",
                Map.of("u", mover), Long.class)).isEqualTo(branch2);
        // Files go after commit, and only this branch's.
        verify(storage).delete(docKey);
        verify(storage).delete(complianceKey);
    }

    @Test
    void aDeactivatedBranchIsHeldForItsRetentionPeriod() {
        jdbc.update("UPDATE firm_branch SET is_active = false, deactivated_at = :at, deactivation_source = 'MANUAL'"
                + " WHERE id = :b", Map.of("b", branch, "at", Timestamp.from(Instant.now().minus(365, ChronoUnit.DAYS))));

        BranchDeletionService.Preview preview = deletion.preview(branch);
        assertThat(preview.eligible()).isFalse();
        assertThat(preview.eligibleAt()).isAfter(Instant.now());

        assertThatThrownBy(() -> deletion.delete(branch, "Ponsonby " + tag))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("retention period");
        assertThat(exists("firm_branch", branch)).isTrue();
    }

    @Test
    void andMayBeDeletedOnceItHasRun() {
        // NZ: five years and a day ago.
        Instant then = Instant.now().minus(5 * 366 + 1, ChronoUnit.DAYS);
        jdbc.update("UPDATE firm_branch SET is_active = false, deactivated_at = :at, deactivation_source = 'MANUAL'"
                + " WHERE id = :b", Map.of("b", branch, "at", Timestamp.from(then)));

        deletion.delete(branch, "Ponsonby " + tag);

        assertThat(exists("firm_branch", branch)).isFalse();
    }

    @Test
    void refusesWhenSomeoneItWouldDeleteAuthoredSomethingElsewhere() {
        Long agent = user(Role.AGENT, firm, branch);
        // Created while they were in the other branch, before a move.
        Long elsewhere = deal(otherBranch, agent);

        BranchDeletionService.Preview preview = deletion.preview(branch);
        assertThat(preview.blockers()).singleElement().asString().contains("deals in other branches");

        assertThatThrownBy(() -> deletion.delete(branch, "Ponsonby " + tag))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("can't be deleted");
        assertThat(exists("firm_branch", branch)).isTrue();
        assertThat(exists("deal", elsewhere)).isTrue();
        verify(storage, never()).delete(anyString());
    }

    @Test
    void theNameMustBeTypedExactly() {
        assertThatThrownBy(() -> deletion.delete(branch, "ponsonby " + tag))
                .isInstanceOf(BadRequestException.class);
        assertThat(exists("firm_branch", branch)).isTrue();
    }

    /* ---------- seeding ---------- */

    private Long firm(String country) {
        Long id = insert("INSERT INTO real_estate_firm (name, country, public_id) VALUES (:n, :c, :p) RETURNING id",
                Map.of("n", "Deletion test " + UUID.randomUUID(), "c", country, "p", FirmPublicIds.newId()));
        firmIds.add(id);
        return id;
    }

    private Long branch(Long firmId, String name) {
        return insert("INSERT INTO firm_branch (real_estate_firm_id, name, public_id) VALUES (:f, :n, :p) RETURNING id",
                Map.of("f", firmId, "n", name, "p", FirmPublicIds.newId()));
    }

    private Long user(Role role, Long firmId, Long branchId) {
        Map<String, Object> p = new java.util.HashMap<>();
        p.put("e", "del-" + UUID.randomUUID() + "@test.invalid");
        p.put("r", role.name());
        p.put("f", firmId);
        p.put("b", branchId);
        Long id = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id, firm_branch_id)"
                + " VALUES (:e, 'Deletion test', :r, :f, :b) RETURNING id", p);
        membership(id, firmId, branchId, role, true);
        return id;
    }

    private void membership(Long userId, Long firmId, Long branchId, Role role, boolean active) {
        Map<String, Object> p = new java.util.HashMap<>();
        p.put("u", userId);
        p.put("f", firmId);
        p.put("b", branchId);
        p.put("r", role.name());
        p.put("a", active);
        jdbc.update("INSERT INTO firm_membership (app_user_id, real_estate_firm_id, firm_branch_id, role, is_active)"
                + " VALUES (:u, :f, :b, :r, :a)", p);
    }

    private Long deal(Long branchId, Long creator) {
        Long property = insert("INSERT INTO property (country) VALUES ('NZ') RETURNING id", Map.of());
        Long client = insert("INSERT INTO client DEFAULT VALUES RETURNING id", Map.of());
        return insert("INSERT INTO deal (firm_branch_id, property_id, client_id, status, transaction_type,"
                + " created_by_user_id, public_id) VALUES (:b, :p, :c, 'NEW', 'SALE', :u, :id) RETURNING id",
                Map.of("b", branchId, "p", property, "c", client, "u", creator, "id", PublicIds.newId()));
    }

    private Long insert(String sql, Map<String, ?> params) {
        return jdbc.queryForObject(sql, params, Long.class);
    }

    private boolean exists(String table, Long id) {
        return count("SELECT count(*) FROM " + table + " WHERE id = :id", Map.of("id", id)) > 0;
    }

    private long count(String sql, Map<String, ?> params) {
        return jdbc.queryForObject(sql, params, Long.class);
    }
}
