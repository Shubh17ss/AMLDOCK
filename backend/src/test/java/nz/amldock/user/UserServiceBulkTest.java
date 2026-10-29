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

    // A sales manager in firm 1, branch 10 — creates agents in their own branch.
    final UserPrincipal salesManager =
            new UserPrincipal(99L, "sm@firm.com", null, Role.SALES_MANAGER, 1L, 10L, true);

    @BeforeEach
    void setUp() {
        service = new UserService(users, firms, branches, encoder, refreshTokens, tokenStates);
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
        when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(users.saveAll(any())).thenAnswer(inv -> {
            List<User> arg = inv.getArgument(0);
            return arg;
        });

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Alice", "alice@firm.com", "AGENT", ""),
                new Row("Bob", "bob@firm.com", "agent_pa", "ignored")
        ));

        List<User> created = service.createBulk(salesManager, req);

        assertThat(created).hasSize(2);
        assertThat(created).allMatch(u -> u.getFirmBranchId().equals(10L) && u.getRealEstateFirmId().equals(1L));
        assertThat(created.get(0).getEmail()).isEqualTo("alice@firm.com");
    }

    @Test
    void rejectsWholeBatchWhenAnyRowFails_andSavesNothing() {
        stubActiveFirmAndBranch();
        lenient().when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);

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

        verify(users, never()).saveAll(any());
    }

    @Test
    void rejectsDuplicateEmailWithinFile() {
        stubActiveFirmAndBranch();
        lenient().when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Alice", "dup@firm.com", "AGENT", ""),
                new Row("Alice 2", "DUP@firm.com", "AGENT", "")
        ));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class)
                .satisfies(ex -> assertThat(((BulkValidationException) ex).getErrors())
                        .extracting("field").containsExactly("row 2"));

        verify(users, never()).saveAll(any());
    }

    @Test
    void rejectsEmailAlreadyInDatabase() {
        stubActiveFirmAndBranch();
        when(users.existsByEmailIgnoreCase("taken@firm.com")).thenReturn(true);

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Taken", "taken@firm.com", "AGENT", "")
        ));

        assertThatThrownBy(() -> service.createBulk(salesManager, req))
                .isInstanceOf(BulkValidationException.class);
        verify(users, never()).saveAll(any());
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
        when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(users.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

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
        when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(users.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new BulkCreateUsersRequest(1L, List.of(
                new Row("Jane", "jane.doe+aml@sub.example.co.nz", "AGENT", ""),
                new Row("Raj", "r_k-1@firm.com", "AGENT", "")));

        assertThat(service.createBulk(salesManager, req)).hasSize(2);
    }
}
