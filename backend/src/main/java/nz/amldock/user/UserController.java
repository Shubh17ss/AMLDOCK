package nz.amldock.user;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.AuthService;
import nz.amldock.auth.dto.AuthResponse;
import nz.amldock.email.EmailChangeNotice;
import nz.amldock.user.dto.BulkCreateUsersRequest;
import nz.amldock.user.dto.ChangePasswordRequest;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.EmailChangeRequest;
import nz.amldock.user.dto.EmailChangeVerifyRequest;
import nz.amldock.user.dto.ResetPasswordRequest;
import nz.amldock.user.dto.UpdateProfileRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;
    private final UserProfileService profile;
    private final AuthService auth;
    private final AuditService audit;
    private final UserOnboarding onboarding;
    private final EmailChangeNotice emailChangeNotice;

    public UserController(UserService users, UserProfileService profile, AuthService auth,
                          AuditService audit, UserOnboarding onboarding,
                          EmailChangeNotice emailChangeNotice) {
        this.users = users;
        this.profile = profile;
        this.auth = auth;
        this.audit = audit;
        this.onboarding = onboarding;
        this.emailChangeNotice = emailChangeNotice;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER','AUDIT')")
    public List<UserDto> list(@AuthenticationPrincipal UserPrincipal principal,
                              @RequestParam(required = false) Long firmId,
                              @RequestParam(required = false) Long branchId) {
        return users.findVisible(principal, firmId, branchId).stream().map(UserDto::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER','AUDIT')")
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
        // Read before the update, because the service mutates the managed entity in place — after
        // the call these would both report the new values and every comparison below would be false.
        User existing = users.findById(id);
        Role before = existing.getRole();
        boolean wasActive = existing.isActive();
        String previousEmail = existing.getEmail();

        User u = users.update(principal, id, req);
        audit.record(AuditAction.USER_UPDATED, "User", u.getId(),
                "Updated user " + u.getEmail());
        if (req.role() != null && req.role() != before) {
            audit.record(AuditAction.ROLE_CHANGED, "User", u.getId(),
                    "Role changed from " + before + " to " + u.getRole());
        }
        if (u.isActive() != wasActive) {
            audit.record(u.isActive() ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
                    "User", u.getId(),
                    (u.isActive() ? "Activated " : "Deactivated ") + u.getEmail());
        }
        // An administrative email change skips the verification a self-service one goes through,
        // so it is named differently in the trail — the two are not the same act and should not
        // read as though they were. See UserProfileService for the verified path.
        if (!u.getEmail().equalsIgnoreCase(previousEmail)) {
            audit.record(AuditAction.USER_EMAIL_SET_BY_ADMIN, "User", u.getId(),
                    "Email changed from " + previousEmail + " to " + u.getEmail() + " without verification");
            emailChangeNotice.notifyPreviousAddress(previousEmail, u.getFullName(), u.getEmail());
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

    /* ---------- your own account ---------- */
    // No @PreAuthorize on any of these: the subject is always the caller, so there is no scope to
    // check and a role list here could only be wrong. Every authenticated role reaches them —
    // agents and admins included, who until now could not edit their own name at all because
    // PATCH /{id} is manager-only. AUDIT is the exception, stopped before it arrives by
    // AuditReadOnlyFilter, which refuses that role every non-GET in the product.

    /**
     * Changes your own name.
     *
     * <p>Returns the refreshed session rather than a {@code UserDto}, because the name is carried in
     * the access token's claims and shown from {@code /auth/me} — handing back the same shape the
     * client already holds its identity in saves it a second round trip to find out what it just did.
     */
    @PatchMapping("/me")
    public AuthResponse updateMyProfile(@AuthenticationPrincipal UserPrincipal principal,
                                        @Valid @RequestBody UpdateProfileRequest req,
                                        HttpServletResponse response) {
        User u = profile.updateOwnName(principal.id(), req.fullName());
        return auth.reissueSession(u, response);
    }

    /**
     * Asks to move to a new email address. Sends a code there and changes nothing yet.
     *
     * <p>204 whether or not the address is reachable — we have no way to know at this point, and
     * saying more would turn this into an oracle for which addresses exist elsewhere.
     */
    @PostMapping("/me/email-change")
    public ResponseEntity<Void> requestEmailChange(@AuthenticationPrincipal UserPrincipal principal,
                                                   @Valid @RequestBody EmailChangeRequest req) {
        profile.requestEmailChange(principal.id(), req.newEmail());
        return ResponseEntity.noContent().build();
    }

    /**
     * Confirms the code from the new address and completes the move.
     *
     * <p>The session is re-issued because the account's identity has just changed underneath the
     * token the caller is holding — see {@code AuthService.reissueSession}.
     */
    @PostMapping("/me/email-change/verify")
    public AuthResponse verifyEmailChange(@AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody EmailChangeVerifyRequest req,
                                          HttpServletResponse response) {
        User u = profile.verifyEmailChange(principal.id(), req.code());
        return auth.reissueSession(u, response);
    }
}
