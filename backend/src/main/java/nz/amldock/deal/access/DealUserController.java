package nz.amldock.deal.access;

import jakarta.validation.Valid;
import nz.amldock.deal.access.dto.AddDealUsersRequest;
import nz.amldock.deal.access.dto.DealUserDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Who can open one deal.
 *
 * <p>No {@code @PreAuthorize} anywhere here, for the same reason {@code DealController} gives: the
 * rule is about this deal rather than about a role, so it lives in the service where the deal is in
 * hand. Reading is gated on being able to read the deal; changing is narrower again — see
 * {@code DealUserService.mustManage}.
 */
@RestController
@RequestMapping("/api/deals/{dealId}/users")
public class DealUserController {

    private final DealUserService dealUsers;

    public DealUserController(DealUserService dealUsers) {
        this.dealUsers = dealUsers;
    }

    @GetMapping
    public List<DealUserDto> list(@PathVariable Long dealId) {
        return dealUsers.list(dealId);
    }

    /**
     * The branch agents not already on this deal.
     *
     * <p>Exists because {@code GET /api/users} is closed to agents, so without it a broker could
     * not share their own deal.
     */
    @GetMapping("/candidates")
    public List<DealUserDto> candidates(@PathVariable Long dealId) {
        return dealUsers.candidates(dealId);
    }

    /** Returns the whole list rather than what was added, so the panel needs no second request. */
    @PostMapping
    public List<DealUserDto> add(@PathVariable Long dealId,
                                 @Valid @RequestBody AddDealUsersRequest req) {
        return dealUsers.add(dealId, req.userIds());
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> remove(@PathVariable Long dealId, @PathVariable Long userId) {
        dealUsers.remove(dealId, userId);
        return ResponseEntity.noContent().build();
    }
}
