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
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Hard-deletes a reporting entity: every branch and everything in it (as BranchDeletionService
 * does for one), the entity's own registers, people and queries, and the accounts of everyone who
 * belonged to no other entity. A compliance officer or senior manager who also serves another
 * entity keeps their account there.
 *
 * <p>Done as one entity-wide sweep rather than branch by branch: people move between an entity's
 * branches, so an agent deleted with one branch can be the author of a deal in the next, and
 * deleting all the deals first is the only order that never trips over that.
 *
 * <p>Allowed while the entity is active or once its retention hold has run — and only if no branch
 * it holds is still within a hold of its own (one closed by hand before the entity was). Refused
 * when someone who would be deleted authored something in another entity.
 */
@Service
public class FirmDeletionService {

    static final String FIRM_BRANCHES = "SELECT id FROM firm_branch WHERE real_estate_firm_id = :f";
    static final String FIRM_DEALS = "SELECT id FROM deal WHERE firm_branch_id IN (" + FIRM_BRANCHES + ")";

    /** Accounts deleted with the entity: in it (or homed in it) and in no other entity. */
    static final String DOOMED_USERS = """
            SELECT u.id FROM app_user u
             WHERE (u.real_estate_firm_id = :f
                    OR EXISTS (SELECT 1 FROM firm_membership m
                                WHERE m.app_user_id = u.id AND m.real_estate_firm_id = :f))
               AND NOT EXISTS (SELECT 1 FROM firm_membership o
                                WHERE o.app_user_id = u.id AND o.real_estate_firm_id <> :f)
            """;

    private static final String OUTSIDE_DEAL = "d.firm_branch_id NOT IN (" + FIRM_BRANCHES + ")";

    private static final List<Blocker> BLOCKERS = List.of(
            new Blocker("deals in other reporting entities were created by people who would be deleted",
                    "SELECT count(*) FROM deal d WHERE d.created_by_user_id IN (U) AND " + OUTSIDE_DEAL),
            new Blocker("notes, status changes or sign-offs in other reporting entities were made by people who would be deleted",
                    "SELECT (SELECT count(*) FROM deal_note n JOIN deal d ON d.id = n.deal_id"
                            + "        WHERE n.author_user_id IN (U) AND " + OUTSIDE_DEAL + ")"
                            + " + (SELECT count(*) FROM deal_status_move s JOIN deal d ON d.id = s.deal_id"
                            + "        WHERE s.actor_user_id IN (U) AND " + OUTSIDE_DEAL + ")"
                            + " + (SELECT count(*) FROM deal_version v JOIN deal d ON d.id = v.deal_id"
                            + "        WHERE (v.verified_by_user_id IN (U) OR v.reopened_by_user_id IN (U)"
                            + "               OR v.assurance_by_user_id IN (U)) AND " + OUTSIDE_DEAL + ")"),
            new Blocker("documents in other reporting entities were uploaded by people who would be deleted",
                    "SELECT count(*) FROM document doc JOIN deal d ON d.id = doc.deal_id"
                            + " WHERE doc.uploaded_by_user_id IN (U) AND " + OUTSIDE_DEAL),
            new Blocker("register entries in other reporting entities were recorded by people who would be deleted",
                    "SELECT (SELECT count(*) FROM compliance_document WHERE uploaded_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"
                            + " + (SELECT count(*) FROM international_fund_transaction WHERE created_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"
                            + " + (SELECT count(*) FROM suspicious_activity WHERE created_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"
                            + " + (SELECT count(*) FROM training_provider WHERE created_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"
                            + " + (SELECT count(*) FROM training_session WHERE created_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"
                            + " + (SELECT count(*) FROM training_course WHERE created_by_user_id IN (U)"
                            + "        AND real_estate_firm_id IS DISTINCT FROM :f)"));

    private record Blocker(String reason, String countSql) {
        String sql() { return countSql.replace("(U)", "(" + DOOMED_USERS + ")"); }
    }

