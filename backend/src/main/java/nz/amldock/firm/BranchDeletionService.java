package nz.amldock.firm;

import nz.amldock.auth.TokenStateCache;
import nz.amldock.common.exception.ApiException;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.document.storage.StoredFileReaper;
import nz.amldock.user.FirmMembership;
import nz.amldock.user.FirmMembershipRepository;
import nz.amldock.user.MembershipService;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import nz.amldock.user.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Hard-deletes a branch and everything in it: deals with their documents, versions and people,
 * the branch's compliance, fund-transaction, suspicious-activity and training records, its
 * memberships, and the accounts of people who belonged nowhere else. The stored files go after
 * commit (StoredFileReaper). The audit log has no foreign key to any of it, so the trail of what
 * happened stays.
 *
 * <p>Allowed while the branch is active, or once a deactivated branch's retention hold has run
 * (RetentionPolicy). Refused, with the reason, when deleting would break a record outside the
 * branch: someone due to be deleted authored a deal, note, document or register entry elsewhere,
 * or a session elsewhere uses one of the branch's training providers. Individuals copied from this
 * branch into another are independent copies and are not a reason to refuse.
 *
 * <p>Plain SQL in dependency order rather than entity by entity: a branch can hold thousands of
 * rows, and the one place that says what a branch owns is easier to keep right than a cascade
 * spread across services.
 */
@Service
public class BranchDeletionService {

    /** Accounts deleted with the branch: members of it who belong to no other entity. */
    static final String DOOMED_USERS = """
            SELECT m.app_user_id FROM firm_membership m
             WHERE m.firm_branch_id = :b
               AND NOT EXISTS (SELECT 1 FROM firm_membership o
                                WHERE o.app_user_id = m.app_user_id AND o.id <> m.id)
            """;

    static final String BRANCH_DEALS = "SELECT id FROM deal WHERE firm_branch_id = :b";

    /** What a doomed account authored outside the branch. Any of these blocks the delete. */
    private static final List<Blocker> BLOCKERS = List.of(
            new Blocker("deals in other branches were created by people who would be deleted",
                    "SELECT count(*) FROM deal WHERE created_by_user_id IN (U) AND firm_branch_id <> :b"),
            new Blocker("notes on other branches' deals were written by people who would be deleted",
                    "SELECT count(*) FROM deal_note n JOIN deal d ON d.id = n.deal_id"
                            + " WHERE n.author_user_id IN (U) AND d.firm_branch_id <> :b"),
            new Blocker("status changes on other branches' deals were made by people who would be deleted",
                    "SELECT count(*) FROM deal_status_move s JOIN deal d ON d.id = s.deal_id"
                            + " WHERE s.actor_user_id IN (U) AND d.firm_branch_id <> :b"),
            new Blocker("sign-offs on other branches' deals were made by people who would be deleted",
                    "SELECT count(*) FROM deal_version v JOIN deal d ON d.id = v.deal_id"
                            + " WHERE (v.verified_by_user_id IN (U) OR v.reopened_by_user_id IN (U)"
                            + " OR v.assurance_by_user_id IN (U)) AND d.firm_branch_id <> :b"),
            new Blocker("documents outside this branch were uploaded by people who would be deleted",
                    "SELECT count(*) FROM document doc LEFT JOIN deal d ON d.id = doc.deal_id"
                            + " WHERE doc.uploaded_by_user_id IN (U) AND d.firm_branch_id IS DISTINCT FROM :b"),
            new Blocker("compliance documents outside this branch were uploaded by people who would be deleted",
                    "SELECT count(*) FROM compliance_document"
                            + " WHERE uploaded_by_user_id IN (U) AND firm_branch_id IS DISTINCT FROM :b"),
            new Blocker("fund transactions outside this branch were recorded by people who would be deleted",
                    "SELECT count(*) FROM international_fund_transaction"
                            + " WHERE created_by_user_id IN (U) AND firm_branch_id IS DISTINCT FROM :b"),
            new Blocker("suspicious activity reports outside this branch were recorded by people who would be deleted",
                    "SELECT count(*) FROM suspicious_activity"
                            + " WHERE created_by_user_id IN (U) AND firm_branch_id IS DISTINCT FROM :b"),
            new Blocker("training records outside this branch were created by people who would be deleted",
                    "SELECT (SELECT count(*) FROM training_provider WHERE created_by_user_id IN (U)"
                            + "        AND firm_branch_id IS DISTINCT FROM :b)"
                            + " + (SELECT count(*) FROM training_session WHERE created_by_user_id IN (U)"
                            + "        AND firm_branch_id IS DISTINCT FROM :b)"
                            + " + (SELECT count(*) FROM training_course WHERE created_by_user_id IN (U)"
                            + "        AND firm_branch_id IS DISTINCT FROM :b)"
                            + " + (SELECT count(*) FROM training_course_file f"
                            + "      JOIN training_course c ON c.id = f.training_course_id"
                            + "     WHERE f.uploaded_by_user_id IN (U) AND c.firm_branch_id IS DISTINCT FROM :b)"),
            new Blocker("training sessions outside this branch use this branch's training providers",
                    "SELECT count(*) FROM training_session s JOIN training_provider p ON p.id = s.training_provider_id"
                            + " WHERE p.firm_branch_id = :b AND s.firm_branch_id IS DISTINCT FROM :b"));

