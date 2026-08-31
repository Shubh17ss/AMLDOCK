package nz.amldock.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.client.ClientRepository;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What actually lands in the outbox.
 *
 * <p>The scope rules themselves live in SQL and are covered by the recipient query; what is pinned
 * here is the Java half — the default-when-absent fallback, the actor suppression, and the payload
 * snapshot. Together with {@code NotificationEligibilityTest} these are the pieces that decide
 * whether somebody is mailed about a deal they should not see.
 */
@ExtendWith(MockitoExtension.class)
class DealNotificationEnqueuerTest {

    @Mock DealNotificationRepository notifications;
    @Mock DealNotificationPreferenceRepository preferences;
    @Mock FirmBranchRepository branches;
    @Mock RealEstateFirmRepository firms;
    @Mock PropertyRepository properties;
    @Mock ClientRepository clients;
    @Mock UserRepository users;

    DealNotificationEnqueuer enqueuer;

    private static final Long BRANCH = 10L;
    private static final Long ACTOR = 1L;
    private static final Long BROKER = 2L;

    @BeforeEach
    void setUp() {
        enqueuer = new DealNotificationEnqueuer(notifications, preferences, branches, firms,
                properties, clients, users, new ObjectMapper(), "http://localhost:5173/");

        FirmBranch branch = new FirmBranch();
        branch.setName("Ponsonby");
        setId(branch, BRANCH);
        branch.setRealEstateFirmId(99L);
        lenient().when(branches.findById(BRANCH)).thenReturn(Optional.of(branch));

        User actor = new User();
        actor.setFullName("Ada Officer");
        lenient().when(users.findById(ACTOR)).thenReturn(Optional.of(actor));
    }

    /* ---------- the default-when-absent rule ---------- */

