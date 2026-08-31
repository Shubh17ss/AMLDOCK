package nz.amldock.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import nz.amldock.notification.DealNotificationEvent;

import java.util.List;

/**
 * A batch of toggles to apply. Batched rather than one call per switch so a "select all branches"
 * control is a single request, and so a partial save cannot leave a screen half-applied.
 *
 * <p>Entries name a branch explicitly even for branch-level staff, whose only valid answer is their
 * own branch. Keeping the wire shape uniform means the server validates rather than infers, and the
 * two UI shapes post the same payload.
 */
public record UpdateNotificationPreferencesRequest(
        @NotNull @Valid List<Entry> preferences
) {
    public record Entry(
            @NotNull Long firmBranchId,
            @NotNull DealNotificationEvent eventType,
            @NotNull Boolean enabled
    ) {}
}
