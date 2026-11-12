import { useQuery } from '@tanstack/react-query';
import { listFirms } from '../api/firms.js';

/**
 * The public id of a reporting entity, from its numeric id. The /firms and /branches endpoints
 * name entities only by public id, while users, deals and filters still carry the numeric one.
 *
 * <p>Answered from the shared ['firms'] list: every entity for ROOT and AUDIT, the user's own for
 * everyone else — which is every entity either of them could ask about. Null until it loads.
 */
export function useFirmRef(firmId) {
  const q = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: firmId != null && firmId !== '' });
  return q.data?.find((f) => f.id === Number(firmId))?.publicId ?? null;
}