    /** What deleting the entity would remove, and whether it may be deleted now. */
    public record Preview(Long firmId, String firmName, long branches, long deals, long documents,
                          long usersDeleted, long usersKept, boolean eligible, Instant eligibleAt,
                          List<String> blockers) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final RealEstateFirmRepository firms;
    private final FirmBranchRepository branches;
    private final FirmService firmService;
    private final FirmMembershipRepository membershipRepo;
    private final MembershipService memberships;
    private final UserRepository users;
    private final UserService userService;
    private final TokenStateCache tokenStates;
    private final StoredFileReaper files;

    public FirmDeletionService(NamedParameterJdbcTemplate jdbc,
                               RealEstateFirmRepository firms,
                               FirmBranchRepository branches,
                               FirmService firmService,
                               FirmMembershipRepository membershipRepo,
                               MembershipService memberships,
                               UserRepository users,
                               UserService userService,
                               TokenStateCache tokenStates,
                               StoredFileReaper files) {
        this.jdbc = jdbc;
        this.firms = firms;
        this.branches = branches;
        this.firmService = firmService;
        this.membershipRepo = membershipRepo;
        this.memberships = memberships;
        this.users = users;
        this.userService = userService;
        this.tokenStates = tokenStates;
        this.files = files;
    }

    @Transactional(readOnly = true)
    public Preview preview(Long firmId) {
        return preview(load(firmId));
    }