    @Test
    void aRecipientWithNoStoredPreferenceIsNotifiedByDefault() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, null));

        enqueuer.enqueueDealCreated(deal(), principal());

        assertThat(saved()).hasSize(1);
        assertThat(saved().get(0).getRecipientEmail()).isEqualTo("broker@x.test");
    }

    @Test
    void anExplicitOffSuppressesTheNotification() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, false));

        enqueuer.enqueueDealCreated(deal(), principal());

        verify(notifications, never()).saveAll(any());
    }

    @Test
    void anExplicitOnIsHonouredLikeTheDefault() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, true));

        enqueuer.enqueueDealCreated(deal(), principal());

        assertThat(saved()).hasSize(1);
    }

    @Test
    void oneRecipientOptingOutDoesNotSilenceTheOthers() {
        givenCandidates(
                candidate(BROKER, "broker@x.test", Role.AGENT, false),
                candidate(3L, "admin@x.test", Role.ADMIN, null),
                candidate(4L, "amlco@x.test", Role.AML_COMPLIANCE_OFFICER, true));

        enqueuer.enqueueDealCreated(deal(), principal());

        assertThat(saved()).hasSize(2);
        assertThat(saved().stream().map(DealNotification::getRecipientEmail))
                .containsExactlyInAnyOrder("admin@x.test", "amlco@x.test");
    }

    /* ---------- one row per recipient ---------- */

    @Test
    void everyRecipientGetsTheirOwnRow() {
        givenCandidates(
                candidate(2L, "a@x.test", Role.ADMIN, null),
                candidate(3L, "b@x.test", Role.SALES_MANAGER, null),
                candidate(4L, "c@x.test", Role.SENIOR_MANAGER, null));

        enqueuer.enqueueDealCreated(deal(), principal());

        assertThat(saved()).hasSize(3);
        assertThat(saved()).allSatisfy(n -> {
            assertThat(n.getStatus()).isEqualTo(DealNotificationStatus.PENDING);
            // NULL means "due immediately" — a fresh row has no backoff to serve.
            assertThat(n.getNextAttemptAt()).isNull();
            assertThat(n.getAttemptCount()).isZero();
        });
    }

    /* ---------- actor suppression is the query's job, but the wiring is ours ---------- */

    @Test
    void theActorIsExcludedByTheQueryRatherThanAfterTheFact() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, null));

        enqueuer.enqueueDealCreated(deal(), principal());

        // The actor id is passed down so the database can leave them out, rather than every
        // recipient being fetched and then filtered here.
        verify(preferences).findRecipientCandidates(
                eq(BRANCH), eq(DealNotificationEvent.DEAL_CREATED.name()), eq(BROKER), eq(ACTOR));
    }

    /* ---------- status changes ---------- */

    @Test
    void aNoOpTransitionEnqueuesNothing() {
        Deal d = deal();
        d.setStatus(DealStatus.REVIEW);

        enqueuer.enqueueStatusChanged(d, principal(), DealStatus.REVIEW);

        verify(preferences, never()).findRecipientCandidates(anyLong(), anyString(), anyLong(), anyLong());
        verify(notifications, never()).saveAll(any());
    }

    @Test
    void aStatusChangeSnapshotsBothEndsOfTheTransition() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, null));
        Deal d = deal();
        d.setStatus(DealStatus.VERIFIED);

        enqueuer.enqueueStatusChanged(d, principal(), DealStatus.REVIEW);

        String payload = saved().get(0).getPayload();
        assertThat(payload).contains("\"fromStatus\":\"REVIEW\"");
        assertThat(payload).contains("\"toStatus\":\"VERIFIED\"");
        assertThat(saved().get(0).getEventType())
                .isEqualTo(DealNotificationEvent.DEAL_STATUS_CHANGED);
    }

    /* ---------- the payload snapshot ---------- */

    @Test
    void thePayloadCapturesTheDealAsItWasAtTheEvent() {
        givenCandidates(candidate(BROKER, "broker@x.test", Role.AGENT, null));

        enqueuer.enqueueDealCreated(deal(), principal());

        String payload = saved().get(0).getPayload();
        assertThat(payload).contains("\"reference\":\"DEAL-2026-0042\"");
        assertThat(payload).contains("\"branchName\":\"Ponsonby\"");
        assertThat(payload).contains("\"actorName\":\"Ada Officer\"");
        // Trailing slash on the configured base URL must not double up.
        assertThat(payload).contains("\"dealUrl\":\"http://localhost:5173/deals/42\"");
    }

    /* ---------- degenerate cases ---------- */

    @Test
    void noEligibleRecipientsMeansNoWrite() {
        givenCandidates();

        enqueuer.enqueueDealCreated(deal(), principal());

        verify(notifications, never()).saveAll(any());
    }

    /**
     * The FK makes this all but impossible, but a deal we cannot place in a branch must not take
     * the surrounding save down with it — there is nobody to notify and nothing to retry.
     */
    @Test
    void aMissingBranchIsLoggedRatherThanThrown() {
        Deal d = deal();
        d.setFirmBranchId(404L);
        when(branches.findById(404L)).thenReturn(Optional.empty());

        enqueuer.enqueueDealCreated(d, principal());

        verify(notifications, never()).saveAll(any());
    }

    /* ---------- helpers ---------- */

    private void givenCandidates(DealNotificationPreferenceRepository.RecipientCandidate... cs) {
        when(preferences.findRecipientCandidates(anyLong(), anyString(), any(), anyLong()))
                .thenReturn(List.of(cs));
    }

    @SuppressWarnings("unchecked")
    private List<DealNotification> saved() {
        ArgumentCaptor<List<DealNotification>> captor = ArgumentCaptor.forClass(List.class);
        verify(notifications).saveAll(captor.capture());
        return captor.getValue();
    }

    private static UserPrincipal principal() {
        return new UserPrincipal(ACTOR, "actor@x.test", null,
                Role.AML_COMPLIANCE_OFFICER, 99L, null, true);
    }

    private static Deal deal() {
        Deal d = new Deal();
        setId(d, 42L);
        d.setReference("DEAL-2026-0042");
        d.setFirmBranchId(BRANCH);
        d.setCreatedByUserId(BROKER);
        d.setStatus(DealStatus.NEW);
        return d;
    }

    private static DealNotificationPreferenceRepository.RecipientCandidate candidate(
            Long id, String email, Role role, Boolean enabled) {
        return new DealNotificationPreferenceRepository.RecipientCandidate() {
            @Override public Long getUserId() { return id; }
            @Override public String getEmail() { return email; }
            @Override public String getFullName() { return email; }
            @Override public String getRole() { return role.name(); }
            @Override public Boolean getEnabled() { return enabled; }
        };
    }

    /** Ids are database-generated, so tests set them reflectively rather than adding a setter. */
    private static void setId(Object entity, Long id) {
        try {
            var f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
