package nz.amldock.user;

import nz.amldock.auth.RefreshTokenRepository;
import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.BulkValidationException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.user.dto.BulkCreateUsersRequest;
import nz.amldock.user.dto.BulkCreateUsersRequest.Row;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceBulkTest {

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock PasswordEncoder encoder;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock TokenStateCache tokenStates;

    UserService service;
    MembershipFixture memberships;

    // A sales manager in firm 1, branch 10 — creates agents in their own branch.
    final UserPrincipal salesManager =
            new UserPrincipal(99L, "sm@firm.com", null, Role.SALES_MANAGER, 1L, 10L, true);

    @BeforeEach
    void setUp() {
        memberships = new MembershipFixture();
        service = new UserService(users, firms, branches, encoder, refreshTokens, tokenStates,
                memberships.repo, new MembershipService(memberships.repo, users, firms));
    }

    /** Rows are saved one by one now, through the single-create path; hand out ids as Postgres would. */
    private void stubSave() {
        java.util.concurrent.atomic.AtomicLong ids = new java.util.concurrent.atomic.AtomicLong(500);
        lenient().when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(u, "id", ids.incrementAndGet());
            return u;
        });
    }

    private void stubActiveFirmAndBranch() {
        RealEstateFirm firm = new RealEstateFirm();
        firm.setActive(true);
        lenient().when(firms.findById(1L)).thenReturn(Optional.of(firm));

        FirmBranch branch = new FirmBranch();
        branch.setRealEstateFirmId(1L);
        branch.setActive(true);
        lenient().when(branches.findById(10L)).thenReturn(Optional.of(branch));
    }

    @Test
    void importsValidRows() {
        stubActiveFirmAndBranch();
        stubSave();

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Alice", "alice@firm.com", "AGENT", ""),
                new Row("Bob", "bob@firm.com", "agent_pa", "ignored")
        ));

        List<UserService.Member> created = service.createBulk(salesManager, req);

        assertThat(created).hasSize(2);
        assertThat(created).allMatch(m -> m.branchId().equals(10L) && m.firmId().equals(1L));
        assertThat(created.get(0).user().getEmail()).isEqualTo("alice@firm.com");
        // Each one a member of the entity, not just an account.
        assertThat(memberships.all()).hasSize(2);
    }

    /**
     * Valid rows are written as they pass, so "saves nothing" is now the transaction's doing: the
     * exception rolls back every row the import wrote. What this pins is that it does throw.
     */
    @Test
    void rejectsWholeBatchWhenAnyRowFails() {
        stubActiveFirmAndBranch();
        stubSave();

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Alice", "alice@firm.com", "AGENT", ""),
                new Row("Cara", "cara@firm.com", "SENIOR_MANAGER", ""), // not creatable by a sales manager
                new Row("Dan", "not-an-email", "AGENT", "")             // invalid email
        ));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class)
                .satisfies(ex -> {
                    var errors = ((BulkValidationException) ex).getErrors();
                    assertThat(errors).hasSize(2);
                    assertThat(errors).extracting("field").containsExactly("row 2", "row 3");
                });
    }

    @Test
    void rejectsDuplicateEmailWithinFile() {
        stubActiveFirmAndBranch();
        stubSave();

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Alice", "dup@firm.com", "AGENT", ""),
                new Row("Alice 2", "DUP@firm.com", "AGENT", "")
        ));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class)
                .satisfies(ex -> assertThat(((BulkValidationException) ex).getErrors())
                        .extracting("field").containsExactly("row 2"));
    }

    /** An agent still active in another entity can't be imported here until they're switched off there. */
    @Test
    void rejectsAnAddressStillActiveInAnotherEntity() {
        stubActiveFirmAndBranch();
        User taken = new User();
        org.springframework.test.util.ReflectionTestUtils.setField(taken, "id", 7L);
        taken.setEmail("taken@firm.com");
        taken.setRole(Role.AGENT);
        taken.setRealEstateFirmId(2L);
        taken.setFirmBranchId(20L);
        taken.setActive(true);
        when(users.findByEmailIgnoreCase("taken@firm.com")).thenReturn(Optional.of(taken));
        memberships.addHome(taken);

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Taken", "taken@firm.com", "AGENT", "")
        ));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class)
                .satisfies(ex -> assertThat(((BulkValidationException) ex).getErrors())
                        .extracting("message").singleElement().asString()
                        .contains("Deactivate them there"));
        assertThat(memberships.in(7L, 1L)).isEmpty();
    }

    /* ---------- F1: size bounds and ReDoS ---------- */

    private static List<Row> agentRows(int n) {
        return IntStream.range(0, n)
                .mapToObj(i -> new Row("User " + i, "user" + i + "@firm.com", "AGENT", ""))
                .toList();
    }

    @Test
    void rejectsMoreThanFiftyRows_beforeReadingAny() {
        var req = new BulkCreateUsersRequest(1L, agentRows(UserService.MAX_BULK_ROWS + 1));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at most 50");
        verifyNoInteractions(users, firms, branches);
    }

    @Test
    void acceptsExactlyFiftyRows() {
        stubActiveFirmAndBranch();
        stubSave();

        var req = new BulkCreateUsersRequest(1L, agentRows(UserService.MAX_BULK_ROWS));

        assertThat(service.createBulk(salesManager, req)).hasSize(50);
    }

    @Test
    void rejectsRoleThatCannotCreateUsers_beforeReadingAnyRow() {
        var agent = new UserPrincipal(5L, "agent@firm.com", null, Role.AGENT, 1L, 10L, true);
        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("X", "a@" + ".".repeat(100_000) + "@", "AGENT", "")));

        assertThatThrownBy(() -> service.createBulk(agent, req))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(users, firms, branches);
    }

    @Test
    void rejectsOverlongEmail() {
        String local = "a".repeat(250);
        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Long", local + "@x.co", "AGENT", ""))); // 255 chars

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class)
                .satisfies(ex -> assertThat(((BulkValidationException) ex).getErrors())
                        .extracting("message").containsExactly("email is too long"));
    }

    @Test
    void dotRunEmailFailsFast() {
        // The old regex took ~n² steps on this shape; at 254 chars and with the linear pattern it is instant.
        String evil = "a@" + ".".repeat(240) + "@";
        var req = new BulkCreateUsersRequest(1L, List.of(new Row("Evil", evil, "AGENT", "")));

        assertTimeoutPreemptively(Duration.ofSeconds(1), () ->
                assertThatThrownBy(() -> service.createBulk(salesManager, req))
                        .isInstanceOf(BulkValidationException.class));
    }

    @Test
    void emailPatternStillAcceptsNormalAddresses() {
        stubActiveFirmAndBranch();
        stubSave();

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Jane", "jane.doe+aml@sub.example.co.nz", "AGENT", ""),
                new Row("Raj", "r_k-1@firm.com", "AGENT", "")));

        assertThat(service.createBulk(salesManager, req)).hasSize(2);
    }
}
