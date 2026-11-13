package nz.amldock.firm;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 5-year NZ / 7-year AU hold before a deactivated entity or branch may be deleted. */
class RetentionPolicyTest {

    static final Instant DEACTIVATED = Instant.parse("2026-03-01T10:00:00Z");

    @Test
    void activeIsAlwaysDeletable() {
        assertThat(RetentionPolicy.isDeletable(true, null, "NZ", DEACTIVATED)).isTrue();
        assertThat(RetentionPolicy.deletionEligibleAt("NZ", null)).isNull();
    }

    @Test
    void nzHoldIsFiveYears() {
        Instant eligible = RetentionPolicy.deletionEligibleAt("NZ", DEACTIVATED);
        assertThat(eligible).isEqualTo(Instant.parse("2031-03-01T10:00:00Z"));
        assertThat(RetentionPolicy.isDeletable(false, DEACTIVATED, "NZ", eligible.minusSeconds(1))).isFalse();
        assertThat(RetentionPolicy.isDeletable(false, DEACTIVATED, "NZ", eligible)).isTrue();
    }

    @Test
    void auHoldIsSevenYears() {
        Instant eligible = RetentionPolicy.deletionEligibleAt("AU", DEACTIVATED);
        assertThat(eligible).isEqualTo(Instant.parse("2033-03-01T10:00:00Z"));
        assertThat(RetentionPolicy.isDeletable(false, DEACTIVATED, "AU", eligible.minusSeconds(1))).isFalse();
        assertThat(RetentionPolicy.isDeletable(false, DEACTIVATED, "AU", eligible)).isTrue();
    }

    @Test
    void inactiveWithNoDateStaysLocked() {
        assertThat(RetentionPolicy.isDeletable(false, null, "NZ", Instant.MAX)).isFalse();
    }

    @Test
    void unknownCountryIsRejected() {
        assertThatThrownBy(() -> RetentionPolicy.holdYears("US"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void branchRemembersWhatSwitchedItOff() {
        FirmBranch b = new FirmBranch();
        b.deactivate(DeactivationSource.FIRM);
        assertThat(b.isActive()).isFalse();
        assertThat(b.getDeactivatedAt()).isNotNull();
        assertThat(b.getDeactivationSource()).isEqualTo(DeactivationSource.FIRM);

        // A second cause does not overwrite the first, or move the hold's start.
        Instant first = b.getDeactivatedAt();
        b.deactivate(DeactivationSource.MANUAL);
        assertThat(b.getDeactivationSource()).isEqualTo(DeactivationSource.FIRM);
        assertThat(b.getDeactivatedAt()).isEqualTo(first);

        b.activate();
        assertThat(b.isActive()).isTrue();
        assertThat(b.getDeactivatedAt()).isNull();
        assertThat(b.getDeactivationSource()).isNull();
    }
}
