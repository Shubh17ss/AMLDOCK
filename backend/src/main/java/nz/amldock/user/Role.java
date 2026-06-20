package nz.amldock.user;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Organisational hierarchy by privilege rank (a user may create any role with a strictly lower
 * rank — i.e. any user can create users with lower privileges, never an equal or higher peer):
 *
 *   ROOT (4, platform)
 *     └─ AML_COMPLIANCE_OFFICER, SENIOR_MANAGER (3, firm level)
 *          └─ SALES_MANAGER (2, branch level)
 *               └─ AGENT, AGENT_PA, ADMIN (1, branch level)
 *
 * Firm/branch linkage per tier:
 *   ROOT                                  → no firm, no branch
 *   AML_COMPLIANCE_OFFICER, SENIOR_MANAGER → firm required, branch null
 *   SALES_MANAGER, AGENT, AGENT_PA, ADMIN  → firm required, branch required
 */
public enum Role {
    ROOT,
    AML_COMPLIANCE_OFFICER,
    SENIOR_MANAGER,
    SALES_MANAGER,
    AGENT,
    AGENT_PA,
    ADMIN;

    /** Higher rank = more privilege. A role may only create roles ranked strictly below it. */
    public int privilegeRank() {
        return switch (this) {
            case ROOT -> 4;
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> 3;
            case SALES_MANAGER -> 2;
            case AGENT, AGENT_PA, ADMIN -> 1;
        };
    }

    /** Every role with a strictly lower privilege rank. Empty = cannot create users. */
    public Set<Role> creatableRoles() {
        return Arrays.stream(values())
                .filter(target -> this.privilegeRank() > target.privilegeRank())
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean canCreate(Role target) {
        return this.privilegeRank() > target.privilegeRank();
    }

    /** Firm-level staff: scoped to a firm, visibility across all its branches. */
    public boolean isFirmLevel() {
        return this == AML_COMPLIANCE_OFFICER || this == SENIOR_MANAGER;
    }

    /** Branch-level staff: scoped to a single branch within a firm. */
    public boolean isBranchLevel() {
        return this == SALES_MANAGER || this == AGENT || this == AGENT_PA || this == ADMIN;
    }

    public boolean requiresFirm() {
        return isFirmLevel() || isBranchLevel();
    }

    public boolean requiresBranch() {
        return isBranchLevel();
    }
}
