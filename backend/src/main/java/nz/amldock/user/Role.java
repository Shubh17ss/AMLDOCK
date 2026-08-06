package nz.amldock.user;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Organisational hierarchy by privilege rank (a user may create any role with a strictly lower
 * rank, never a higher one):
 *
 *   ROOT (4, platform)
 *     └─ AML_COMPLIANCE_OFFICER, SENIOR_MANAGER (3, firm level)
 *          └─ SALES_MANAGER (2, branch level)
 *               └─ AGENT, AGENT_PA, ADMIN (1, branch level)
 *
 * One exception to "strictly lower": firm-level staff may appoint firm-level peers, so a
 * compliance officer or senior manager can stand up the other compliance roles for their own
 * reporting entity without ROOT. UserService pins those appointments to the creator's firm.
 *
 * Two specialist roles sit outside that line of management. Neither may create users:
 *   AUDIT (2, platform)  → reads every section of every reporting entity and writes nothing.
 *   FINANCE (2, firm)    → the International Fund Transaction Register and Management Reports,
 *                          and nothing else.
 *
 * Firm/branch linkage per tier:
 *   ROOT, AUDIT                                      → no firm, no branch
 *   AML_COMPLIANCE_OFFICER, SENIOR_MANAGER, FINANCE  → firm required, branch null
 *   SALES_MANAGER, AGENT, AGENT_PA, ADMIN            → firm required, branch required
 */
public enum Role {
    ROOT,
    AML_COMPLIANCE_OFFICER,
    SENIOR_MANAGER,
    SALES_MANAGER,
    AGENT,
    AGENT_PA,
    ADMIN,
    AUDIT,
    FINANCE;

    /** Higher rank = more privilege. A role may only create roles ranked strictly below it. */
    public int privilegeRank() {
        return switch (this) {
            case ROOT -> 4;
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> 3;
            // Specialists rank alongside the sales manager: ROOT and firm-level staff may appoint
            // them, a sales manager may not, and canCreate stops them appointing anyone.
            case SALES_MANAGER, AUDIT, FINANCE -> 2;
            case AGENT, AGENT_PA, ADMIN -> 1;
        };
    }

    /** Every role this one may create. Empty = cannot create users. */
    public Set<Role> creatableRoles() {
        return Arrays.stream(values())
                .filter(this::canCreate)
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean canCreate(Role target) {
        // The specialists manage nobody. Without this their rank alone would let them appoint
        // every branch-level role.
        if (this == AUDIT || this == FINANCE) {
            return false;
        }
        // Firm-level peers may appoint each other within their own reporting entity.
        if (isFirmLevel() && target.isFirmLevel()) {
            return true;
        }
        return this.privilegeRank() > target.privilegeRank();
    }

    /**
     * Firm-level compliance staff: scoped to a firm, visibility across all its branches.
     *
     * Deliberately excludes FINANCE even though it is also firm-scoped-without-a-branch — this
     * predicate carries meaning beyond linkage (who may be assigned AML training, who may appoint
     * firm-level peers) that the specialist roles have no part in. Use {@link #requiresFirm()} for
     * the linkage question.
     */
    public boolean isFirmLevel() {
        return this == AML_COMPLIANCE_OFFICER || this == SENIOR_MANAGER;
    }

    /** Branch-level staff: scoped to a single branch within a firm. */
    public boolean isBranchLevel() {
        return this == SALES_MANAGER || this == AGENT || this == AGENT_PA || this == ADMIN;
    }

    /**
     * Sees every reporting entity rather than one. A scoping question only — it grants visibility,
     * never the right to change anything.
     */
    public boolean seesAllFirms() {
        return this == ROOT || this == AUDIT;
    }

    /**
     * Reads everything, writes nothing. Enforced globally by
     * {@link nz.amldock.auth.AuditReadOnlyFilter} rather than by remembering to leave this role
     * out of every write gate.
     */
    public boolean isReadOnly() {
        return this == AUDIT;
    }

    public boolean requiresFirm() {
        return isFirmLevel() || isBranchLevel() || this == FINANCE;
    }

    public boolean requiresBranch() {
        return isBranchLevel();
    }
}
