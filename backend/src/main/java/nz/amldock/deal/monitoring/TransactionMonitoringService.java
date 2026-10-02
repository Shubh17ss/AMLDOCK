package nz.amldock.deal.monitoring;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.monitoring.DealStatusMove.Kind;
import nz.amldock.deal.monitoring.dto.StatusMoveDto;
import nz.amldock.deal.monitoring.dto.StatusMoveDto.Variance;
import nz.amldock.deal.version.DealVersion;
import nz.amldock.deal.version.DealVersionRepository;
import nz.amldock.user.User;
import nz.amldock.user.UserRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The deal's moves between VERIFIED and CLOSED, recorded as they happen and read back as a history.
 *
 * <p>The record methods are called from inside {@code DealService}'s transactions, after the move
 * itself, so a move and its row commit or roll back together. Permission is the caller's job, as
 * for the notes timeline: {@code DealService.transactionMonitoring} checks the deal can be read
 * before asking for its history.
 */
@Service
public class TransactionMonitoringService {

    /**
     * How far outside the valuation a sale may land and still be "within value": 20% below the
     * minimum, 20% above the maximum.
     */
    static final BigDecimal LOWER = new BigDecimal("0.80");
    static final BigDecimal UPPER = new BigDecimal("1.20");

    private final DealStatusMoveRepository moves;
    private final DealVersionRepository versions;
    private final UserRepository users;

    public TransactionMonitoringService(DealStatusMoveRepository moves, DealVersionRepository versions,
                                        UserRepository users) {
        this.moves = moves;
        this.versions = versions;
        this.users = users;
    }

    /**
     * A close, with what it closed at.
     *
     * @param propertySold null for a close forced by override, which records no sale outcome
     * @param saleTotal    the sale price, or the sum of a development's units; null when not sold
     */
    public void recordClose(Deal deal, Long actorId, String note, Boolean propertySold, BigDecimal saleTotal) {
        Optional<DealVersion> latest = versions.findTopByDealIdOrderByVersionNoDesc(deal.getId());
        // Verified since: the unclose that put it back, if that is how it got here, otherwise the
        // verification that wrote the version it stands on.
        Instant fromAt = moves.findTopByDealIdOrderByOccurredAtDescIdDesc(deal.getId())
                .filter(m -> m.getKind() == Kind.UNCLOSE)
                .map(DealStatusMove::getOccurredAt)
                .orElseGet(() -> latest.map(DealVersion::getVerifiedAt).orElse(null));
        moves.save(new DealStatusMove(deal.getId(), Kind.CLOSE, fromAt, Instant.now(), actorId,
                latest.map(DealVersion::getVersionNo).orElse(null),
                deal.getValuationMin(), deal.getValuationMax(),
                propertySold, Boolean.TRUE.equals(propertySold) ? saleTotal : null, blankToNull(note)));
    }

    /** An unclose, with the reason it was reopened. */
    public void recordUnclose(Deal deal, Long actorId, String note) {
        Optional<DealStatusMove> lastClose = moves.findTopByDealIdOrderByOccurredAtDescIdDesc(deal.getId())
                .filter(m -> m.getKind() == Kind.CLOSE);
        Integer versionNo = lastClose.map(DealStatusMove::getVersionNo)
                .orElseGet(() -> versions.findTopByDealIdOrderByVersionNoDesc(deal.getId())
                        .map(DealVersion::getVersionNo).orElse(null));
        moves.save(new DealStatusMove(deal.getId(), Kind.UNCLOSE,
                lastClose.map(DealStatusMove::getOccurredAt).orElse(null), Instant.now(), actorId,
                versionNo, deal.getValuationMin(), deal.getValuationMax(), null, null, blankToNull(note)));
    }

    /** Every move of the deal, newest first. The caller has already checked it may be read. */
    public List<StatusMoveDto> history(Long dealId) {
        List<DealStatusMove> rows = moves.findAllByDealIdOrderByOccurredAtDescIdDesc(dealId);
        if (rows.isEmpty()) return List.of();
        Map<Long, User> people = users.findAllById(rows.stream().map(DealStatusMove::getActorUserId)
                        .filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return rows.stream().map(m -> {
            boolean close = m.getKind() == Kind.CLOSE;
            User actor = m.getActorUserId() == null ? null : people.get(m.getActorUserId());
            return new StatusMoveDto(
                    m.getKind(),
                    close ? DealStatus.VERIFIED : DealStatus.CLOSED,
                    close ? DealStatus.CLOSED : DealStatus.VERIFIED,
                    m.getFromAt(), m.getOccurredAt(), m.getVersionNo(),
                    m.getValuationMin(), m.getValuationMax(),
                    m.getPropertySold(), m.getSaleTotal(),
                    close && Boolean.TRUE.equals(m.getPropertySold())
                            ? variance(m.getValuationMin(), m.getValuationMax(), m.getSaleTotal())
                            : null,
                    m.getNote(),
                    actor == null ? null : actor.getFullName());
        }).toList();
    }

    /**
     * Within value when {@code min × 0.8 ≤ total ≤ max × 1.2}; beyond it otherwise. Null when there
     * is nothing to compare — no sale figure, or no valuation.
     */
    static Variance variance(BigDecimal min, BigDecimal max, BigDecimal total) {
        if (total == null || min == null || max == null) return null;
        boolean below = total.compareTo(min.multiply(LOWER)) < 0;
        boolean above = total.compareTo(max.multiply(UPPER)) > 0;
        return below || above ? Variance.BEYOND : Variance.WITHIN;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