    private record Blocker(String reason, String countSql) {
        String sql() { return countSql.replace("(U)", "(" + DOOMED_USERS + ")"); }
    }

    /** What deleting the branch would remove, and whether it may be deleted now. */
    public record Preview(Long branchId, String branchName, long deals, long documents,
                          long usersDeleted, long usersKept, boolean eligible, Instant eligibleAt,
                          List<String> blockers) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final FirmService firmService;
    private final FirmMembershipRepository membershipRepo;
    private final MembershipService memberships;
    private final UserRepository users;
    private final UserService userService;
    private final TokenStateCache tokenStates;
    private final StoredFileReaper files;

    public BranchDeletionService(NamedParameterJdbcTemplate jdbc,
                                 FirmBranchRepository branches,
                                 RealEstateFirmRepository firms,
                                 FirmService firmService,
                                 FirmMembershipRepository membershipRepo,
                                 MembershipService memberships,
                                 UserRepository users,
                                 UserService userService,
                                 TokenStateCache tokenStates,
                                 StoredFileReaper files) {
        this.jdbc = jdbc;
        this.branches = branches;
        this.firms = firms;
        this.firmService = firmService;
        this.membershipRepo = membershipRepo;
        this.memberships = memberships;
        this.users = users;
        this.userService = userService;
        this.tokenStates = tokenStates;
        this.files = files;
    }

    @Transactional(readOnly = true)
    public Preview preview(Long branchId) {
        FirmBranch b = load(branchId);
        RealEstateFirm firm = firms.findById(b.getRealEstateFirmId())
                .orElseThrow(() -> new NotFoundException("Firm " + b.getRealEstateFirmId() + " not found"));
        return preview(b, firm, true);
    }

