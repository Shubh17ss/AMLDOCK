package nz.amldock.deal;

import nz.amldock.client.Client;
import nz.amldock.client.ClientRepository;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.web.IdPage;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.PageResponse;
import nz.amldock.deal.dto.DealListItemDto;
import nz.amldock.deal.dto.DealSummaryDto;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The deals list and dashboard summary. Lives apart from {@link DealService}, which owns a single
 * deal's lifecycle; this owns "which deals, and how many".
 *
 * <p>Every list follows one shape: {@link DealListQuery} returns the ordered ids of one page and
 * the total, then {@link #toListItems} loads and maps only those rows.
 */
@Service
public class DealListService {

    private final DealListQuery query;
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final RealEstateFirmRepository firms;
    private final PropertyRepository properties;
    private final ClientRepository clients;
    private final UserRepository users;

    public DealListService(DealListQuery query, DealRepository deals, FirmBranchRepository branches,
                           RealEstateFirmRepository firms, PropertyRepository properties,
                           ClientRepository clients, UserRepository users) {
        this.query = query;
        this.deals = deals;
        this.branches = branches;
        this.firms = firms;
        this.properties = properties;
        this.clients = clients;
        this.users = users;
    }

    /** The caller's scope, from the signed-in principal. See {@link DealScope#forActor}. */
    public DealScope scopeForCurrentUser(Long firmIdFilter, Long branchIdFilter) {
        return DealScope.forActor(currentPrincipal(), firmIdFilter, branchIdFilter);
    }

    @Transactional(readOnly = true)
    public PageResponse<DealListItemDto> list(DealStatus status, Long firmId, Long branchId, String q,
                                              DealListQuery.Sort sort, PageRequests paging) {
        DealScope scope = scopeForCurrentUser(firmId, branchId);
        IdPage ids = query.page(scope, status == null ? List.of() : List.of(status), q,
                sort == null ? DealListQuery.Sort.CREATED_AT : sort, paging);
        return PageResponse.of(toListItems(loadInOrder(ids.ids())), paging, ids.total(), ids.exact());
    }

    @Transactional(readOnly = true)
    public DealSummaryDto summary(Long firmId, Long branchId) {
        return query.summary(scopeForCurrentUser(firmId, branchId), Instant.now().minus(Duration.ofDays(30)));
    }

    /** Loads deals by id, returned in the order of {@code ids} (findAllById does not keep it). */
    public List<Deal> loadInOrder(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        Map<Long, Deal> byId = deals.findAllById(ids).stream()
                .collect(Collectors.toMap(Deal::getId, Function.identity()));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    /**
     * List rows for the given deals, in the given order. Bulk-resolves each lookup table once
     * (branch, firm, property, client, author) rather than once per row. Callers pass one page.
     */
    public List<DealListItemDto> toListItems(List<Deal> page) {
        if (page.isEmpty()) return List.of();
        Map<Long, FirmBranch> branchById = byId(branches.findAllById(distinct(page, Deal::getFirmBranchId)), FirmBranch::getId);
        Map<Long, RealEstateFirm> firmById = byId(firms.findAllById(branchById.values().stream()
                .map(FirmBranch::getRealEstateFirmId).distinct().toList()), RealEstateFirm::getId);
        Map<Long, Property> propertyById = byId(properties.findAllById(distinct(page, Deal::getPropertyId)), Property::getId);
        Map<Long, Client> clientById = byId(clients.findAllById(distinct(page, Deal::getClientId)), Client::getId);
        Map<Long, User> userById = byId(users.findAllById(distinct(page, Deal::getCreatedByUserId)), User::getId);

        return page.stream().map(d -> {
            FirmBranch b = branchById.get(d.getFirmBranchId());
            RealEstateFirm f = b == null ? null : firmById.get(b.getRealEstateFirmId());
            Client c = clientById.get(d.getClientId());
            Property p = propertyById.get(d.getPropertyId());
            User u = userById.get(d.getCreatedByUserId());
            return DealListItemDto.from(d,
                    f == null ? null : f.getName(),
                    b == null ? null : b.getName(),
                    c == null ? null : c.getDisplayName(),
                    p == null ? null : DealService.formatAddress(p),
                    p == null ? null : p.getPropertyType(),
                    u == null ? null : u.getEmail(),
                    u == null ? null : u.getFullName());
        }).toList();
    }

    private static List<Long> distinct(List<Deal> ds, Function<Deal, Long> fn) {
        return ds.stream().map(fn).filter(Objects::nonNull).distinct().toList();
    }

    private static <T> Map<Long, T> byId(Collection<T> rows, Function<T, Long> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity(), (a, b) -> a));
    }

    private static UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
