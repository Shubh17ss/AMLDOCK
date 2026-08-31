package nz.amldock.notification;

import jakarta.validation.Valid;
import nz.amldock.notification.dto.NotificationPreferenceGridDto;
import nz.amldock.notification.dto.UpdateNotificationPreferencesRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Who gets emailed about deal activity.
 *
 * <p>Two surfaces over one store: every user manages their own on the Profile page, and officers
 * additionally manage anyone in their firm from Settings. A change made in either place is the same
 * row.
 *
 * <p><strong>Deliberately absent from {@code SecurityConfig}'s URL matchers.</strong> The {@code
 * /me} endpoints must be reachable by every authenticated user, including brokers, so a
 * section-wide matcher would lock people out of their own preferences. This follows the same
 * decision already recorded there for training sessions, and the per-method annotations below carry
 * the role rules instead.
 */
@RestController
@RequestMapping("/api/notification-preferences")
public class NotificationPreferenceController {

    /**
     * AUDIT is here to read the matrix but never appears on a write below. That is intent, not
     * enforcement: {@code AuditReadOnlyFilter} rejects every non-GET to /api/** for read-only roles
     * as a servlet filter, before any @PreAuthorize is evaluated.
     */
    private static final String READ_MATRIX_ROLES =
            "hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','AUDIT')";
    private static final String WRITE_MATRIX_ROLES =
            "hasAnyRole('ROOT','AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')";

    private final NotificationPreferenceService service;

    public NotificationPreferenceController(NotificationPreferenceService service) {
        this.service = service;
    }

    /**
     * The signed-in user's own toggles. A role that cannot receive notifications gets an empty
     * preference list rather than a 403, so the Profile page can say so plainly instead of showing
     * an error for a perfectly normal account.
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public NotificationPreferenceGridDto mine() {
        return service.forCurrentUser();
    }

    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public NotificationPreferenceGridDto updateMine(
            @Valid @RequestBody UpdateNotificationPreferencesRequest req) {
        return service.updateForCurrentUser(req);
    }

    /** Everyone in one branch, for the Settings matrix. */
    @GetMapping
    @PreAuthorize(READ_MATRIX_ROLES)
    public List<NotificationPreferenceGridDto> forBranch(@RequestParam Long branchId) {
        return service.forBranch(branchId);
    }

    @PutMapping("/user/{userId}")
    @PreAuthorize(WRITE_MATRIX_ROLES)
    public NotificationPreferenceGridDto updateForUser(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateNotificationPreferencesRequest req) {
        return service.updateForUser(userId, req);
    }
}
