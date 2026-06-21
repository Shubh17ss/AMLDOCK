package nz.amldock.user;

import nz.amldock.common.exception.BulkValidationException;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceBulkTest {

    @Mock UserRepository users;
    @Mock RealEstateFirmRepository firms;
    @Mock FirmBranchRepository branches;
    @Mock PasswordEncoder encoder;

    UserService service;

    // A sales manager in firm 1, branch 10 — creates agents in their own branch.
    final UserPrincipal salesManager =
            new UserPrincipal(99L, "sm@firm.com", null, Role.SALES_MANAGER, 1L, 10L, true);

    @BeforeEach
    void setUp() {
        service = new UserService(users, firms, branches, encoder);
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
}
