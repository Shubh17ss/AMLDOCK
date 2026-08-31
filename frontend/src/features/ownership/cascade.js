/**
 * Which nodes a delete would take with it.
 *
 * <p>The ownership structure is a graph, not a tree — a person can be a shareholder in two
 * subsidiaries — so "everything under it" is not the same as "every descendant". A node below the
 * one being deleted survives if anything outside the deleted set still owns it.
 *
 * <p>This mirrors `OwnershipService.doomedBy` on the server, which is the authority: it recomputes
 * the set and performs the delete. The copy here exists only so the confirm dialog can say how many
 * nodes are going before anyone commits to it, using the graph the builder already holds.
 */
export function collectCascade(tree, nodeId) {
  const childrenOf = new Map();
  const parentsOf = new Map();
  (tree?.edges ?? []).forEach((e) => {
    if (!childrenOf.has(e.parentNodeId)) childrenOf.set(e.parentNodeId, []);
    childrenOf.get(e.parentNodeId).push(e.childNodeId);
    if (!parentsOf.has(e.childNodeId)) parentsOf.set(e.childNodeId, []);
    parentsOf.get(e.childNodeId).push(e.parentNodeId);
  });

  // Everything reachable below the target. The set doubles as the seen-set, which is what stops a
  // diamond being walked twice and a cycle spinning.
  const doomed = new Set([nodeId]);
  const frontier = [nodeId];
  while (frontier.length) {
    const current = frontier.pop();
    (childrenOf.get(current) ?? []).forEach((child) => {
      if (!doomed.has(child)) { doomed.add(child); frontier.push(child); }
    });
  }

  // Then release anything still held from outside, to a fixpoint: releasing one node can release
  // what hangs off it, and the traversal above can reach a child before one of its parents.
  let released = true;
  while (released) {
    released = false;
    [...doomed].forEach((id) => {
      if (id === nodeId) return;                       // the target goes whatever holds it
      const heldElsewhere = (parentsOf.get(id) ?? []).some((p) => !doomed.has(p));
      if (heldElsewhere) { doomed.delete(id); released = true; }
    });
  }
  return doomed;
}
