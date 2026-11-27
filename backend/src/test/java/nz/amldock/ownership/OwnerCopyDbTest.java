package nz.amldock.ownership;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.common.exception.ApiException;
import nz.amldock.deal.DealService;
import nz.amldock.deal.TransactionType;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.document.storage.FileStorageService;
import nz.amldock.email.EmailService;
import nz.amldock.firm.FirmPublicIds;
import nz.amldock.individual.IndividualDetailDto;
import nz.amldock.individual.IndividualQuery;
import nz.amldock.individual.IndividualService;
import nz.amldock.common.web.PageRequests;
import nz.amldock.ownership.dto.CreateEdgeRequest;
import nz.amldock.ownership.dto.CreateNodeRequest;
import nz.amldock.ownership.dto.NodeDto;
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

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Copying an owner, and everyone beneath it, from one of the firm's deals onto another, against
 * the real schema: the triggers that stamp each owner with its firm only exist there.
 *
 * <p>The source structure is a company owning an individual (60%, shareholder) and a trust (40%),
 * the trust having an individual trustee and its deed on file.
 */
@SpringBootTest(properties = "JWT_SECRET=test-only-secret-test-only-secret-0123456789")
@ActiveProfiles("dev")
class OwnerCopyDbTest {

    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    @Autowired DealService deals;
    @Autowired OwnershipService ownership;
    @Autowired IndividualService individuals;
    @Autowired NamedParameterJdbcTemplate jdbc;
    @MockBean FileStorageService storage;
    @MockBean EmailService email;

    final List<Long> firms = new java.util.ArrayList<>();
    Long firm;
    Long branch;
    Long officer;
    Long sourceDeal;
    Long targetDeal;
    NodeDto company;
    NodeDto jane;
    NodeDto trust;
    NodeDto tom;
    Long deed;

