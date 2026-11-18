package nz.amldock.user;

import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/**
 * A FirmMembershipRepository backed by a list, for the mock-based unit tests. The real
 * {@link MembershipService} runs on top of it, so those tests exercise the membership rule rather
 * than a stub of it.
 */
public final class MembershipFixture {

    private final List<FirmMembership> rows = new ArrayList<>();
    private final AtomicLong ids = new AtomicLong(1000);
    public final FirmMembershipRepository repo = mock(FirmMembershipRepository.class);

    public MembershipFixture() {
        lenient().when(repo.findByUserIdAndRealEstateFirmId(any(), any())).thenAnswer(inv ->
                rows.stream().filter(m -> m.getUserId().equals(inv.getArgument(0))
                        && m.getRealEstateFirmId().equals(inv.getArgument(1))).findFirst());
        lenient().when(repo.findByUserIdOrderByIdAsc(any())).thenAnswer(inv ->
                sorted(rows.stream().filter(m -> m.getUserId().equals(inv.getArgument(0))).toList()));
        lenient().when(repo.findByUserIdAndActiveTrueOrderByIdAsc(any())).thenAnswer(inv ->
                sorted(rows.stream().filter(m -> m.isActive()
                        && m.getUserId().equals(inv.getArgument(0))).toList()));
        lenient().when(repo.findByUserIdIn(any())).thenAnswer(inv -> {
            Collection<?> userIds = inv.getArgument(0);
            return rows.stream().filter(m -> userIds.contains(m.getUserId())).toList();
        });
        lenient().when(repo.findByRealEstateFirmIdOrderByUserIdAsc(any())).thenAnswer(inv ->
                byUser(rows.stream().filter(m -> m.getRealEstateFirmId().equals(inv.getArgument(0))).toList()));
        lenient().when(repo.findByFirmBranchIdOrderByUserIdAsc(any())).thenAnswer(inv ->
                byUser(rows.stream().filter(m -> Objects.equals(m.getFirmBranchId(), inv.getArgument(0))).toList()));
        lenient().when(repo.findById(anyLong())).thenAnswer(inv ->
                rows.stream().filter(m -> m.getId().equals(inv.getArgument(0))).findFirst());
        lenient().when(repo.save(any(FirmMembership.class))).thenAnswer(inv -> {
            FirmMembership m = inv.getArgument(0);
            if (m.getId() == null) {
                ReflectionTestUtils.setField(m, "id", ids.incrementAndGet());
                rows.add(m);
            }
            return m;
        });
        lenient().doAnswer(inv -> rows.remove((FirmMembership) inv.getArgument(0)))
                .when(repo).delete(any(FirmMembership.class));
    }

    /** A membership row, as if it had been saved. */
    public FirmMembership add(Long userId, Role role, Long firmId, Long branchId, boolean active) {
        FirmMembership m = new FirmMembership();
        m.setUserId(userId);
        m.setRealEstateFirmId(firmId);
        m.setFirmBranchId(branchId);
        m.setRole(role);
        m.setActive(active);
        return repo.save(m);
    }

    /** The account's own home membership, mirroring its row — what V68's backfill produces. */
    public FirmMembership addHome(User u) {
        return add(u.getId(), u.getRole(), u.getRealEstateFirmId(), u.getFirmBranchId(), u.isActive());
    }

    public Optional<FirmMembership> in(Long userId, Long firmId) {
        return rows.stream().filter(m -> m.getUserId().equals(userId)
                && m.getRealEstateFirmId().equals(firmId)).findFirst();
    }

    public List<FirmMembership> all() { return List.copyOf(rows); }

    private static List<FirmMembership> sorted(List<FirmMembership> in) {
        return in.stream().sorted(Comparator.comparing(FirmMembership::getId)).toList();
    }

    private static List<FirmMembership> byUser(List<FirmMembership> in) {
        return in.stream().sorted(Comparator.comparing(FirmMembership::getUserId)).toList();
    }
}
