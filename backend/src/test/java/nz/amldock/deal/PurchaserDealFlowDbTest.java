package nz.amldock.deal;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.web.PageRequests;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.UpdateDealRequest;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.email.EmailService;
import nz.amldock.firm.FirmPublicIds;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.OwnershipService;
import nz.amldock.ownership.StructureSide;
import nz.amldock.ownership.dto.CreateNodeRequest;
import nz.amldock.property.dto.PropertyInput;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A deal whose client is the purchaser, end to end against the real schema: the V73 columns, the
 * list filter's SQL, and which side of the structure each step lands on. Needs the dev Postgres,
 * like the other {@code @SpringBootTest} classes. Seeds its own entity with random names and
 * removes it afterwards.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class PurchaserDealFlowDbTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired DealService deals;
    @Autowired DealListService dealList;
    @Autowired DealRiskService risk;
    @Autowired OwnershipService ownership;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @MockBean FileStorageService storage;
    @MockBean EmailService email;

    Long firm;
    Long branch;

    @BeforeEach
    void setUp() {
        firm = insert("INSERT INTO real_estate_firm (name, country, public_id) VALUES (:n, 'NZ', :p) RETURNING id",
                Map.of("n", "Purchaser flow " + UUID.randomUUID(), "p", FirmPublicIds.newId()));
        branch = insert("INSERT INTO firm_branch (real_estate_firm_id, name, public_id) VALUES (:f, :n, :p) RETURNING id",
                Map.of("f", firm, "n", "Ponsonby", "p", FirmPublicIds.newId()));
        Map<String, Object> u = new HashMap<>();
        u.put("e", "purchaser-flow-" + UUID.randomUUID() + "@test.invalid");
        u.put("f", firm);
        Long officer = insert("INSERT INTO app_user (email, full_name, role, real_estate_firm_id)"
                + " VALUES (:e, 'Purchaser flow', 'AML_COMPLIANCE_OFFICER', :f) RETURNING id", u);
        jdbc.update("INSERT INTO firm_membership (app_user_id, real_estate_firm_id, role, is_active)"
                + " VALUES (:u, :f, 'AML_COMPLIANCE_OFFICER', true)", Map.of("u", officer, "f", firm));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(officer, (String) u.get("e"), null, Role.AML_COMPLIANCE_OFFICER, firm, null, true),
                null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        Map<String, Object> p = Map.of("f", firm);
        String dealsOfFirm = "SELECT d.id FROM deal d JOIN firm_branch b ON b.id = d.firm_branch_id"
                + " WHERE b.real_estate_firm_id = :f";
        jdbc.update("DELETE FROM ownership_node WHERE ownership_structure_id IN"
                + " (SELECT id FROM ownership_structure WHERE deal_id IN (" + dealsOfFirm + "))", p);
        jdbc.update("DELETE FROM ownership_structure WHERE deal_id IN (" + dealsOfFirm + ")", p);
        jdbc.update("DELETE FROM deal WHERE id IN (" + dealsOfFirm + ")", p);
        jdbc.update("DELETE FROM firm_membership WHERE real_estate_firm_id = :f", p);
        jdbc.update("DELETE FROM app_user WHERE real_estate_firm_id = :f", p);
        jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", p);
        jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", p);
    }

    @Test
    void aPurchaserDealRunsOnThePurchasersSide() {
        // 1. Created as a purchase, the way section 2 of the form creates it.
        Deal deal = deals.create(create(TransactionType.PURCHASE));
        Long id = deal.getId();
        assertThat(column(id, "transaction_type")).isEqualTo("PURCHASE");

        // 2. Section 3's answers. The purchase pair lands in the V73 columns, and tenure is not asked.
        deals.update(id, answers(SourceOfFunds.CASH, ReasonForPurchase.QUICK_RESALE));
        assertThat(column(id, "source_of_funds")).isEqualTo("CASH");
        assertThat(column(id, "reason_for_purchase")).isEqualTo("QUICK_RESALE");

        DealRiskService.RiskAssessment assessed = risk.assess(id);
        assertThat(assessed.unanswered()).isEmpty();
        assertThat(assessed.factors()).extracting(DealRiskService.RiskFactor::code)
                .containsExactlyInAnyOrder("SOURCE_OF_FUNDS", "REASON_FOR_PURCHASE");
        assertThat(assessed.value()).isEqualTo(9);
        assertThat(assessed.rating()).isEqualTo(RiskRating.HIGH);
        assertThat(column(id, "risk_rating")).isEqualTo("HIGH");

        // 3. The client's structure, asked for without naming a side, is the purchaser's.
        jdbc.update("UPDATE deal SET status = 'REVIEW' WHERE id = :d", Map.of("d", id));
        ownership.getTree(id);
        ownership.createNode(id, null, node(NodeType.INDIVIDUAL, "Bea Buyer"));
        assertThat(sidesOf(id)).containsExactly("PURCHASER");

        // 4. The vendor is the other party: shut until the deal closes as purchased.
        assertThatThrownBy(() -> ownership.createNode(id, StructureSide.VENDOR, node(NodeType.INDIVIDUAL, "Val Vendor")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("The vendor can only be recorded on a deal closed as purchased");

        // 5. The register filters on it in SQL.
        assertThat(listed(TransactionType.PURCHASE)).contains(deal.getPublicId());
        assertThat(listed(TransactionType.SALE)).doesNotContain(deal.getPublicId());
        assertThat(listed(null)).contains(deal.getPublicId());

        // 6. Closed as purchased, the vendor opens - and recording them leaves the rating alone.
        jdbc.update("UPDATE deal SET status = 'CLOSED', property_sold = true WHERE id = :d", Map.of("d", id));
        ownership.createNode(id, StructureSide.VENDOR, node(NodeType.INDIVIDUAL, "Val Vendor"));
        assertThat(sidesOf(id)).containsExactlyInAnyOrder("PURCHASER", "VENDOR");
        assertThat(risk.assess(id).value()).isEqualTo(9);
    }

    @Test
    void aSaleIsUnchanged() {
        Deal deal = deals.create(create(TransactionType.SALE));
        Long id = deal.getId();

        // Tenure is still a gap on a sale, and the purchase pair is never asked.
        assertThat(risk.assess(id).unanswered()).extracting(DealRiskService.RiskGap::code)
                .contains("TENURE")
                .doesNotContain("SOURCE_OF_FUNDS", "REASON_FOR_PURCHASE");

        jdbc.update("UPDATE deal SET status = 'REVIEW' WHERE id = :d", Map.of("d", id));
        ownership.createNode(id, null, node(NodeType.INDIVIDUAL, "Val Vendor"));
        assertThat(sidesOf(id)).containsExactly("VENDOR");
        assertThatThrownBy(() -> ownership.createNode(id, StructureSide.PURCHASER, node(NodeType.INDIVIDUAL, "Bea Buyer")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("The purchaser can only be recorded on a deal closed as sold");

        assertThat(listed(TransactionType.SALE)).contains(deal.getPublicId());
        assertThat(listed(TransactionType.PURCHASE)).doesNotContain(deal.getPublicId());
    }

    /* ---------- helpers ---------- */

    private CreateDealRequest create(TransactionType type) {
        return new CreateDealRequest(
                branch, type, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                new PropertyInput("12 Queen St", null, null, null, null, null, null, null, null, null, null),
                new ClientInput("Jane Marsh", null, null, null), null, null, null);
    }

    /** Section 3 for a purchase: the pair, a face-to-face meeting, and no foreign exposure. */
    private static UpdateDealRequest answers(SourceOfFunds funds, ReasonForPurchase reason) {
        return new UpdateDealRequest(null, null, null, null, null, null, null,
                null, false, null, null, true, null,
                "NONE", null, null, null, null, null, null, funds, reason);
    }

    private static CreateNodeRequest node(NodeType type, String name) {
        return JSON.convertValue(Map.of("nodeType", type, "displayName", name), CreateNodeRequest.class);
    }

    private List<String> listed(TransactionType type) {
        return dealList.list(null, firm, branch, null, type, DealListQuery.Sort.CREATED_AT, PageRequests.of(0, 100))
                .items().stream().map(DealListItemDto::id).toList();
    }

    private List<String> sidesOf(Long dealId) {
        return jdbc.queryForList("SELECT side FROM ownership_structure WHERE deal_id = :d ORDER BY side",
                Map.of("d", dealId), String.class);
    }

    private String column(Long dealId, String column) {
        return jdbc.queryForObject("SELECT " + column + " FROM deal WHERE id = :d", Map.of("d", dealId), String.class);
    }

    private Long insert(String sql, Map<String, ?> params) {
        return jdbc.queryForObject(sql, params, Long.class);
    }
}
