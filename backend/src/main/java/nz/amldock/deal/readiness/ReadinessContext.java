package nz.amldock.deal.readiness;

import nz.amldock.deal.Deal;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.Property;
import nz.amldock.property.PropertyRepository;

import java.util.List;

/**
 * The deal a readiness run is about, with what the checks read off it loaded at most once.
 *
 * <p>Lazy, so a check that only reads the deal row costs no query, and shared, so two checks that
 * both need the ownership nodes do not each fetch them.
 */
public class ReadinessContext {

    private final Deal deal;
    private final PropertyRepository properties;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;

    private Property property;
    private boolean propertyLoaded;
    private List<OwnershipNode> nodeList;

    ReadinessContext(Deal deal, PropertyRepository properties,
                     OwnershipStructureRepository structures, OwnershipNodeRepository nodes) {
        this.deal = deal;
        this.properties = properties;
        this.structures = structures;
        this.nodes = nodes;
    }

    public Deal deal() { return deal; }

    /** The deal's property, or null if it has none. */
    public Property property() {
        if (!propertyLoaded) {
            property = deal.getPropertyId() == null ? null
                    : properties.findById(deal.getPropertyId()).orElse(null);
            propertyLoaded = true;
        }
        return property;
    }

    /** Every node on the deal's ownership structure, detached ones included. Empty with no structure. */
    public List<OwnershipNode> nodes() {
        if (nodeList == null) {
            nodeList = structures.findByDealId(deal.getId())
                    .map(s -> nodes.findAllByOwnershipStructureIdOrderByIdAsc(s.getId()))
                    .orElse(List.of());
        }
        return nodeList;
    }
}
