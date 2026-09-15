/*
 * WHERE A ROW SITS AMONG ITS SIBLINGS.
 *
 * The tree has never stored an order. It draws top-level owners sorted by node id and each owner's
 * children sorted by edge id — that is, in the order they happened to be created. Nobody chose it,
 * and until now nobody could: there was no gesture that meant "put this one above that one".
 *
 * Dragging a row into the gap between two others is that gesture, so the answer needs somewhere to
 * live. Creation order is a reasonable default and stays the fallback; this only records the cases
 * where somebody has said otherwise.
 *
 * ON THE EDGE, NOT ONLY THE NODE. The structure is a graph — a person can be a shareholder in two
 * subsidiaries — so a node is drawn once per incoming edge, and its position under one owner has
 * nothing to do with its position under another. Position therefore belongs to the link. A node at
 * the top of the chain has no incoming link, which is why the node carries one too; that column is
 * read for top-level rows and ignored for every other.
 *
 * NULLABLE, AND NOT BACKFILLED. NULL means "never positioned", and the sort falls through to the id
 * — which is exactly what every existing structure does today, so nothing moves when this lands. A
 * reorder writes a dense 0..n-1 over one parent's children at once, so the values only become
 * meaningful for a sibling set somebody has actually arranged.
 *
 * NO UNIQUENESS CONSTRAINT. Two siblings holding the same position is a tie, not a contradiction,
 * and the id breaks it. A UNIQUE (parent_node_id, sort_order) would also make the natural way to
 * write a reorder — assign 0..n-1 in one statement — fail on any intermediate state.
 *
 * THE PAIRED ALTER. As V44 spelled out: V41 built every deal_version_* table with
 * CREATE TABLE x (LIKE y EXCLUDING ALL), a one-time clone with nothing keeping it in step, while
 * OwnershipEdgeFields and OwnershipNodeFields are @MappedSuperclasses shared by the live entity and
 * its version twin. Hibernate runs ddl-auto: validate, so a column added to one twin and not the
 * other fails startup. EXCLUDING ALL left the clones without constraints, and they get none here
 * either — a frozen version is written once by the server and never edited.
 */

ALTER TABLE ownership_edge
    ADD COLUMN sort_order INT,
    ADD CONSTRAINT chk_ownership_edge_sort_order
        CHECK (sort_order IS NULL OR sort_order >= 0);

ALTER TABLE deal_version_edge
    ADD COLUMN sort_order INT;

ALTER TABLE ownership_node
    ADD COLUMN sort_order INT,
    ADD CONSTRAINT chk_ownership_node_sort_order
        CHECK (sort_order IS NULL OR sort_order >= 0);

ALTER TABLE deal_version_node
    ADD COLUMN sort_order INT;