    /**
     * Deletes the branch. {@code confirmName} must be its name exactly, as typed by the person
     * confirming — the request says which branch they meant, not just which id the page held.
     * Returns what was deleted, for the audit entry.
     */
    @Transactional
    public Preview delete(Long branchId, String confirmName) {
        FirmBranch b = load(branchId);
        if (confirmName == null || !confirmName.trim().equals(b.getName())) {
            throw new BadRequestException("Type the branch name exactly to confirm deleting it");
        }
        RealEstateFirm firm = firms.findById(b.getRealEstateFirmId())
                .orElseThrow(() -> new NotFoundException("Firm " + b.getRealEstateFirmId() + " not found"));
        Preview p = preview(b, firm, true);
        if (!p.eligible()) {
            throw new ApiException(HttpStatus.CONFLICT, "Branch " + b.getName()
                    + " is in its retention period and can't be deleted until " + p.eligibleAt());
        }
        if (!p.blockers().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Branch " + b.getName()
                    + " can't be deleted: " + String.join("; ", p.blockers()));
        }
        purge(b.getId());
        return p;
    }

    /**
     * Removes the branch and everything in it, with no eligibility or confirmation check: the
     * caller has made both. Entity deletion runs this for each of the entity's branches.
     */
    @Transactional
    public void purge(Long branchId) {
        Map<String, Object> b = Map.of("b", branchId);

        // 1. Files, read while the rows still name them.
        List<String> keys = new ArrayList<>(files.keys(
                StoredFileReaper.DEAL_KEYS.formatted(BRANCH_DEALS), b));
        keys.addAll(files.keys("""
                SELECT s3_key FROM compliance_document WHERE firm_branch_id = :b
                UNION SELECT s3_key FROM international_fund_transaction WHERE firm_branch_id = :b
                UNION SELECT s3_key FROM suspicious_activity WHERE firm_branch_id = :b
                UNION SELECT f.s3_key FROM training_course_file f
                        JOIN training_course c ON c.id = f.training_course_id
                       WHERE c.firm_branch_id = :b
                """, b));

        // 2. Members who also belong to another entity keep their account; only this membership
        //    goes. Done through the entities, and flushed, before any SQL below runs.
        List<Long> doomed = jdbc.queryForList(DOOMED_USERS, b, Long.class);
        for (FirmMembership m : membershipRepo.findByFirmBranchIdOrderByUserIdAsc(branchId)) {
            if (doomed.contains(m.getUserId())) continue;
            User u = users.findByIdForUpdate(m.getUserId())
                    .orElseThrow(() -> new NotFoundException("User " + m.getUserId() + " not found"));
            membershipRepo.delete(m);
            membershipRepo.flush();
            if (branchId.equals(u.getFirmBranchId())) {
                membershipRepo.findByUserIdOrderByIdAsc(u.getId()).stream().findFirst()
                        .ifPresent(other -> memberships.makeHome(u, other));
            }
            memberships.syncAccount(u);
            userService.endSessions(u);
        }
        users.flush();

        // 3. The people on the branch's deals who are on no other deal. Their links cascade with
        //    the deals; the people themselves are entity-wide rows and would otherwise linger.
        List<Long> owners = jdbc.queryForList("""
                SELECT DISTINCT l.beneficial_owner_id FROM deal_beneficial_owner l
                  JOIN deal d ON d.id = l.deal_id
                 WHERE d.firm_branch_id = :b
                   AND NOT EXISTS (SELECT 1 FROM deal_beneficial_owner o JOIN deal d2 ON d2.id = o.deal_id
                                    WHERE o.beneficial_owner_id = l.beneficial_owner_id
                                      AND d2.firm_branch_id <> :b)
                """, b, Long.class);
        List<Long> propertyIds = jdbc.queryForList("SELECT property_id FROM deal WHERE firm_branch_id = :b", b, Long.class);
        List<Long> clientIds = jdbc.queryForList("SELECT client_id FROM deal WHERE firm_branch_id = :b", b, Long.class);

        // 4. Deals. Documents, structures, nodes, notes, versions, grants and the rest cascade.
        jdbc.update("DELETE FROM deal WHERE firm_branch_id = :b", b);
        deleteIn("beneficial_owner", owners);
        deleteIn("property", propertyIds);
        deleteIn("client", clientIds);

        // 5. The branch's registers. These name the branch ON DELETE SET NULL, so left alone they
        //    would quietly become entity-wide rows. Sessions before providers (RESTRICT).
        jdbc.update("DELETE FROM training_session WHERE firm_branch_id = :b", b);
        jdbc.update("DELETE FROM training_course WHERE firm_branch_id = :b", b);
        jdbc.update("DELETE FROM training_provider WHERE firm_branch_id = :b", b);
        jdbc.update("DELETE FROM compliance_document WHERE firm_branch_id = :b", b);
        jdbc.update("DELETE FROM international_fund_transaction WHERE firm_branch_id = :b", b);
        jdbc.update("DELETE FROM suspicious_activity WHERE firm_branch_id = :b", b);

        // 6. The accounts. Their own training records elsewhere go with them — assignments and
        //    attendance are about the person, not authored by them. Memberships, tokens and codes
        //    cascade.
        if (!doomed.isEmpty()) {
            Map<String, Object> u = Map.of("u", doomed);
            jdbc.update("DELETE FROM training_course_assignee WHERE user_id IN (:u)", u);
            jdbc.update("DELETE FROM training_session_attendee WHERE user_id IN (:u)", u);
            jdbc.update("DELETE FROM app_user WHERE id IN (:u)", u);
            doomed.forEach(tokenStates::evictAfterCommit);
        }

        // 7. The branch. Review dates, notification settings and the dashboard summary cascade.
        jdbc.update("DELETE FROM firm_branch WHERE id = :b", b);

        files.deleteAfterCommit(keys);
    }

    /* ---------- internals ---------- */

    private FirmBranch load(Long branchId) {
        FirmBranch b = branches.findById(branchId)
                .orElseThrow(() -> new NotFoundException("Branch " + branchId + " not found"));
        firmService.assertVisible(b.getRealEstateFirmId());
        return b;
    }

    /**
     * {@code checkOutside} looks for records outside the branch that deleting it would break.
     * Entity deletion turns it off and checks at the entity's edge instead, since every branch
     * is going.
     */
    Preview preview(FirmBranch b, RealEstateFirm firm, boolean checkOutside) {
        Map<String, Object> p = Map.of("b", b.getId());
        long deals = count("SELECT count(*) FROM deal WHERE firm_branch_id = :b", p);
        long documents = count("SELECT count(*) FROM document doc JOIN deal d ON d.id = doc.deal_id"
                + " WHERE d.firm_branch_id = :b AND doc.status <> 'DELETED'", p);
        long doomed = count("SELECT count(*) FROM (" + DOOMED_USERS + ") x", p);
        long members = count("SELECT count(*) FROM firm_membership WHERE firm_branch_id = :b", p);

        Instant eligibleAt = RetentionPolicy.deletionEligibleAt(firm.getCountry(), b.getDeactivatedAt());
        boolean eligible = RetentionPolicy.isDeletable(b.isActive(), b.getDeactivatedAt(),
                firm.getCountry(), Instant.now());

        List<String> blockers = new ArrayList<>();
        if (checkOutside) {
            for (Blocker blocker : BLOCKERS) {
                long n = count(blocker.sql(), p);
                if (n > 0) blockers.add(n + " " + blocker.reason());
            }
        }
        return new Preview(b.getId(), b.getName(), deals, documents, doomed, members - doomed,
                eligible, b.isActive() ? null : eligibleAt, blockers);
    }

    private long count(String sql, Map<String, Object> params) {
        Long n = jdbc.queryForObject(sql, params, Long.class);
        return n == null ? 0 : n;
    }

    private void deleteIn(String table, List<Long> ids) {
        if (ids.isEmpty()) return;
        jdbc.update("DELETE FROM " + table + " WHERE id IN (:ids)", Map.of("ids", ids));
    }
}
