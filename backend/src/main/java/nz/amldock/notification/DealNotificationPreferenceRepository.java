package nz.amldock.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DealNotificationPreferenceRepository
        extends JpaRepository<DealNotificationPreference, Long> {

    List<DealNotificationPreference> findByAppUserId(Long appUserId);

    List<DealNotificationPreference> findByAppUserIdIn(Collection<Long> appUserIds);

    Optional<DealNotificationPreference> findByAppUserIdAndFirmBranchIdAndEventType(
            Long appUserId, Long firmBranchId, DealNotificationEvent eventType);

    /**
     * Everyone who could be told about an event on this branch, with their stored preference or
     * NULL where they have never set one.
     *
     * <p>The caller applies {@link NotificationDefaults} to the NULLs. The role-default matrix
     * lives in Java and is deliberately not transcribed here, where it would be a second thing to
     * keep right.
     *
     * <p><strong>This is the send-time twin of {@code DealLifecycleService.assertCanRead}</strong>
     * — see that method for the canonical statement of the rule, and keep the two in step. A
     * subscriber must never be mailed about a deal they could not open. The role list is also
     * mirrored in {@link NotificationEligibility} and in {@code frontend/src/auth/roles.js}.
     *
     * <p>Preferences are already branch-keyed, so the branch column has done most of the scoping
     * by the time this runs; the agents-hear-only-about-their-own-deals rule is the one piece that
     * cannot be, and is the last predicate below.
     *
     * <p>{@code b.is_active} and {@code f.is_active} matter: neither branch nor firm deactivation
     * cascades anywhere today, so without them a dormant branch would keep sending mail.
     */
    @Query(value = """
            SELECT u.id        AS userId,
                   u.email     AS email,
                   u.full_name AS fullName,
                   u.role      AS role,
                   p.enabled   AS enabled
              FROM app_user u
              JOIN firm_branch b      ON b.id = :branchId
              JOIN real_estate_firm f ON f.id = b.real_estate_firm_id
              LEFT JOIN deal_notification_preference p
                     ON p.app_user_id = u.id
                    AND p.firm_branch_id = b.id
                    AND p.event_type = :eventType
             WHERE u.is_active
               AND b.is_active
               AND f.is_active
               AND u.role IN ('AGENT','AGENT_PA','ADMIN','SALES_MANAGER',
                              'AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')
               AND (
                     (u.role IN ('ADMIN','SALES_MANAGER','AGENT','AGENT_PA')
                        AND u.firm_branch_id = b.id)
                  OR (u.role IN ('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')
                        AND u.real_estate_firm_id = f.id)
                   )
               AND (u.role NOT IN ('AGENT','AGENT_PA') OR u.id = :dealCreatorId)
               AND u.id <> :actorUserId
             ORDER BY u.id
            """, nativeQuery = true)
    List<RecipientCandidate> findRecipientCandidates(@Param("branchId") Long branchId,
                                                     @Param("eventType") String eventType,
                                                     @Param("dealCreatorId") Long dealCreatorId,
                                                     @Param("actorUserId") Long actorUserId);

    /** Projection for {@link #findRecipientCandidates}. {@code enabled} is null when unset. */
    interface RecipientCandidate {
        Long getUserId();
        String getEmail();
        String getFullName();
        String getRole();
        Boolean getEnabled();
    }
}
