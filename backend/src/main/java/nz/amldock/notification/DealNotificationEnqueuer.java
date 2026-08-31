package nz.amldock.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.client.Client;
import nz.amldock.client.ClientRepository;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealService;
import nz.amldock.deal.DealStatus;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns a deal event into outbox rows, inside the transaction that changed the deal.
 *
 * <p>Called from {@link DealService} create, act and override, all of which are
 * {@code @Transactional}. That placement is the whole point: the rows and the deal commit
 * together, so a rolled-back deal cannot leave an email behind and a committed one cannot lose its
 * notification. Enqueueing from the controller instead would open a second transaction and
 * reintroduce exactly that window.
 *
 * <p><strong>This class deliberately does not swallow exceptions</strong>, inverting the
 * fire-and-forget stance of {@link nz.amldock.training.TrainingNotifier}. That one sends mail after
 * commit, where failing loudly would break a save that has already succeeded. This one runs inside
 * the transaction, where swallowing would let a deal commit with its notification quietly dropped
 * — the failure nobody notices. The realistic failures here are database failures, which should
 * roll the deal back.
 *
 * <p>Recipients are resolved now rather than at send time, so the outbox records who was
 * subscribed when the event happened and each row can be retried and audited on its own.
 */
@Component
public class DealNotificationEnqueuer {

    private static final Logger log = LoggerFactory.getLogger(DealNotificationEnqueuer.class);

    private final DealNotificationRepository notifications;
    private final DealNotificationPreferenceRepository preferences;
    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final PropertyRepository properties;
    private final ClientRepository clients;
    private final UserRepository users;
    private final ObjectMapper json;
    private final String appBaseUrl;

    public DealNotificationEnqueuer(DealNotificationRepository notifications,
                                    DealNotificationPreferenceRepository preferences,
                                    FirmBranchRepository branches,
                                    RealEstateFirmRepository firms,
                                    PropertyRepository properties,
                                    ClientRepository clients,
                                    UserRepository users,
                                    ObjectMapper json,
                                    @Value("${amldock.mail.app-base-url:http://localhost:5173}") String appBaseUrl) {
        this.notifications = notifications;
        this.preferences = preferences;
        this.branches = branches;
        this.firms = firms;
        this.properties = properties;
        this.clients = clients;
        this.users = users;
        this.json = json;
        this.appBaseUrl = appBaseUrl.endsWith("/")
                ? appBaseUrl.substring(0, appBaseUrl.length() - 1)
                : appBaseUrl;
    }

    public void enqueueDealCreated(Deal deal, UserPrincipal actor) {
        enqueue(deal, actor, DealNotificationEvent.DEAL_CREATED, null, deal.getStatus());
    }

    /**
     * @param previous the status before the transition; a no-op transition enqueues nothing
     */
    public void enqueueStatusChanged(Deal deal, UserPrincipal actor, DealStatus previous) {
        if (previous == deal.getStatus()) return;
        enqueue(deal, actor, DealNotificationEvent.DEAL_STATUS_CHANGED, previous, deal.getStatus());
    }

    private void enqueue(Deal deal, UserPrincipal actor, DealNotificationEvent event,
                         DealStatus from, DealStatus to) {
        FirmBranch branch = branches.findById(deal.getFirmBranchId()).orElse(null);
        if (branch == null) {
            // The FK guarantees the branch exists, so this can only be a concurrent delete.
            // Not recoverable by retrying, and not worth failing the deal over.
            log.warn("Deal {} has no branch {} - no notifications enqueued",
                    deal.getId(), deal.getFirmBranchId());
            return;
        }

        List<DealNotificationPreferenceRepository.RecipientCandidate> candidates =
                preferences.findRecipientCandidates(
                        branch.getId(), event.name(), deal.getCreatedByUserId(), actor.id());
        if (candidates.isEmpty()) return;

        RealEstateFirm firm = firms.findById(branch.getRealEstateFirmId()).orElse(null);
        Property property = deal.getPropertyId() == null ? null
                : properties.findById(deal.getPropertyId()).orElse(null);
        Client client = deal.getClientId() == null ? null
                : clients.findById(deal.getClientId()).orElse(null);
        // UserPrincipal carries no display name, so the actor is resolved once per event rather
        // than once per recipient. Falls back to the address, which is always present.
        String actorName = users.findById(actor.id())
                .map(User::getFullName).orElse(actor.email());

        List<DealNotification> rows = new ArrayList<>();
        for (DealNotificationPreferenceRepository.RecipientCandidate c : candidates) {
            if (!wants(c, event)) continue;

            DealNotificationPayload payload = new DealNotificationPayload(
                    deal.getId(),
                    deal.getReference(),
                    branch.getName(),
                    firm == null ? null : firm.getName(),
                    property == null ? null : DealService.formatAddress(property),
                    client == null ? null : client.getDisplayName(),
                    from == null ? null : from.name(),
                    to == null ? null : to.name(),
                    actorName,
                    c.getFullName(),
                    appBaseUrl + "/deals/" + deal.getId());

            DealNotification n = new DealNotification();
            n.setDealId(deal.getId());
            n.setEventType(event);
            n.setRecipientUserId(c.getUserId());
            n.setRecipientEmail(c.getEmail());
            n.setPayload(serialise(payload));
            n.setStatus(DealNotificationStatus.PENDING);
            rows.add(n);
        }

        if (rows.isEmpty()) return;
        notifications.saveAll(rows);
        log.debug("Enqueued {} {} notification(s) for deal {}", rows.size(), event, deal.getId());
    }

    /**
     * A stored preference wins; absence falls through to the role default.
     *
     * <p>Resolved here in Java rather than in the SQL so that {@link NotificationDefaults} stays
     * the single statement of the matrix.
     */
    private static boolean wants(DealNotificationPreferenceRepository.RecipientCandidate c,
                                 DealNotificationEvent event) {
        if (c.getEnabled() != null) return c.getEnabled();
        return NotificationDefaults.defaultEnabled(Role.valueOf(c.getRole()), event);
    }

    private String serialise(DealNotificationPayload payload) {
        try {
            return json.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            // A payload we cannot serialise is a programming error, not a transient fault. Failing
            // here rolls the deal back, which is loud but correct - see the class javadoc.
            throw new IllegalStateException("Could not serialise deal notification payload", e);
        }
    }
}
