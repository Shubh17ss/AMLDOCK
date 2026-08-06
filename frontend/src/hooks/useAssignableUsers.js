import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUsers } from '../api/users.js';
import { isBranchLevel, isFirmLevel } from '../auth/roles.js';

const byName = (a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '');

/**
 * The staff who may be assigned training in a given branch, split by tier:
 *   `branchUsers` — the branch's own staff;
 *   `firmUsers`   — the firm's compliance officers and senior managers, who sit in no branch
 *                   but oversee them all and have their own training to do.
 *
 * The users endpoint deliberately returns both when filtered by branch (see
 * UserService.findVisible), and ROOT drops out on its own — it has no firm, so the firm filter
 * never matches it.
 *
 * Returns the react-query result plus the two arrays and their name-sorted concatenation.
 */
export function useAssignableUsers(firmId, branchId) {
  const query = useQuery({
    queryKey: ['users', firmId ?? null, branchId ?? null],
    queryFn: () => listUsers({ firmId, branchId }),
    enabled: Boolean(firmId && branchId),
  });

  const { branchUsers, firmUsers } = useMemo(() => {
    const all = (query.data ?? []).filter((u) => u.active);
    return {
      branchUsers: all
        .filter((u) => isBranchLevel(u.role) && u.firmBranchId === branchId)
        .sort(byName),
      firmUsers: all
        .filter((u) => isFirmLevel(u.role) && u.realEstateFirmId === firmId)
        .sort(byName),
    };
  }, [query.data, firmId, branchId]);

  const users = useMemo(() => [...branchUsers, ...firmUsers], [branchUsers, firmUsers]);

  return {
    ...query,
    branchUsers,
    firmUsers,
    users,
    /** True once we know there is simply nobody who can be assigned. */
    empty: !query.isLoading && users.length === 0 && Boolean(firmId && branchId),
  };
}
