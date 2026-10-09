package nz.amldock.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import nz.amldock.audit.AuditService;
import nz.amldock.email.BulkEmailSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Claiming from the outbox: abandoned claims first, then due work up to the batch size. The SQL of
 * each query is exercised against the perf database (perf/reports/2026-10-06-outbox-claim.md);
 * this covers how the two are combined.
 */
@ExtendWith(MockitoExtension.class)
class DealNotificationClaimTest {

    @Mock DealNotificationRepository notifications;
    @Mock BulkEmailSender sender;
    @Mock AuditService audit;

    DealNotificationDispatchService service;

    @BeforeEach
    void setUp() {
        service = new DealNotificationDispatchService(notifications, sender, audit, new ObjectMapper(), 5, 90);
    }

    @Test
    void abandonedClaimsAreTakenFirstAndDueWorkFillsTheRest() {
        when(notifications.findStaleClaimIds(any(Instant.class), eq(50))).thenReturn(List.of(1L, 2L));
        when(notifications.findDueIds(48)).thenReturn(List.of(10L, 11L, 12L));
        when(notifications.findAllById(List.of(1L, 2L, 10L, 11L, 12L)))
                .thenReturn(List.of(row(1L, DealNotificationStatus.IN_PROGRESS), row(2L, DealNotificationStatus.IN_PROGRESS),
                        row(10L, DealNotificationStatus.PENDING), row(11L, DealNotificationStatus.PENDING),
                        row(12L, DealNotificationStatus.PENDING)));

        List<DealNotificationDispatchService.Sendable> batch = service.claim(50);

        assertThat(batch).extracting(DealNotificationDispatchService.Sendable::id).containsExactly(1L, 2L, 10L, 11L, 12L);
    }

    @Test
    void whenAbandonedClaimsFillTheBatchNoDueWorkIsQueried() {
        when(notifications.findStaleClaimIds(any(Instant.class), eq(2))).thenReturn(List.of(1L, 2L));
        when(notifications.findAllById(List.of(1L, 2L)))
                .thenReturn(List.of(row(1L, DealNotificationStatus.IN_PROGRESS), row(2L, DealNotificationStatus.IN_PROGRESS)));

        assertThat(service.claim(2)).hasSize(2);
        verify(notifications, never()).findDueIds(anyInt());
    }

    @Test
    void claimedRowsAreMarkedInProgressWithAClaimTime() {
        DealNotification due = row(10L, DealNotificationStatus.PENDING);
        when(notifications.findStaleClaimIds(any(Instant.class), eq(50))).thenReturn(List.of());
        when(notifications.findDueIds(50)).thenReturn(List.of(10L));
        when(notifications.findAllById(List.of(10L))).thenReturn(List.of(due));
        Instant before = Instant.now();

        service.claim(50);

        assertThat(due.getStatus()).isEqualTo(DealNotificationStatus.IN_PROGRESS);
        assertThat(due.getClaimedAt()).isNotNull().isAfterOrEqualTo(before);
    }

    @Test
    void anEmptyOutboxClaimsNothing() {
        when(notifications.findStaleClaimIds(any(Instant.class), eq(50))).thenReturn(List.of());
        when(notifications.findDueIds(50)).thenReturn(List.of());

        assertThat(service.claim(50)).isEmpty();
        verify(notifications, never()).findAllById(any());
    }

    private static DealNotification row(Long id, DealNotificationStatus status) {
        DealNotification n = new DealNotification();
        ReflectionTestUtils.setField(n, "id", id);
        n.setDealId(1L);
        n.setEventType(DealNotificationEvent.DEAL_CREATED);
        n.setRecipientUserId(7L);
        n.setRecipientEmail("u@x.test");
        n.setPayload("{}");
        n.setStatus(status);
        return n;
    }
}
