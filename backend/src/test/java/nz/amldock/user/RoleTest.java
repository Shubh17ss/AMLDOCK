package nz.amldock.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The role hierarchy is a security boundary, so the "who may create whom" matrix is pinned
 * here rather than left to the enum's arithmetic.
 */
class RoleTest {

    @Test
    void firmLevelRolesMayAppointTheirPeers() {
        for (Role actor : new Role[]{Role.AML_COMPLIANCE_OFFICER, Role.SENIOR_MANAGER}) {
            assertThat(actor.canCreate(Role.AML_COMPLIANCE_OFFICER)).isTrue();
            assertThat(actor.canCreate(Role.SENIOR_MANAGER)).isTrue();
            assertThat(actor.creatableRoles())
                    .contains(Role.AML_COMPLIANCE_OFFICER, Role.SENIOR_MANAGER, Role.SALES_MANAGER,
                            Role.AGENT, Role.AGENT_PA, Role.ADMIN)
                    .doesNotContain(Role.ROOT);
        }
    }

    @Test
    void nobodyMayCreateRoot() {
        for (Role actor : Role.values()) {
            if (actor != Role.ROOT) {
                assertThat(actor.canCreate(Role.ROOT))
                        .as("%s must not be able to create ROOT", actor)
                        .isFalse();
            }
        }
    }

    @Test
    void rootMayCreateEveryoneButRoot() {
        assertThat(Role.ROOT.canCreate(Role.ROOT)).isFalse();
        assertThat(Role.ROOT.creatableRoles()).hasSize(Role.values().length - 1);
    }

    @Test
    void peerCreationDoesNotLeakBelowFirmLevel() {
        // The peer exception is firm-level only — branch roles keep the strict rank rule.
        assertThat(Role.SALES_MANAGER.canCreate(Role.SALES_MANAGER)).isFalse();
        assertThat(Role.SALES_MANAGER.canCreate(Role.SENIOR_MANAGER)).isFalse();
        assertThat(Role.SALES_MANAGER.canCreate(Role.AML_COMPLIANCE_OFFICER)).isFalse();
        assertThat(Role.AGENT.creatableRoles()).isEmpty();
        assertThat(Role.AGENT_PA.creatableRoles()).isEmpty();
        assertThat(Role.ADMIN.creatableRoles()).isEmpty();
    }

    @Test
    void branchRolesMayNotEscalateToFirmLevel() {
        for (Role actor : new Role[]{Role.AGENT, Role.AGENT_PA, Role.ADMIN, Role.SALES_MANAGER}) {
            assertThat(actor.canCreate(Role.SENIOR_MANAGER)).isFalse();
            assertThat(actor.canCreate(Role.AML_COMPLIANCE_OFFICER)).isFalse();
        }
    }
}
