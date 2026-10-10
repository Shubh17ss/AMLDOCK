package nz.amldock.notification;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * One poll keeps sending while the outbox returns full batches, so a backlog drains in minutes
 * rather than hours, and an idle outbox still costs a single claim.
 */
@ExtendWith(MockitoExtension.class)
class ScheduledDealNotificationDispatcherTest {

    @Mock DealNotificationDispatchService dispatch;

    @Test
    void aFullBatchIsFollowedByAnotherUntilAShortOne() {
        when(dispatch.claim(3)).thenReturn(batch(3), batch(3), batch(1));

        new ScheduledDealNotificationDispatcher(dispatch, 3, 10).pump();

        verify(dispatch, times(3)).claim(3);
        verify(dispatch, times(3)).applyOutcomes(any());
    }

    @Test
    void anEmptyOutboxCostsOneClaimAndNoSend() {
        when(dispatch.claim(3)).thenReturn(List.of());

        new ScheduledDealNotificationDispatcher(dispatch, 3, 10).pump();

        verify(dispatch, times(1)).claim(3);
        verify(dispatch, never()).send(any());
    }

    @Test
    void oneTickIsCappedAtMaxBatches() {
        when(dispatch.claim(3)).thenReturn(batch(3));

        new ScheduledDealNotificationDispatcher(dispatch, 3, 4).pump();

        verify(dispatch, times(4)).claim(3);
    }

    @Test
    void aFailingBatchEndsTheTickWithoutEscaping() {
        when(dispatch.claim(3)).thenReturn(batch(3));
        when(dispatch.send(any())).thenThrow(new RuntimeException("SES down"));

        new ScheduledDealNotificationDispatcher(dispatch, 3, 10).pump();   // must not throw

        verify(dispatch, times(1)).claim(3);
        verify(dispatch, never()).applyOutcomes(any());
    }

    private static List<DealNotificationDispatchService.Sendable> batch(int n) {
        return Collections.nCopies(n, new DealNotificationDispatchService.Sendable(
                1L, 1L, DealNotificationEvent.DEAL_CREATED, 7L, "u@x.test", Map.of()));
    }
}
