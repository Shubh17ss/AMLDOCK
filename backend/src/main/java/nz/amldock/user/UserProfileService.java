package nz.amldock.user;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.auth.otp.OtpCode;
import nz.amldock.auth.otp.OtpPurpose;
import nz.amldock.auth.otp.OtpService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.email.EmailChangeNotice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a user may change about their own account.
 *
 * <p>Separate from {@link UserService}, which is about managing <em>other</em> people: everything
 * there begins with {@code assertCanManage} and answers "may this actor act on that user". Nothing
 * here needs to ask — the subject is always the caller. Keeping them apart means the self-service
 * paths cannot accidentally inherit a manager's reach, and the manager paths cannot accidentally
 * skip a check by being called with the actor's own id.
 *
 * <p>The asymmetry between the two things a user can change is the point of this class. A name is
 * a label: it is theirs to assert and nothing depends on it. An email is the sign-in credential —
 * with passwordless login the address <em>is</em> the account — so changing it takes proof that the
 * new address reaches the person asking.
 */
@Service
public class UserProfileService {

    private final UserRepository users;
    private final OtpService otp;
    private final EmailChangeNotice notice;
    private final AuditService audit;

    public UserProfileService(UserRepository users, OtpService otp,
                              EmailChangeNotice notice, AuditService audit) {
        this.users = users;
        this.otp = otp;
        this.notice = notice;
        this.audit = audit;
    }

    /** Changes the caller's own display name. */
    @Transactional
    public User updateOwnName(Long userId, String fullName) {
        User u = mustFind(userId);
        // Trimmed, unlike the manager path, which stores whatever it is handed. A trailing space is
        // invisible in every screen that renders this and confusing in every list that sorts by it.
        u.setFullName(fullName.trim());
        audit.record(AuditAction.USER_UPDATED, "User", u.getId(), "Updated own profile");
        return u;
    }

    /**
     * Starts an email change: sends a code to the address being claimed.
     *
     * <p>Nothing on the account moves here. The user's current address still signs in, and will go
     * on doing so unless the code comes back — which is what makes an unwanted request harmless and
     * lets the confirmation email honestly say "ignore this and nothing happens".
     */
    @Transactional
    public void requestEmailChange(Long userId, String rawNewEmail) {
        User u = mustFind(userId);
        String newEmail = normalise(rawNewEmail);

        if (newEmail.equalsIgnoreCase(u.getEmail())) {
            throw new BadRequestException("That is already your email address");
        }
        assertAvailable(newEmail, u.getId());

        otp.issueTo(u, OtpPurpose.EMAIL_CHANGE, newEmail);
        // The address is recorded so the trail shows what was attempted even if it is never
        // confirmed — a string of requests to addresses nobody owns is itself worth seeing.
        audit.record(AuditAction.USER_EMAIL_CHANGE_REQUESTED, "User", u.getId(),
                "Requested email change to " + newEmail);
    }

    /**
     * Finishes an email change.
     *
     * <p>The new address comes from the <em>code</em>, never from the request. That is the single
     * thing holding this flow up: a code proves only that somebody can read some inbox, and it is
     * the binding to the address it was sent to that turns it into proof about a particular one.
     * Take the address from the caller instead and a code earned on an inbox you own would let you
     * move the account to any address you like.
     */
    @Transactional
    public User verifyEmailChange(Long userId, String code) {
        User u = mustFind(userId);

        OtpCode consumed = otp.verify(u, code, OtpPurpose.EMAIL_CHANGE);
        String newEmail = consumed.getTargetEmail();
        if (newEmail == null || newEmail.isBlank()) {
            // Only reachable if a code were issued for this purpose without a destination, which
            // issueTo does not do. Stated rather than assumed: the alternative is a null sailing
            // into setEmail and taking the account's login with it.
            throw new BadRequestException("That code isn't tied to an email change — start again");
        }

        // Checked again, not just at request time. The window is the code's full ten minutes, and
        // somebody else can claim the address inside it. Without this the collision surfaces as a
        // unique-index violation, which GlobalExceptionHandler has no arm for and would return as
        // a 500 — after the OTP had already been consumed, leaving the user with no way forward.
        assertAvailable(newEmail, u.getId());

        String previousEmail = u.getEmail();
        u.setEmail(newEmail);

        audit.record(AuditAction.USER_EMAIL_CHANGED, "User", u.getId(),
                "Email changed from " + previousEmail + " to " + newEmail + " (verified)");
        notice.notifyPreviousAddress(previousEmail, u.getFullName(), newEmail);
        return u;
    }

    /* ---------- helpers ---------- */

    private void assertAvailable(String email, Long selfId) {
        if (users.existsByEmailIgnoreCaseAndIdNot(email, selfId)) {
            throw new BadRequestException("That email address is already in use");
        }
    }

    /** Lower-cased to match how every other write path stores an address, and how lookups compare. */
    private static String normalise(String email) {
        return email.trim().toLowerCase();
    }

    private User mustFind(Long userId) {
        return users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User " + userId + " not found"));
    }
}
