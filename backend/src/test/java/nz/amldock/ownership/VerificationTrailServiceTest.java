package nz.amldock.ownership;

import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.ownership.dto.VerificationTrailEntryDto;
import nz.amldock.property.PropertyRepository;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** The verification trail: same identity, same firm, verified, and who may open each deal. */
@ExtendWith(MockitoExtension.class)
class VerificationTrailServiceTest {

    static final Long FIRM = 100L;
    static final Long OTHER_FIRM = 200L;

    @Mock OwnershipNodeRepository nodes;
    @Mock OwnershipStructureRepository structures;
    @Mock DealRepository deals;
    @Mock FirmBranchRepository branches;
    @Mock PropertyRepository properties;
    @Mock UserRepository users;
    @Mock DealLifecycleService lifecycle;

    VerificationTrailService service;
    final UUID identity = UUID.randomUUID();
    final List<OwnershipStructure> allStructures = new java.util.ArrayList<>();
    final List<FirmBranch> allBranches = new java.util.ArrayList<>();

    Deal here;
    Deal elsewhere;
    Deal otherFirm;
    OwnershipNode nodeHere;
    OwnershipNode nodeElsewhere;
    OwnershipNode nodeOtherFirm;

    @BeforeEach
    void setUp() {
        service = new VerificationTrailService(nodes, structures, deals, branches, properties, users, lifecycle);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserPrincipal(7L, "manager@firm.nz", "Manager", Role.SALES_MANAGER, FIRM, 10L, true),
                null, List.of()));

        branch(10L, FIRM, "Auckland");
        branch(11L, FIRM, "Wellington");
        branch(12L, OTHER_FIRM, "Elsewhere Ltd");

        here = deal(1L, 10L);
        elsewhere = deal(2L, 11L);
        otherFirm = deal(3L, 12L);

        nodeHere = node(101L, structure(20L, 1L), Instant.parse("2026-10-01T10:00:00Z"));
        nodeElsewhere = node(102L, structure(21L, 2L), Instant.parse("2026-09-01T10:00:00Z"));
        nodeOtherFirm = node(103L, structure(22L, 3L), Instant.parse("2026-08-01T10:00:00Z"));

        lenient().when(nodes.findById(101L)).thenReturn(Optional.of(nodeHere));
        lenient().when(nodes.findAllByIdentityKeyAndVerificationStatusIn(eq(identity), any()))
                .thenReturn(List.of(nodeOtherFirm, nodeElsewhere, nodeHere));
        lenient().when(structures.findAllById(any())).thenReturn(allStructures);
        lenient().when(deals.findAllById(any())).thenReturn(List.of(here, elsewhere, otherFirm));
        lenient().when(properties.findAllById(any())).thenReturn(List.of());
        lenient().when(users.findAllById(any())).thenReturn(List.of());
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listsEachDealInTheFirmNewestFirstAndMarksThisOne() {
        List<VerificationTrailEntryDto> trail = service.trail(1L, 101L);

        assertThat(trail).extracting(VerificationTrailEntryDto::dealId).containsExactly(1L, 2L);
        assertThat(trail.get(0).currentDeal()).isTrue();
        assertThat(trail.get(1).currentDeal()).isFalse();
        assertThat(trail.get(1).branchName()).isEqualTo("Wellington");
    }

    @Test
    void aDealTheViewerCannotReadIsListedButNotOpenable() {
        lenient().doThrow(new ForbiddenException("other branch"))
                .when(lifecycle).assertCanRead(eq(elsewhere), any(), any());

        List<VerificationTrailEntryDto> trail = service.trail(1L, 101L);

        assertThat(trail).extracting(VerificationTrailEntryDto::canOpen).containsExactly(true, false);
    }

    /* ---------- fixtures ---------- */

    private void branch(Long id, Long firmId, String name) {
        FirmBranch b = new FirmBranch();
        ReflectionTestUtils.setField(b, "id", id);
        b.setRealEstateFirmId(firmId);
        b.setName(name);
        lenient().when(branches.findById(id)).thenReturn(Optional.of(b));
        allBranches.add(b);
        lenient().when(branches.findAllById(any())).thenReturn(allBranches);
    }

    private Deal deal(Long id, Long branchId) {
        Deal d = new Deal();
        ReflectionTestUtils.setField(d, "id", id);
        d.setFirmBranchId(branchId);
        d.setReference("D-" + id);
        lenient().when(deals.findById(id)).thenReturn(Optional.of(d));
        return d;
    }

    private Long structure(Long id, Long dealId) {
        OwnershipStructure s = new OwnershipStructure();
        ReflectionTestUtils.setField(s, "id", id);
        s.setDealId(dealId);
        allStructures.add(s);
        lenient().when(structures.findById(id)).thenReturn(Optional.of(s));
        return id;
    }

    private OwnershipNode node(Long id, Long structureId, Instant verifiedAt) {
        OwnershipNode n = new OwnershipNode();
        ReflectionTestUtils.setField(n, "id", id);
        n.setOwnershipStructureId(structureId);
        n.setNodeType(NodeType.INDIVIDUAL);
        n.setDisplayName("Anna Eriksson");
        n.setIdentityKey(identity);
        n.setVerificationStatus(NodeVerificationStatus.VERIFIED);
        n.setVerifiedAt(verifiedAt);
        return n;
    }
}
