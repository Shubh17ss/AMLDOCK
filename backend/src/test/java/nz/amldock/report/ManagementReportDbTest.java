package nz.amldock.report;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.email.EmailService;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.firm.FirmPublicIds;
import nz.amldock.report.dto.OwnerTypeReportDto;
import nz.amldock.report.dto.PropertyTypeReportDto;
import nz.amldock.report.dto.ReportOverviewDto;
import nz.amldock.report.dto.TrainingReportDto;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The management report's numbers, against a real schema: the triggers that stamp owners with
 * their firm and overseas flag, and the partial indexes the queries lean on, only exist there.
 *
 * <p>Seeds two firms with random names (the second one only to prove nothing leaks across) and
 * removes everything it made afterwards, like the other {@code @SpringBootTest} DB tests.
 *
 * <p>Every check reports on the AML year 1 Jul 2025 - 30 Jun 2026 in Auckland time.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class ManagementReportDbTest {

    private static final String TZ = "Pacific/Auckland";
    private static final String FROM = "2025-07-01";
    private static final String TO = "2026-06-30";

    @Autowired ManagementReportService reports;
    @Autowired ManagementReportQuery query;
    @Autowired PlatformTransactionManager transactions;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @MockBean FileStorageService storage;
    @MockBean EmailService email;

    Long firm;
    Long branchA;
    Long branchB;
    Long otherFirm;
    Long otherBranch;
    Long officer;
    Long agent;
    String officerEmail;

    @BeforeEach
    void seed() {
        firm = newFirm("Report firm ");
        branchA = newBranch(firm, "Ponsonby");
        branchB = newBranch(firm, "Takapuna");
        otherFirm = newFirm("Other firm ");
        otherBranch = newBranch(otherFirm, "Elsewhere");

        officerEmail = "report-officer-" + UUID.randomUUID() + "@test.invalid";
        officer = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id)"
                + " VALUES (:e, 'Olive Officer', 'AML_COMPLIANCE_OFFICER', :f) RETURNING id",
                Map.of("e", officerEmail, "f", firm));
        jdbc.update("INSERT INTO firm_membership (app_user_id, real_estate_firm_id, role, is_active)"
                + " VALUES (:u, :f, 'AML_COMPLIANCE_OFFICER', true)", Map.of("u", officer, "f", firm));
        agent = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id, firm_branch_id)"
                + " VALUES (:e, 'Aaron Agent', 'AGENT', :f, :b) RETURNING id",
                Map.of("e", "report-agent-" + UUID.randomUUID() + "@test.invalid", "f", firm, "b", branchA));
        Long otherAgent = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id, firm_branch_id)"
                + " VALUES (:e, 'Other Agent', 'AGENT', :f, :b) RETURNING id",
                Map.of("e", "report-other-" + UUID.randomUUID() + "@test.invalid", "f", otherFirm, "b", otherBranch));

        // ── deals ──
        // d1: new, low risk, inside the window.
        Long d1 = deal(branchA, "RESIDENTIAL", "NEW", "LOW", "2025-08-01T10:00:00+12:00", null, null, null, null);
        // d2: verified in the window, high risk, signed off and not yet assured.
        Long d2 = deal(branchA, "RESIDENTIAL", "VERIFIED", "HIGH", "2025-09-01T10:00:00+12:00",
                "2025-09-10T10:00:00+12:00", null, null, null);
        assurance(d2, null);
        // d3: closed and sold in the window, assured.
        Long d3 = deal(branchB, "RURAL", "CLOSED", "MEDIUM", "2025-10-01T10:00:00+13:00",
                "2025-10-05T10:00:00+13:00", "2025-10-20T10:00:00+13:00", true, new BigDecimal("1000000"));
        assurance(d3, "ASSURED");
        // d4: a development closed and sold in the window; its price is its units', and it is unrated.
        Long d4 = deal(branchB, "DEVELOPMENT", "CLOSED", null, "2025-11-01T10:00:00+13:00",
                "2025-11-02T10:00:00+13:00", "2025-11-15T10:00:00+13:00", true, null);
        assurance(d4, "ACTION_REQUIRED");
        jdbc.update("INSERT INTO deal_sale_unit (deal_id, unit_name, sale_price, sort_order) VALUES"
                + " (:d, 'Unit 1', 300000, 0), (:d, 'Unit 2', 200000, 1)", Map.of("d", d4));
        // d5: 23:30 on 30 June 2025 in Auckland - the previous AML year, though 1 July is not far off.
        Long d5 = deal(branchA, "RESIDENTIAL", "REVIEW", "LOW", "2025-06-30T23:30:00+12:00", null, null, null, null);
        // d6: 23:30 on the window's last day, and no property type.
        Long d6 = deal(branchA, null, "ON_HOLD", null, "2026-06-30T23:30:00+12:00", null, null, null, null);
        // d7: created long before the window but verified inside it.
        deal(branchA, "RESIDENTIAL", "VERIFIED", "LOW", "2024-01-01T10:00:00+13:00",
                "2025-12-01T10:00:00+13:00", null, null, null);
        // The other firm's deal sits inside the window and must not be counted.
        Long dx = deal(otherBranch, "RESIDENTIAL", "NEW", "HIGH", "2025-08-01T10:00:00+12:00", null, null, null, null,
                otherAgent);

        // ── owners ──
        UUID ann = UUID.randomUUID();
        UUID bob = UUID.randomUUID();
        Long s1 = structure(d1);
        node(s1, "INDIVIDUAL", "Ann", ann, "VERIFIED", null);
        // Registered in Australia, so overseas for an NZ firm, and cleared with an exception.
        node(s1, "TRUST", "Ann Family Trust", UUID.randomUUID(), "VERIFIED_WITH_EXCEPTION", "AU");
        Long s2 = structure(d2);
        node(s2, "INDIVIDUAL", "Ann", ann, "VERIFIED", null);                 // Ann, re-used
        node(s2, "PRIVATE_COMPANY", "Acme Ltd", UUID.randomUUID(), "IN_PROGRESS", "NZ");
        Long s3 = structure(d3);
        node(s3, "INDIVIDUAL", "Bob", bob, "VERIFIED", null);                 // Bob, re-used from d5
        Long s5 = structure(d5);
        node(s5, "INDIVIDUAL", "Bob", bob, "VERIFIED", null);                 // outside the window
        Long sx = structure(dx);
        node(sx, "TRUST", "Foreign Trust", UUID.randomUUID(), "VERIFIED_WITH_EXCEPTION", "GB");

        // ── training ──
        Long provider = insert("INSERT INTO training_provider (name, created_by_user_id) VALUES ('Provider', :u) RETURNING id",
                Map.of("u", officer));
        Long overdueCourse = course(firm, branchA, "2020-01-01");
        Long openCourse = course(firm, null, "2999-01-01");
        assign(overdueCourse, agent, false, null);
        assign(openCourse, agent, true, "2025-08-01T10:00:00+12:00");
        assign(openCourse, officer, null, null);
        Long inWindow = session(firm, branchA, provider, "2025-09-15", 60);
        Long beforeWindow = session(firm, branchA, provider, "2024-01-01", 90);
        attend(inWindow, agent, "2025-09-15T12:00:00+12:00");
        attend(inWindow, officer, null);
        attend(beforeWindow, agent, "2024-01-01T12:00:00+13:00");
        Long otherCourse = course(otherFirm, otherBranch, "2020-01-01");
        assign(otherCourse, otherAgent, false, null);

        signIn(officer, officerEmail, Role.AML_COMPLIANCE_OFFICER, firm);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        // Records first, for both firms, then people and places: the other firm's course was set up
        // by this firm's officer, so no user can go while any firm's records remain.
        for (Long f : List.of(firm, otherFirm)) {
            Map<String, Object> p = Map.of("f", f);
            String dealsOfFirm = "SELECT d.id FROM deal d JOIN firm_branch b ON b.id = d.firm_branch_id"
                    + " WHERE b.real_estate_firm_id = :f";
            jdbc.update("DELETE FROM training_session_attendee WHERE training_session_id IN"
                    + " (SELECT id FROM training_session WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM training_session WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM training_course_assignee WHERE training_course_id IN"
                    + " (SELECT id FROM training_course WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM training_course WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM training_provider WHERE created_by_user_id IN"
                    + " (SELECT id FROM app_user WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM ownership_node WHERE ownership_structure_id IN"
                    + " (SELECT id FROM ownership_structure WHERE deal_id IN (" + dealsOfFirm + "))", p);
            jdbc.update("DELETE FROM ownership_structure WHERE deal_id IN (" + dealsOfFirm + ")", p);
            jdbc.update("DELETE FROM deal_sale_unit WHERE deal_id IN (" + dealsOfFirm + ")", p);
            List<Long> propertyIds = jdbc.queryForList("SELECT d.property_id FROM deal d WHERE d.id IN ("
                    + dealsOfFirm + ")", p, Long.class);
            List<Long> clientIds = jdbc.queryForList("SELECT d.client_id FROM deal d WHERE d.id IN ("
                    + dealsOfFirm + ")", p, Long.class);
            jdbc.update("DELETE FROM deal WHERE id IN (" + dealsOfFirm + ")", p);
            if (!propertyIds.isEmpty()) jdbc.update("DELETE FROM property WHERE id IN (:ids)", Map.of("ids", propertyIds));
            if (!clientIds.isEmpty()) jdbc.update("DELETE FROM client WHERE id IN (:ids)", Map.of("ids", clientIds));
        }
        for (Long f : List.of(firm, otherFirm)) {
            Map<String, Object> p = Map.of("f", f);
            jdbc.update("DELETE FROM firm_membership WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM app_user WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", p);
        }
    }

    /* ---------- the sections ---------- */

    @Test
    void theOverviewCountsTheWindowsDealsByStatusRiskAndAssurance() {
        ReportOverviewDto o = reports.overview(window(null, null));

        // d1, d2, d3, d4 and d6: d5 was created in the previous AML year, d7 long before.
        assertThat(o.created()).isEqualTo(5);
        assertThat(o.byStatus()).containsExactly(
                Map.entry("NEW", 1L), Map.entry("REVIEW", 0L), Map.entry("ON_HOLD", 1L),
                Map.entry("VERIFIED", 1L), Map.entry("CLOSED", 2L));
        assertThat(o.open()).isEqualTo(2);
        assertThat(o.signedOff()).isEqualTo(3);
        assertThat(o.byRisk()).containsExactly(
                Map.entry("LOW", 1L), Map.entry("MEDIUM", 1L), Map.entry("HIGH", 1L), Map.entry("NOT_ASSESSED", 2L));
        assertThat(o.highRisk()).isEqualTo(1);
        assertThat(o.byAssurance()).containsExactly(
                Map.entry("ASSURED", 1L), Map.entry("ACTION_REQUIRED", 1L), Map.entry("AWAITING", 1L));
        assertThat(o.actionRequired()).isEqualTo(1);
    }

    @Test
    void aBranchNarrowsEverySection() {
        ReportParams branch = new ReportParams(null, branchB, FROM, TO, TZ);

        assertThat(reports.overview(branch).created()).isEqualTo(2);
        assertThat(reports.propertyTypes(branch).total().created()).isEqualTo(2);
        assertThat(reports.owners(branch).total().owners()).isEqualTo(1);               // Bob on d3
        // Neither course is Takapuna's (one is Ponsonby's, one firm-wide), nor is either session.
        assertThat(reports.training(branch).people()).isEmpty();
    }

    @Test
    void propertyTypesFollowTheReferenceTableWithAShareOfCreated() {
        PropertyTypeReportDto t = reports.propertyTypes(window(null, null));
        Map<String, PropertyTypeReportDto.Row> rows = byKey(t.rows(), PropertyTypeReportDto.Row::propertyType);

        assertThat(t.rows()).extracting(PropertyTypeReportDto.Row::propertyType).containsExactly(
                "RESIDENTIAL", "LIFESTYLE", "COMMERCIAL_SALE", "COMMERCIAL_LEASE", "RURAL", "BUSINESS",
                "DEVELOPMENT", "NOT_SET");

        PropertyTypeReportDto.Row residential = rows.get("RESIDENTIAL");
        assertThat(residential.created()).isEqualTo(2);                 // d1, d2
        assertThat(residential.createdPercent()).isEqualTo(40.0);
        assertThat(residential.verified()).isEqualTo(2);                // d2, and d7 created long before
        assertThat(residential.verifiedAllTime()).isEqualTo(2);
        assertThat(residential.unverifiedAllTime()).isEqualTo(2);       // d1, and d5 from the year before
        assertThat(residential.sold()).isZero();
        assertThat(residential.averageSalePrice()).isNull();

        assertThat(rows.get("RURAL").averageSalePrice()).isEqualByComparingTo("1000000");
        // A development's price is the sum of its units.
        assertThat(rows.get("DEVELOPMENT").maxSalePrice()).isEqualByComparingTo("500000");
        assertThat(rows.get("NOT_SET").created()).isEqualTo(1);         // d6, on the window's last day
        assertThat(rows.get("LIFESTYLE").created()).isZero();

        PropertyTypeReportDto.Row total = t.total();
        assertThat(total.propertyType()).isNull();
        assertThat(total.created()).isEqualTo(5);
        assertThat(total.createdPercent()).isEqualTo(100.0);
        assertThat(total.verified()).isEqualTo(4);
        assertThat(total.closed()).isEqualTo(2);
        assertThat(total.verifiedAllTime()).isEqualTo(4);
        assertThat(total.unverifiedAllTime()).isEqualTo(3);
        assertThat(total.sold()).isEqualTo(2);
        assertThat(total.averageSalePrice()).isEqualByComparingTo("750000");
        assertThat(total.maxSalePrice()).isEqualByComparingTo("1000000");
    }

    @Test
    void ownersAreCountedLikeTheRegistersWithReuseAcrossTheFirm() {
        OwnerTypeReportDto o = reports.owners(window(null, null));
        Map<String, OwnerTypeReportDto.Row> rows = byKey(o.rows(), OwnerTypeReportDto.Row::ownerType);

        assertThat(o.rows()).hasSize(12);
        // Ann twice (d1, d2) and Bob once (d3); both are on another deal of the firm's, Bob's being
        // outside the window.
        assertThat(rows.get("INDIVIDUAL")).isEqualTo(new OwnerTypeReportDto.Row("INDIVIDUAL", 3, 0, 2, 0));
        assertThat(rows.get("TRUST")).isEqualTo(new OwnerTypeReportDto.Row("TRUST", 1, 1, 0, 1));
        assertThat(rows.get("PRIVATE_COMPANY")).isEqualTo(new OwnerTypeReportDto.Row("PRIVATE_COMPANY", 1, 0, 0, 0));
        assertThat(rows.get("CHARITY").owners()).isZero();
        // The other firm's overseas trust with an exception is nowhere.
        assertThat(o.total()).isEqualTo(new OwnerTypeReportDto.Row(null, 5, 1, 2, 1));
    }

    @Test
    void trainingReportsCoursesAsTheyStandAndSessionsInsideTheWindow() {
        TrainingReportDto t = reports.training(window(null, null));
        Map<String, TrainingReportDto.Person> people = byKey(t.people(), TrainingReportDto.Person::fullName);

        assertThat(t.people()).extracting(TrainingReportDto.Person::fullName)
                .containsExactly("Aaron Agent", "Olive Officer");

        TrainingReportDto.Person agentRow = people.get("Aaron Agent");
        assertThat(agentRow.role()).isEqualTo("AGENT");
        assertThat(agentRow.branchName()).isEqualTo("Ponsonby");
        assertThat(agentRow.coursesAssigned()).isEqualTo(2);
        assertThat(agentRow.coursesPassed()).isEqualTo(1);
        assertThat(agentRow.coursesOverdue()).isEqualTo(1);
        assertThat(agentRow.sessionsAssigned()).isEqualTo(1);           // the 2024 session is outside
        assertThat(agentRow.sessionsAttended()).isEqualTo(1);
        assertThat(agentRow.minutesAttended()).isEqualTo(60);
        assertThat(agentRow.lastCompletedAt()).isEqualTo(Instant.parse("2025-09-15T00:00:00Z"));

        TrainingReportDto.Person officerRow = people.get("Olive Officer");
        assertThat(officerRow.branchName()).isNull();                   // firm-level
        assertThat(officerRow.coursesOverdue()).isZero();               // due in 2999
        assertThat(officerRow.sessionsAttended()).isZero();

        assertThat(t.summary()).isEqualTo(new TrainingReportDto.Summary(2, 3, 1, 1, 1, 1, 2, 1, 60));
    }

    /* ---------- scope and window ---------- */

    @Test
    void allTimeTakesInEverythingUpToTheEndDay() {
        ReportOverviewDto o = reports.overview(new ReportParams(null, null, null, TO, TZ));
        assertThat(o.created()).isEqualTo(7);                           // d5 and d7 join in
    }

    @Test
    void anOfficerIsPinnedToTheirOwnFirmWhateverTheyAskFor() {
        ReportOverviewDto o = reports.overview(new ReportParams(otherFirm, null, FROM, TO, TZ));
        assertThat(o.created()).isEqualTo(5);
    }

    @Test
    void anotherFirmsBranchIsNotFound() {
        assertThatThrownBy(() -> reports.owners(new ReportParams(null, otherBranch, FROM, TO, TZ)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void rootMustNameAFirmAndThenSeesThatFirm() {
        signIn(null, "root@test.invalid", Role.ROOT, null);
        assertThatThrownBy(() -> reports.overview(window(null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThat(reports.overview(new ReportParams(otherFirm, null, FROM, TO, TZ)).created()).isEqualTo(1);
    }

    @Test
    void financeAndBranchStaffAreTurnedAway() {
        signIn(officer, officerEmail, Role.FINANCE, firm);
        assertThatThrownBy(() -> reports.overview(window(null, null))).isInstanceOf(ForbiddenException.class);
        signIn(agent, "agent@test.invalid", Role.SALES_MANAGER, firm, branchA);
        assertThatThrownBy(() -> reports.training(window(null, null))).isInstanceOf(ForbiddenException.class);
        signIn(agent, "agent@test.invalid", Role.AGENT, firm, branchA);
        assertThatThrownBy(() -> reports.owners(window(null, null))).isInstanceOf(ForbiddenException.class);
    }

    /**
     * SET LOCAL outside a transaction is only a warning, so a timeout set on a connection other than
     * the queries' would fail silently. It has to land in the same read-only transaction.
     */
    @Test
    void theStatementTimeoutHoldsForTheTransactionAndNoLonger() {
        TransactionTemplate tx = new TransactionTemplate(transactions);
        tx.setReadOnly(true);
        String inside = tx.execute(status -> {
            query.limitStatementTime();
            return jdbc.queryForObject("SHOW statement_timeout", Map.of(), String.class);
        });
        assertThat(inside).isEqualTo("10s");
        assertThat(jdbc.queryForObject("SHOW statement_timeout", Map.of(), String.class)).isNotEqualTo("10s");
    }

    @Test
    void aMalformedWindowIsABadRequest() {
        assertThatThrownBy(() -> reports.overview(new ReportParams(null, null, TO, FROM, TZ)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reports.overview(new ReportParams(null, null, "1 July", TO, TZ)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> reports.overview(new ReportParams(null, null, FROM, TO, "Mars/Olympus")))
                .isInstanceOf(BadRequestException.class);
    }

    /* ---------- helpers ---------- */

    private static ReportParams window(Long firmId, Long branchId) {
        return new ReportParams(firmId, branchId, FROM, TO, TZ);
    }

    private static <T> Map<String, T> byKey(List<T> rows, Function<T, String> key) {
        return rows.stream().collect(Collectors.toMap(key, Function.identity()));
    }

    private void signIn(Long id, String email, Role role, Long firmId) {
        signIn(id, email, role, firmId, null);
    }

    private void signIn(Long id, String email, Role role, Long firmId, Long branchId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(id, email, null, role, firmId, branchId, true), null, List.of()));
    }

    private Long newFirm(String name) {
        return insert("INSERT INTO real_estate_firm (name, country, public_id) VALUES (:n, 'NZ', :p) RETURNING id",
                Map.of("n", name + UUID.randomUUID(), "p", FirmPublicIds.newId()));
    }

    private Long newBranch(Long firmId, String name) {
        return insert("INSERT INTO firm_branch (real_estate_firm_id, name, public_id) VALUES (:f, :n, :p) RETURNING id",
                Map.of("f", firmId, "n", name, "p", FirmPublicIds.newId()));
    }

    private Long deal(Long branch, String propertyType, String status, String risk, String createdAt,
                      String decidedAt, String closedAt, Boolean sold, BigDecimal salePrice) {
        return deal(branch, propertyType, status, risk, createdAt, decidedAt, closedAt, sold, salePrice, agent);
    }

    private Long deal(Long branch, String propertyType, String status, String risk, String createdAt,
                      String decidedAt, String closedAt, Boolean sold, BigDecimal salePrice, Long creator) {
        Map<String, Object> p = new HashMap<>();
        p.put("t", propertyType);
        Long property = insert("INSERT INTO property (country, property_type) VALUES ('NZ', :t) RETURNING id", p);
        Long client = insert("INSERT INTO client (display_name) VALUES ('Client') RETURNING id", Map.of());
        p.clear();
        p.put("b", branch);
        p.put("p", property);
        p.put("c", client);
        p.put("s", status);
        p.put("r", risk);
        p.put("u", creator);
        p.put("id", UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        p.put("created", ts(createdAt));
        p.put("decided", ts(decidedAt));
        p.put("closed", ts(closedAt));
        p.put("sold", sold);
        p.put("price", salePrice);
        return insert("INSERT INTO deal (firm_branch_id, property_id, client_id, status, transaction_type,"
                + " created_by_user_id, public_id, risk_rating, created_at, decided_at, last_closed_at,"
                + " property_sold, sale_price)"
                + " VALUES (:b, :p, :c, :s, 'SALE', :u, :id, :r, :created, :decided, :closed, :sold, :price)"
                + " RETURNING id", p);
    }

    /** Stands the deal on a signed-off version with the given verdict (null = not yet assured). */
    private void assurance(Long dealId, String verdict) {
        Map<String, Object> p = new HashMap<>();
        p.put("d", dealId);
        p.put("v", verdict);
        jdbc.update("UPDATE deal SET latest_version_id = :d, latest_version_no = 1,"
                + " latest_assurance_status = :v WHERE id = :d", p);
    }

    private Long structure(Long dealId) {
        return insert("INSERT INTO ownership_structure (deal_id, side) VALUES (:d, 'VENDOR') RETURNING id",
                Map.of("d", dealId));
    }

    private void node(Long structureId, String type, String name, UUID identity, String verification,
                      String jurisdiction) {
        Map<String, Object> p = new HashMap<>();
        p.put("s", structureId);
        p.put("t", type);
        p.put("n", name);
        p.put("k", identity);
        p.put("v", verification);
        p.put("j", jurisdiction);
        jdbc.update("INSERT INTO ownership_node (ownership_structure_id, node_type, display_name, identity_key,"
                + " verification_status, jurisdiction_country) VALUES (:s, :t, :n, :k, :v, :j)", p);
    }

    private Long course(Long firmId, Long branchId, String dueDate) {
        Map<String, Object> p = new HashMap<>();
        p.put("f", firmId);
        p.put("b", branchId);
        p.put("d", java.time.LocalDate.parse(dueDate));
        p.put("u", officer);
        return insert("INSERT INTO training_course (name, pass_mark_percent, real_estate_firm_id, firm_branch_id,"
                + " due_date, created_by_user_id) VALUES ('Course', 80, :f, :b, :d, :u) RETURNING id", p);
    }

    private void assign(Long courseId, Long userId, Boolean passed, String completedAt) {
        Map<String, Object> p = new HashMap<>();
        p.put("c", courseId);
        p.put("u", userId);
        p.put("p", passed);
        p.put("at", ts(completedAt));
        jdbc.update("INSERT INTO training_course_assignee (training_course_id, user_id, passed, completed_at)"
                + " VALUES (:c, :u, :p, :at)", p);
    }

    private Long session(Long firmId, Long branchId, Long provider, String date, int minutes) {
        Map<String, Object> p = new HashMap<>();
        p.put("f", firmId);
        p.put("b", branchId);
        p.put("p", provider);
        p.put("d", java.time.LocalDate.parse(date));
        p.put("m", minutes);
        p.put("u", officer);
        return insert("INSERT INTO training_session (name, location, training_provider_id, session_date,"
                + " total_minutes, real_estate_firm_id, firm_branch_id, created_by_user_id)"
                + " VALUES ('Session', 'Office', :p, :d, :m, :f, :b, :u) RETURNING id", p);
    }

    private void attend(Long sessionId, Long userId, String completedAt) {
        Map<String, Object> p = new HashMap<>();
        p.put("s", sessionId);
        p.put("u", userId);
        p.put("at", ts(completedAt));
        jdbc.update("INSERT INTO training_session_attendee (training_session_id, user_id, completed_at)"
                + " VALUES (:s, :u, :at)", p);
    }

    private static java.time.OffsetDateTime ts(String iso) {
        return iso == null ? null : java.time.OffsetDateTime.parse(iso);
    }

    private Long insert(String sql, Map<String, ?> params) {
        return jdbc.queryForObject(sql, params, Long.class);
    }
}
