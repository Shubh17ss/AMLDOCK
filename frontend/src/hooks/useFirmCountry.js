import { useQuery } from '@tanstack/react-query';
import { getFirm } from '../api/firms.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * The signed-in user's reporting entity country ('NZ' | 'AU'), or null while unknown.
 *
 * <p>Deliberately not read off the dashboard scope. That scope is a *view filter* — it is null
 * for ROOT by design, a selection persisted before V25 carries no country at all, and it is
 * seeded asynchronously by a component that may not even be mounted. Reading a filter to answer
 * an identity question is how `useCurrency` ends up silently defaulting to NZD.
 *
 * <p>The query key matches ScopeSelector's, so for anyone with the sidebar mounted this resolves
 * straight out of the cache without a second request.
 *
 * <p>Null is a real answer rather than a loading artefact: callers degrade (free-text address
 * entry) instead of blocking. Correctness does not depend on this — the server stamps a
 * property's country from the firm regardless of what the client believes.
 */
export function useFirmCountry() {
  const { user } = useAuth();
  const firmId = user?.realEstateFirmId ?? null;

  const q = useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => getFirm(firmId),
    enabled: Boolean(firmId),
    staleTime: Infinity,   // a reporting entity does not change jurisdiction
  });

  return { country: q.data?.country ?? null, loading: q.isFetching, firmId };
}
