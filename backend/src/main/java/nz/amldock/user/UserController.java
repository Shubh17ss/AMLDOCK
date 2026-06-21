package nz.amldock.user;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.user.dto.BulkCreateUsersRequest;
import nz.amldock.user.dto.ChangePasswordRequest;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.ResetPasswordRequest;
import nz.amldock.user.dto.UpdateUserRequest;
import nz.amldock.user.dto.UserDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;
    private final AuditService audit;
    private final UserOnboarding onboarding;

    public UserController(UserService users, AuditService audit, UserOnboarding onboarding) {
        this.users = users;
        this.audit = audit;
        this.onboarding = onboarding;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER')")
    public List<UserDto> list(@AuthenticationPrincipal UserPrincipal principal) {
        return users.findVisible(principal).stream().map(UserDto::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER')")
    public UserDto get(@PathVariable Long id) {
        return UserDto.from(users.findById(id));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public UserDto create(@AuthenticationPrincipal UserPrincipal principal,
                          @Valid @RequestBody CreateUserRequest req) {
        User u = users.create(principal, req);
        audit.record(AuditAction.USER_CREATED, "User", u.getId(),
                "Created user " + u.getEmail() + " with role " + u.getRole());
        onboarding.sendWelcome(u);
        return UserDto.from(u);
    }

    @PostMapping("/bulk")
    @PreAuthorize("isAuthenticated()")
    public List<UserDto> createBulk(@AuthenticationPrincipal UserPrincipal principal,
                                    @RequestBody BulkCreateUsersRequest req) {
        List<User> created = users.createBulk(principal, req);
        audit.record(AuditAction.USER_CREATED, "User", null,
                "Imported " + created.size() + " users");
        // Imported users get no welcome email by design.
        return created.stream().map(UserDto::from).toList();
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER')")
    public UserDto update(@AuthenticationPrincipal UserPrincipal principal,
                          @PathVariable Long id, @RequestBody UpdateUserRequest req) {
        Role before = users.findById(id).getRole();
        User u = users.update(principal, id, req);
        audit.record(AuditAction.USER_UPDATED, "User", u.getId(),
                "Updated user " + u.getEmail());
        if (req.role() != null && req.role() != before) {
            audit.record(AuditAction.ROLE_CHANGED, "User", u.getId(),
                    "Role changed from " + before + " to " + u.getRole());
        }
        return UserDto.from(u);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER')")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserPrincipal principal,
                                       @PathVariable Long id) {
        User u = users.findById(id);
        users.delete(principal, id);
        audit.record(AuditAction.USER_DELETED, "User", id, "Deleted user " + u.getEmail());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasRole('ROOT')")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest req) {
        users.resetPassword(id, req.newPassword());
        audit.record(AuditAction.USER_PASSWORD_RESET, "User", id, "Password reset by admin");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/change-password")
    public ResponseEntity<Void> changeMyPassword(@AuthenticationPrincipal UserPrincipal principal,
                                                 @Valid @RequestBody ChangePasswordRequest req) {
        users.changeOwnPassword(principal.id(), req.currentPassword(), req.newPassword());
        audit.record(AuditAction.USER_PASSWORD_CHANGED, "User", principal.id(), "Password changed");
        return ResponseEntity.noContent().build();
    }
}
