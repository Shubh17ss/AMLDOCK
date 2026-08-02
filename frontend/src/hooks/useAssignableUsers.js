import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUsers } from '../api/users.js';
import { isBranchLevel } from '../auth/roles.js';

/**
 * The staff who may be assigned training in a given branch: active, branch-level, and actually
 * in that branch.
 *
 * The users endpoint deliberately also returns branchless firm-level staff when filtered by
 * branch (they oversee every branch), and those are exactly the people the server refuses to
 * assign — so the filter belongs here, shared by every picker, rather than being repeated.
 *
 * Returns the react-query result plus a filtered, name-sorted `users` array.
 */
export function useAssignableUsers(firmId, branchId) {
  const query = useQuery({
    queryKey: ['users', firmId ?? null, branchId ?? null],
    queryFn: () => listUsers({ firmId, branchId }),
    enabled: Boolean(firmId && branchId),
  });

  const users = useMemo(() => (query.data ?? [])
    .filter((u) => u.active && isBranchLevel(u.role) && u.firmBranchId === branchId)
    .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '')),
  [query.data, branchId]);

  return {
    ...query,
    users,
    /** True once we know the branch simply has nobody who can be assigned. */
    empty: !query.isLoading && users.length === 0 && Boolean(firmId && branchId),
  };
}