    /** Deletes the entity. {@code confirmName} must be its name exactly, as typed. */
    @Transactional
    public Preview delete(Long firmId, String confirmName) {
        RealEstateFirm f = load(firmId);
        if (confirmName == null || !confirmName.trim().equals(f.getName())) {
            throw new BadRequestException("Type the reporting entity's name exactly to confirm deleting it");
        }
        Preview p = preview(f);
        if (!p.eligible()) {
            throw new ApiException(HttpStatus.CONFLICT, f.getName()
                    + " is in its retention period and can't be deleted until " + p.eligibleAt());
        }
        if (!p.blockers().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, f.getName()
                    + " can't be deleted: " + String.join("; ", p.blockers()));
        }
        purge(f.getId());
        return p;
    }

    private void purge(Long firmId) {
        Map<String, Object> f = Map.of("f", firmId);

        // 1. Files, read while the rows still name them.
        List<String> keys = new ArrayList<>(files.keys(StoredFileReaper.DEAL_KEYS.formatted(FIRM_DEALS), f));
        keys.addAll(files.keys("""
                SELECT s3_key FROM compliance_document WHERE real_estate_firm_id = :f
                UNION SELECT s3_key FROM international_fund_transaction WHERE real_estate_firm_id = :f
                UNION SELECT s3_key FROM suspicious_activity WHERE real_estate_firm_id = :f
                UNION SELECT cf.s3_key FROM training_course_file cf
                        JOIN training_course c ON c.id = cf.training_course_id
                       WHERE c.real_estate_firm_id = :f
                """, f));

        // 2. People who also belong to another entity keep their account and lose only this
        //    membership. Through the entities, flushed, before any SQL below.
        List<Long> doomed = jdbc.queryForList(DOOMED_USERS, f, Long.class);
        for (FirmMembership m : membershipRepo.findByRealEstateFirmIdOrderByUserIdAsc(firmId)) {
            if (doomed.contains(m.getUserId())) continue;
            User u = users.findByIdForUpdate(m.getUserId())
                    .orElseThrow(() -> new NotFoundException("User " + m.getUserId() + " not found"));
            membershipRepo.delete(m);
            membershipRepo.flush();
            if (firmId.equals(u.getRealEstateFirmId())) {
                // Prefer an active membership as the new home.
                membershipRepo.findByUserIdOrderByIdAsc(u.getId()).stream()
                        .min(Comparator.comparing((FirmMembership o) -> !o.isActive()))
                        .ifPresent(other -> memberships.makeHome(u, other));
            }
            memberships.syncAccount(u);
            userService.endSessions(u);
        }
        users.flush();

        // 3. Deals, then what they held one-to-one. People, nodes and queries are entity-wide rows
        //    that cascade with the entity itself.
        List<Long> propertyIds = jdbc.queryForList("SELECT property_id FROM deal WHERE id IN (" + FIRM_DEALS + ")", f, Long.class);
        List<Long> clientIds = jdbc.queryForList("SELECT client_id FROM deal WHERE id IN (" + FIRM_DEALS + ")", f, Long.class);
        jdbc.update("DELETE FROM deal WHERE id IN (" + FIRM_DEALS + ")", f);
        deleteIn("property", propertyIds);
        deleteIn("client", clientIds);

        // 4. Registers, before the accounts that authored them. Sessions before providers.
        jdbc.update("DELETE FROM training_session WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM training_course WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM training_provider WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM compliance_document WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM international_fund_transaction WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM suspicious_activity WHERE real_estate_firm_id = :f", f);

        // 5. The accounts, with their own training records anywhere else.
        if (!doomed.isEmpty()) {
            Map<String, Object> u = Map.of("u", doomed);
            jdbc.update("DELETE FROM training_course_assignee WHERE user_id IN (:u)", u);
            jdbc.update("DELETE FROM training_session_attendee WHERE user_id IN (:u)", u);
            jdbc.update("DELETE FROM app_user WHERE id IN (:u)", u);
            doomed.forEach(tokenStates::evictAfterCommit);
        }

        // 6. Whatever membership is left (none should be), the branches, then the entity. Review
        //    dates, people, nodes, queries and notification settings cascade.
        jdbc.update("DELETE FROM firm_membership WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM firm_branch WHERE real_estate_firm_id = :f", f);
        jdbc.update("DELETE FROM real_estate_firm WHERE id = :f", f);

        files.deleteAfterCommit(keys);
    }

    /* ---------- internals ---------- */

    private RealEstateFirm load(Long firmId) {
        RealEstateFirm f = firms.findById(firmId)
                .orElseThrow(() -> new NotFoundException("Firm " + firmId + " not found"));
        firmService.assertVisible(firmId);
        return f;
    }

    private Preview preview(RealEstateFirm firm) {
        Map<String, Object> p = Map.of("f", firm.getId());
        List<FirmBranch> all = branches.findAllByRealEstateFirmIdOrderByNameAsc(firm.getId());
        long deals = count("SELECT count(*) FROM (" + FIRM_DEALS + ") x", p);
        long documents = count("SELECT count(*) FROM document doc WHERE doc.status <> 'DELETED'"
                + " AND doc.deal_id IN (" + FIRM_DEALS + ")", p);
        long doomed = count("SELECT count(*) FROM (" + DOOMED_USERS + ") x", p);
        long members = count("SELECT count(DISTINCT app_user_id) FROM firm_membership WHERE real_estate_firm_id = :f", p);

        // The entity's own hold, and that of any branch closed before it: each must have run.
        Instant now = Instant.now();
        boolean eligible = RetentionPolicy.isDeletable(firm.isActive(), firm.getDeactivatedAt(), firm.getCountry(), now);
        Instant eligibleAt = firm.isActive() ? null
                : RetentionPolicy.deletionEligibleAt(firm.getCountry(), firm.getDeactivatedAt());
        for (FirmBranch b : all) {
            if (b.isActive()) continue;
            eligible &= RetentionPolicy.isDeletable(false, b.getDeactivatedAt(), firm.getCountry(), now);
            Instant at = RetentionPolicy.deletionEligibleAt(firm.getCountry(), b.getDeactivatedAt());
            if (at != null && (eligibleAt == null || at.isAfter(eligibleAt))) eligibleAt = at;
        }

        List<String> blockers = new ArrayList<>();
        for (Blocker blocker : BLOCKERS) {
            long n = count(blocker.sql(), p);
            if (n > 0) blockers.add(n + " " + blocker.reason());
        }
        return new Preview(firm.getId(), firm.getName(), all.size(), deals, documents, doomed,
                Math.max(0, members - doomed), eligible, eligible ? null : eligibleAt, blockers);
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
