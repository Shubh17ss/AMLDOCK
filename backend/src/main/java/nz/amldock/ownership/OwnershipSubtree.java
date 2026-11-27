package nz.amldock.ownership;

import nz.amldock.common.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * An owner and everyone beneath it: the shareholders of a company, the trustees of a trust, and
 * theirs in turn. What the owner picker shows before an entity is copied, and what the copy takes.
 *
 * <p>Ownership is a graph, not strictly a tree: one person can hold shares in two companies of the
 * same structure. Each node is collected once however many paths reach it, and every edge between
 * collected nodes is kept, so a copy reproduces the shape exactly.
 */
@Component
public class OwnershipSubtree {

    /**
     * Far beyond any real structure, low enough that one click cannot copy a runaway graph. Beyond
     * it the copy is refused rather than cut short: half a structure copied is worse than none.
     */
    public static final int MAX_NODES = 100;

    /**
     * @param root  the owner walked from
     * @param nodes the root first, then everyone beneath it, nearest first
     * @param edges every edge whose parent is in {@code nodes} (so its child is too)
     */
    public record Walk(OwnershipNode root, List<OwnershipNode> nodes, List<OwnershipEdge> edges) {}

    /** One owner beneath the root, as the picker lists them: indented by depth, in tree order. */
    public record Line(Long nodeId, String displayName, NodeType nodeType, int depth,
                       BigDecimal percentage, EdgeRole role) {}

    private final OwnershipNodeRepository nodes;
    private final OwnershipEdgeRepository edges;

    public OwnershipSubtree(OwnershipNodeRepository nodes, OwnershipEdgeRepository edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    /** Breadth-first, one query per level. Throws past {@link #MAX_NODES}. */
    public Walk below(OwnershipNode root) {
        List<Long> order = new ArrayList<>(List.of(root.getId()));
        Set<Long> collected = new HashSet<>(order);
        List<OwnershipEdge> found = new ArrayList<>();
        List<Long> frontier = List.of(root.getId());
        while (!frontier.isEmpty()) {
            List<Long> next = new ArrayList<>();
            for (OwnershipEdge e : edges.findAllByParentNodeIdIn(frontier)) {
                found.add(e);
                if (collected.add(e.getChildNodeId())) {
                    order.add(e.getChildNodeId());
                    next.add(e.getChildNodeId());
                }
            }
            if (order.size() > MAX_NODES) {
                throw new BadRequestException("\"" + root.getDisplayName() + "\" has more than " + MAX_NODES
                        + " owners beneath it, which is more than can be copied in one go");
            }
            frontier = next;
        }
        Map<Long, OwnershipNode> byId = nodes.findAllById(order).stream()
                .collect(Collectors.toMap(OwnershipNode::getId, Function.identity()));
        List<OwnershipNode> ordered = order.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
        return new Walk(root, ordered, found);
    }

    /**
     * Everyone beneath the root, depth-first in the order the structure shows them, each once at
     * the first place it is reached, with the share and role it is held by there.
     */
    public List<Line> outline(Walk walk) {
        Map<Long, OwnershipNode> byId = walk.nodes().stream()
                .collect(Collectors.toMap(OwnershipNode::getId, Function.identity()));
        Map<Long, List<OwnershipEdge>> byParent = new HashMap<>();
        for (OwnershipEdge e : walk.edges()) {
            byParent.computeIfAbsent(e.getParentNodeId(), k -> new ArrayList<>()).add(e);
        }
        byParent.values().forEach(list -> list.sort(Comparator
                .comparing(OwnershipEdge::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(OwnershipEdge::getId)));

        List<Line> out = new ArrayList<>();
        Set<Long> placed = new HashSet<>(Set.of(walk.root().getId()));
        visit(walk.root().getId(), 1, byParent, byId, placed, out);
        return out;
    }

    private static void visit(Long parentId, int depth, Map<Long, List<OwnershipEdge>> byParent,
                              Map<Long, OwnershipNode> byId, Set<Long> placed, List<Line> out) {
        for (OwnershipEdge e : byParent.getOrDefault(parentId, List.of())) {
            OwnershipNode child = byId.get(e.getChildNodeId());
            if (child == null || !placed.add(child.getId())) continue;
            out.add(new Line(child.getId(), child.getDisplayName(), child.getNodeType(), depth,
                    e.getPercentage(), e.getRole()));
            visit(child.getId(), depth + 1, byParent, byId, placed, out);
        }
    }
}
