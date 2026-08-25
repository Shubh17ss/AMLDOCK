package nz.amldock.deal;

import nz.amldock.beneficialowner.BeneficialOwnerService;
import nz.amldock.client.ClientRepository;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.dto.CreateDealRequest;
import nz.amldock.dealnote.DealNoteRepository;
import nz.amldock.dealnote.DealNoteService;
import nz.amldock.document.DocumentRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.PropertyRepository;
import nz.amldock.property.PropertyType;
import nz.amldock.property.dto.PropertyInput;
import nz.amldock.user.Role;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * Who may open a deal, and on whose branch.
 *
 * <p>Two shapes of creator, and the difference between them is the whole subject here.
 * Branch-level staff are assigned to exactly one branch, so the server derives it and refuses any
 * other. Firm-level staff — a compliance officer, a senior manager — have no branch of their own,
 * so they must name one and it must belong to their own reporting entity. Getting that second rule
 * wrong is how a compliance officer at one firm files a deal against a rival firm's branch.
 */
@ExtendWith(MockitoExtension.class)
class DealCreateAuthorizationTest {

    @Mock DealRepository deals;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock FirmBranchRepository branches;
    @Mock RealEstateFirmRepository firms;
    @Mock UserRepository users;
    @Mock DealNoteRepository dealNotes;
    @Mock DocumentRepository documents;
    @Mock BeneficialOwnerService beneficialOwners;
    @Mock nz.amldock.ownership.OwnershipStructureRepository structures;
    @Mock nz.amldock.ownership.OwnershipNodeRepository nodes;
    @Mock nz.amldock.audit.AuditService audit;

    DealService service;

    /** Branch 10 belongs to firm 1; branch 20 belongs to firm 2. */
    private static final Long OWN_BRANCH = 10L;
    private static final Long OTHER_FIRM_BRANCH = 20L;

    @BeforeEach
    void setUp() {
        service = new DealService(deals, properties, clients, branches, firms, users,
                new DealLifecycleService(), new DealNoteService(dealNotes, documents, users),
                beneficialOwners, new DealRiskService(deals, structures, nodes, audit));

        lenient().when(branches.findById(OWN_BRANCH)).thenReturn(Optional.of(branch(OWN_BRANCH, 1L)));
        lenient().when(branches.findById(OTHER_FIRM_BRANCH))
                .thenReturn(Optional.of(branch(OTHER_FIRM_BRANCH, 2L)));

        RealEstateFirm firm = new RealEstateFirm();
        firm.setCountry("NZ");
        lenient().when(firms.findById(any())).thenReturn(Optional.of(firm));
        lenient().when(properties.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(clients.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(deals.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ---------- branch-level creators: the branch is theirs, and not negotiable ---------- */

    @Test
    void aSalesManagerCreatesOnTheirOwnBranch() {
        signIn(Role.SALES_MANAGER, 1L, OWN_BRANCH);

        Deal d = service.create(request(null));

        assertThat(d.getFirmBranchId()).isEqualTo(OWN_BRANCH);
    }

    @Test
    void aBranchLevelCreatorMayNotNameADifferentBranch() {
        signIn(Role.AGENT, 1L, OWN_BRANCH);

        assertThatThrownBy(() -> service.create(request(OTHER_FIRM_BRANCH)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("assigned branch");
    }

    /* ---------- firm-level creators: they must name a branch, and it must be theirs ---------- */

    @Test
    void aComplianceOfficerCreatesOnANamedBranchOfTheirOwnFirm() {
        signIn(Role.AML_COMPLIANCE_OFFICER, 1L, null);

        Deal d = service.create(request(OWN_BRANCH));

        assertThat(d.getFirmBranchId()).isEqualTo(OWN_BRANCH);
    }

    @Test
    void aSeniorManagerCreatesOnANamedBranchOfTheirOwnFirm() {
        signIn(Role.SENIOR_MANAGER, 1L, null);

        Deal d = service.create(request(OWN_BRANCH));

        assertThat(d.getFirmBranchId()).isEqualTo(OWN_BRANCH);
    }

    @Test
    void aFirmLevelCreatorWithNoBranchNamedIsAskedForOne() {
        signIn(Role.AML_COMPLIANCE_OFFICER, 1L, null);

        // There is nothing to fall back to. Before this, the same path reached a null branch id
        // and failed with a message about being unassigned, which is not the reader's problem.
        assertThatThrownBy(() -> service.create(request(null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Choose the branch");
    }

    @Test
    void aFirmLevelCreatorMayNotReachAnotherFirmsBranch() {
        signIn(Role.AML_COMPLIANCE_OFFICER, 1L, null);

        assertThatThrownBy(() -> service.create(request(OTHER_FIRM_BRANCH)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("your own firm");
    }

    /* ---------- roles that may not create at all ---------- */

    @Test
    void anAuditorMayNotCreateADeal() {
        signIn(Role.AUDIT, 1L, null);

        assertThatThrownBy(() -> service.create(request(OWN_BRANCH)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("may not create deals");
    }

    @Test
    void rootMayNotCreateADeal() {
        // ROOT has no reporting entity, so there is no firm for the deal to belong to.
        signIn(Role.ROOT, null, null);

        assertThatThrownBy(() -> service.create(request(OWN_BRANCH)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("may not create deals");
    }

    /* ---------- helpers ---------- */

    private void signIn(Role role, Long firmId, Long branchId) {
        UserPrincipal actor =
                new UserPrincipal(7L, role + "@firm.com", null, role, firmId, branchId, true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));
    }

    private static FirmBranch branch(Long id, Long firmId) {
        FirmBranch b = new FirmBranch();
        b.setRealEstateFirmId(firmId);
        b.setActive(true);
        setId(b, id);
        return b;
    }

    private CreateDealRequest request(Long firmBranchId) {
        return new CreateDealRequest(
                firmBranchId, TransactionType.SALE, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null,
                new PropertyInput("12 Queen St", null, null, null, null, null, null, null,
                        null, PropertyType.RESIDENTIAL, "RETIREMENT"),
                new ClientInput("Jane Marsh", null, null, null));
    }

    private static void setId(Object entity, Long id) {
        try {
            var f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
