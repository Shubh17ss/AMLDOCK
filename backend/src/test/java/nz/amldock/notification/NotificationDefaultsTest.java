package nz.amldock.notification;

import nz.amldock.user.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The defaults are what most users actually experience, since a preference row only exists once
 * somebody has touched a switch. Pinning the whole matrix here makes flipping a default a
 * deliberate test edit rather than a silent change in behaviour for everyone at once.
 */
class NotificationDefaultsTest {

    @Test
    void everyEligibleRoleIsOnForEveryEvent() {
        for (Role role : Role.values()) {
            if (!NotificationEligibility.isEligible(role)) continue;
            for (DealNotificationEvent event : DealNotificationEvent.values()) {
                assertThat(NotificationDefaults.defaultEnabled(role, event))
                        .as("%s / %s should default on", role, event)
                        .isTrue();
            }
        }
    }

    /**
     * Belt and braces over the eligibility filter in the recipient query: even asked directly,
     * an ineligible role is never on. A caller that forgets to filter still cannot mail them.
     */
    @Test
    void ineligibleRolesAreOffWhateverTheEvent() {
        for (Role role : new Role[]{Role.ROOT, Role.AUDIT, Role.FINANCE}) {
            for (DealNotificationEvent event : DealNotificationEvent.values()) {
                assertThat(NotificationDefaults.defaultEnabled(role, event))
                        .as("%s / %s must be off", role, event)
                        .isFalse();
            }
        }
    }

    @Test
    void everyEventHasATemplateName() {
        for (DealNotificationEvent event : DealNotificationEvent.values()) {
            assertThat(event.templateName()).as("%s template", event).isNotBlank();
            assertThat(event.label()).as("%s label", event).isNotBlank();
        }
    }
}