    @BeforeEach
    void setUp() {
        firm = newFirm();
        branch = newBranch(firm);
        officer = signInOfficer(firm);

        sourceDeal = newDeal();
        targetDeal = newDeal();

        company = ownership.createNode(sourceDeal, null, node(NodeType.PRIVATE_COMPANY, "Marsh Holdings Ltd",
                Map.of("companyNumber", "1234567", "jurisdictionCountry", "NZ")));
        jane = ownership.createNode(sourceDeal, null, node(NodeType.INDIVIDUAL, "Jane Marsh",
                Map.of("person", Map.of("email", "jane@example.invalid", "occupation", "Architect"))));
        trust = ownership.createNode(sourceDeal, null, node(NodeType.TRUST, "Marsh Family Trust",
                Map.of("trustName", "Marsh Family Trust")));
        tom = ownership.createNode(sourceDeal, null, node(NodeType.INDIVIDUAL, "Tom Marsh", Map.of()));
        ownership.createEdge(sourceDeal, new CreateEdgeRequest(company.id(), jane.id(), new BigDecimal("60"), EdgeRole.SHAREHOLDER));
        ownership.createEdge(sourceDeal, new CreateEdgeRequest(company.id(), trust.id(), new BigDecimal("40"), EdgeRole.SHAREHOLDER));
        ownership.createEdge(sourceDeal, new CreateEdgeRequest(trust.id(), tom.id(), null, EdgeRole.TRUSTEE));

        jdbc.update("UPDATE ownership_node SET verification_status = 'VERIFIED' WHERE id = :n", Map.of("n", jane.id()));
        deed = jdbc.queryForObject("INSERT INTO document (s3_key, original_filename, content_type, size_bytes,"
                + " document_type, uploaded_by_user_id, deal_id, ownership_node_id, status)"
                + " VALUES ('deals/x/deed.pdf', 'deed.pdf', 'application/pdf', 100, 'OTHER', :u, :d, :n, 'ACTIVE')"
                + " RETURNING id", Map.of("u", officer, "d", sourceDeal, "n", trust.id()), Long.class);
        jdbc.update("UPDATE ownership_node SET trust_deed_document_id = :doc WHERE id = :n",
                Map.of("doc", deed, "n", trust.id()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        for (Long f : firms) {
            Map<String, Object> p = Map.of("f", f);
            String dealsOfFirm = "SELECT d.id FROM deal d JOIN firm_branch b ON b.id = d.firm_branch_id"
                    + " WHERE b.real_estate_firm_id = :f";
            jdbc.update("UPDATE ownership_node SET trust_deed_document_id = NULL WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM document WHERE deal_id IN (" + dealsOfFirm + ")", p);
            jdbc.update("DELETE FROM ownership_edge WHERE parent_node_id IN"
                    + " (SELECT id FROM ownership_node WHERE real_estate_firm_id = :f)", p);
            jdbc.update("DELETE FROM ownership_node WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM ownership_structure WHERE deal_id IN (" + dealsOfFirm + ")", p);
            List<Long> props = jdbc.queryForList("SELECT property_id FROM deal WHERE id IN (" + dealsOfFirm + ")", p, Long.class);
            List<Long> clients = jdbc.queryForList("SELECT client_id FROM deal WHERE id IN (" + dealsOfFirm + ")", p, Long.class);
            jdbc.update("DELETE FROM deal WHERE id IN (" + dealsOfFirm + ")", p);
            if (!props.isEmpty()) jdbc.update("DELETE FROM property WHERE id IN (:ids)", Map.of("ids", props));
            if (!clients.isEmpty()) jdbc.update("DELETE FROM client WHERE id IN (:ids)", Map.of("ids", clients));
            jdbc.update("DELETE FROM beneficial_owner WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM firm_membership WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM app_user WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", p);
            jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", p);
        }
    }

    @Test
    void anEntityIsCopiedWithEveryoneBeneathItAndHowTheyHoldOneAnother() {
        OwnershipService.CopiedOwner copied = ownership.copyOwner(targetDeal, null, company.id());

        assertThat(copied.ownersBeneath()).isEqualTo(3);
        assertThat(copied.node().displayName()).isEqualTo("Marsh Holdings Ltd");
        assertThat(copied.node().id()).isNotEqualTo(company.id());

        List<Map<String, Object>> copies = nodesOn(targetDeal);
        assertThat(copies).extracting(r -> r.get("display_name"))
                .containsExactlyInAnyOrder("Marsh Holdings Ltd", "Jane Marsh", "Marsh Family Trust", "Tom Marsh");
        Map<String, Map<String, Object>> byName = new HashMap<>();
        copies.forEach(r -> byName.put((String) r.get("display_name"), r));

        // The same company to the firm: each copy carries its source's identity.
        assertThat(byName.get("Marsh Holdings Ltd").get("identity_key")).isEqualTo(identityOf(company.id()));
        assertThat(byName.get("Jane Marsh").get("identity_key")).isEqualTo(identityOf(jane.id()));
        assertThat(byName.get("Marsh Holdings Ltd").get("company_number")).isEqualTo("1234567");
        assertThat(byName.get("Jane Marsh").get("verification_status")).isEqualTo("VERIFIED");

        // How they hold one another: the same shares and roles, between the copies.
        List<Map<String, Object>> edges = jdbc.queryForList(
                "SELECT p.display_name AS parent, c.display_name AS child, e.percentage, e.role"
                        + " FROM ownership_edge e JOIN ownership_node p ON p.id = e.parent_node_id"
                        + " JOIN ownership_node c ON c.id = e.child_node_id"
                        + " JOIN ownership_structure s ON s.id = p.ownership_structure_id WHERE s.deal_id = :d",
                Map.of("d", targetDeal));
        assertThat(edges).hasSize(3);
        assertThat(edges).anySatisfy(e -> {
            assertThat(e.get("parent")).isEqualTo("Marsh Holdings Ltd");
            assertThat(e.get("child")).isEqualTo("Jane Marsh");
            assertThat((BigDecimal) e.get("percentage")).isEqualByComparingTo("60");
            assertThat(e.get("role")).isEqualTo("SHAREHOLDER");
        });
        assertThat(edges).anySatisfy(e -> {
            assertThat(e.get("parent")).isEqualTo("Marsh Family Trust");
            assertThat(e.get("child")).isEqualTo("Tom Marsh");
            assertThat(e.get("role")).isEqualTo("TRUSTEE");
        });
    }

    @Test
    void individualsGetTheirOwnPersonRecordWithTheSameDetails() {
        ownership.copyOwner(targetDeal, null, company.id());

        Map<String, Object> copy = jdbc.queryForMap("SELECT n.beneficial_owner_id, bo.email, bo.occupation"
                + " FROM ownership_node n JOIN ownership_structure s ON s.id = n.ownership_structure_id"
                + " JOIN beneficial_owner bo ON bo.id = n.beneficial_owner_id"
                + " WHERE s.deal_id = :d AND n.display_name = 'Jane Marsh'", Map.of("d", targetDeal));
        Long sourcePerson = jdbc.queryForObject("SELECT beneficial_owner_id FROM ownership_node WHERE id = :n",
                Map.of("n", jane.id()), Long.class);
        assertThat(copy.get("beneficial_owner_id")).isNotEqualTo(sourcePerson);
        assertThat(copy.get("email")).isEqualTo("jane@example.invalid");
        assertThat(copy.get("occupation")).isEqualTo("Architect");
    }

    @Test
    void theTrustDeedPointsAtItsOwnCopyOfTheDocument() {
        ownership.copyOwner(targetDeal, null, company.id());

        Map<String, Object> copiedTrust = jdbc.queryForMap("SELECT n.id, n.trust_deed_document_id"
                + " FROM ownership_node n JOIN ownership_structure s ON s.id = n.ownership_structure_id"
                + " WHERE s.deal_id = :d AND n.node_type = 'TRUST'", Map.of("d", targetDeal));
        Long copiedDeed = (Long) copiedTrust.get("trust_deed_document_id");
        assertThat(copiedDeed).isNotNull().isNotEqualTo(deed);
        Map<String, Object> doc = jdbc.queryForMap("SELECT deal_id, ownership_node_id, original_filename FROM document"
                + " WHERE id = :id", Map.of("id", copiedDeed));
        assertThat(doc.get("deal_id")).isEqualTo(targetDeal);
        assertThat(doc.get("ownership_node_id")).isEqualTo(copiedTrust.get("id"));
        assertThat(doc.get("original_filename")).isEqualTo("deed.pdf");
    }

    @Test
    void anotherFirmsOwnerCannotBeCopied() {
        Long otherFirm = newFirm();
        newBranch(otherFirm);
        signInOfficer(otherFirm);
        Long theirDeal = newDeal(otherFirm);
        NodeDto theirs = ownership.createNode(theirDeal, null, node(NodeType.TRUST, "Their Trust", Map.of()));

        signIn(officer, firm);
        assertThatThrownBy(() -> ownership.copyOwner(targetDeal, null, theirs.id()))
                .isInstanceOf(ApiException.class);
        assertThat(nodesOn(targetDeal)).isEmpty();
    }

    @Test
    void thePickerFindsOwnersOfOneTypeAndListsWhoIsBeneathThem() {
        var trusts = individuals.list(new IndividualQuery.Filter(firm, null, false, "Marsh", null, null, NodeType.TRUST),
                PageRequests.of(0, 25));
        assertThat(trusts.items()).extracting(r -> r.displayName()).containsExactly("Marsh Family Trust");

        IndividualDetailDto detail = individuals.detail(company.id());
        assertThat(detail.nodeType()).isEqualTo(NodeType.PRIVATE_COMPANY);
        assertThat(detail.entity().companyNumber()).isEqualTo("1234567");
        assertThat(detail.beneath()).extracting(OwnershipSubtree.Line::displayName)
                .containsExactly("Jane Marsh", "Marsh Family Trust", "Tom Marsh");
        assertThat(detail.beneath()).extracting(OwnershipSubtree.Line::depth).containsExactly(1, 1, 2);
        assertThat(detail.documentsBeneath()).isEqualTo(1);    // the trust deed
    }

    /* ---------- helpers ---------- */

    private List<Map<String, Object>> nodesOn(Long dealId) {
        return jdbc.queryForList("SELECT n.* FROM ownership_node n"
                + " JOIN ownership_structure s ON s.id = n.ownership_structure_id WHERE s.deal_id = :d",
                Map.of("d", dealId));
    }

    private Object identityOf(Long nodeId) {
        return jdbc.queryForObject("SELECT identity_key FROM ownership_node WHERE id = :n", Map.of("n", nodeId), Object.class);
    }

    private Long newFirm() {
        Long id = jdbc.queryForObject("INSERT INTO real_estate_firm (name, country, public_id) VALUES (:n, 'NZ', :p) RETURNING id",
                Map.of("n", "Owner copy " + UUID.randomUUID(), "p", FirmPublicIds.newId()), Long.class);
        firms.add(id);
        return id;
    }

    private Long newBranch(Long firmId) {
        return jdbc.queryForObject("INSERT INTO firm_branch (real_estate_firm_id, name, public_id) VALUES (:f, 'Ponsonby', :p) RETURNING id",
                Map.of("f", firmId, "p", FirmPublicIds.newId()), Long.class);
    }

    private final Map<Long, Long> officerOf = new HashMap<>();

    private Long signInOfficer(Long firmId) {
        String email = "owner-copy-" + UUID.randomUUID() + "@test.invalid";
        Long id = jdbc.queryForObject("INSERT INTO app_user (email, full_name, role, real_estate_firm_id)"
                + " VALUES (:e, 'Owner copy', 'AML_COMPLIANCE_OFFICER', :f) RETURNING id",
                Map.of("e", email, "f", firmId), Long.class);
        jdbc.update("INSERT INTO firm_membership (app_user_id, real_estate_firm_id, role, is_active)"
                + " VALUES (:u, :f, 'AML_COMPLIANCE_OFFICER', true)", Map.of("u", id, "f", firmId));
        officerOf.put(firmId, id);
        signIn(id, firmId);
        return id;
    }

    private void signIn(Long userId, Long firmId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(userId, "officer@test.invalid", null, Role.AML_COMPLIANCE_OFFICER, firmId, null, true),
                null, List.of()));
    }

    private Long newDeal() {
        return newDeal(firm);
    }

    /** A deal on the firm's first branch, moved into review so its structure can be written. */
    private Long newDeal(Long firmId) {
        Long branchId = jdbc.queryForObject("SELECT id FROM firm_branch WHERE real_estate_firm_id = :f LIMIT 1",
                Map.of("f", firmId), Long.class);
        Long id = deals.create(new CreateDealRequest(
                branchId, TransactionType.SALE, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                new PropertyInput("12 Queen St", null, null, null, null, null, null, null, null, null, null),
                new ClientInput("Jane Marsh", null, null, null), null, null, null)).getId();
        jdbc.update("UPDATE deal SET status = 'REVIEW' WHERE id = :d", Map.of("d", id));
        return id;
    }

    private static CreateNodeRequest node(NodeType type, String name, Map<String, Object> extra) {
        Map<String, Object> body = new HashMap<>(extra);
        body.put("nodeType", type);
        body.put("displayName", name);
        return JSON.convertValue(body, CreateNodeRequest.class);
    }
}
