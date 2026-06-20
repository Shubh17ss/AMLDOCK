package nz.amldock.user;

import jakarta.validation.Valid;
import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.email.EmailMessage;
import nz.amldock.email.EmailService;
import nz.amldock.email.WelcomeEmail;
import nz.amldock.user.dto.ChangePasswordRequest;
import nz.amldock.user.dto.CreateUserRequest;
import nz.amldock.user.dto.ResetPasswordRequest;
import nz.amldock.user.dto.UpdateUserRequest;
import nz.amldock.user.dto.UserDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserService users;
    private final AuditService audit;
    private final EmailService email;
    private final WelcomeEmail welcomeEmail;

    public UserController(UserService users, AuditService audit,
                          EmailService email, WelcomeEmail welcomeEmail) {
        this.users = users;
        this.audit = audit;
        this.email = email;
        this.welcomeEmail = welcomeEmail;
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
        sendWelcomeEmail(u);
        return UserDto.from(u);
    }

    /**
     * Fire-and-forget: render the welcome email and hand it to the (async) EmailService.
     * Audits success/failure on the async chain so the per-user trail stays complete even
     * if SMTP is slow or down. Failures here must never propagate to the create response.
     */
    private void sendWelcomeEmail(User user) {
        try {
            EmailMessage message = welcomeEmail.render(user.getEmail(), user.getFullName(),
                    user.getRole());
            email.send(message).whenComplete((sent, ex) -> {
                try {
                    if (Boolean.TRUE.equals(sent)) {
                        audit.record(AuditAction.USER_WELCOME_EMAIL_SENT, "User", user.getId(),
                                "Welcome email sent to " + user.getEmail());
                    } else {
                        audit.record(AuditAction.USER_WELCOME_EMAIL_FAILED, "User", user.getId(),
                                "Welcome email could not be delivered to " + user.getEmail());
                    }
                } catch (Exception auditEx) {
                    log.warn("Could not write welcome-email audit for user {}: {}",
                            user.getEmail(), auditEx.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Failed to dispatch welcome email for user {}: {}", user.getEmail(), e.getMessage(), e);
            try {
                audit.record(AuditAction.USER_WELCOME_EMAIL_FAILED, "User", user.getId(),
                        "Welcome email dispatch failed: " + e.getMessage());
            } catch (Exception ignored) { /* never block create on audit */ }
        }
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','SALES_MANAGER')")
    public UserDto update(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        Role before = users.findById(id).getRole();
        User u = users.update(id, req);
        audit.record(AuditAction.USER_UPDATED, "User", u.getId(),
                "Updated user " + u.getEmail());
        if (req.role() != null && req.role() != before) {
            audit.record(AuditAction.ROLE_CHANGED, "User", u.getId(),
                    "Role changed from " + before + " to " + u.getRole());
        }
        return UserDto.from(u);
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
