package nz.amldock.user;

import java.util.Set;

/**
 * Organisational hierarchy (top tier creates the tier directly below it, never otherwise):
 *
 *   ROOT (platform)
 *     └─ AML_COMPLIANCE_OFFICER, SENIOR_MANAGER (firm level)
 *          └─ SALES_MANAGER (branch level)
 *               └─ AGENT, AGENT_PA, ADMIN (branch level)
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

    /** Roles this role is permitted to create. Empty = cannot create users. */
    public Set<Role> creatableRoles() {
        return switch (this) {
            case ROOT -> Set.of(AML_COMPLIANCE_OFFICER, SENIOR_MANAGER);
            case AML_COMPLIANCE_OFFICER, SENIOR_MANAGER -> Set.of(SALES_MANAGER);
            case SALES_MANAGER -> Set.of(AGENT, AGENT_PA, ADMIN);
            case AGENT, AGENT_PA, ADMIN -> Set.of();
        };
    }

    public boolean canCreate(Role target) {
        return creatableRoles().contains(target);
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
