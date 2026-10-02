import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  closeDeal, holdDeal, overrideDeal, reopenDeal, revertDeal, submitDealForReview,
  uncloseDeal, verifyDeal,
} from '../../api/deals.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { dealStatusLabel } from '../../data/dealStatus.js';

/** What each move is called once it has happened, and how loudly to say it. */
const SAID = {
  submit:   { message: 'Sent to compliance for review', severity: 'success' },
  verify:   { message: 'Deal verified', severity: 'success' },
  hold:     { message: 'Deal put on hold', severity: 'warning' },
  revert:   { message: 'Sent back to the broker', severity: 'warning' },
  close:    { message: 'Deal closed', severity: 'success' },
  reopen:   { message: 'Reopened for changes — the signed-off version is saved', severity: 'warning' },
  unclose:  { message: 'Reopened from closed — close it again to record the new figures', severity: 'warning' },
};

/**
 * Every status change a deal can be put through, from wherever it is asked for.
 *
 * <p>One mutation for all eight verbs: they only ever differ in which endpoint they hit, so
 * `DealStatusDialog` picks a row out of `STATUS_TRANSITIONS` and this reads the row's `action`.
 *
 * <p>A hook rather than code on the review screen, because the deals register now offers the
 * same dialog from a row menu. A second copy of the switch would be a second thing to remember:
 * `unclose` was added to it when closing became reversible, and a copy made before that would
 * still be missing it today.
 *
 * <p>`onDone(transition)` is the one thing that differs between the two callers. The review
 * screen navigates back to the list after verifying or sending back, because both end that
 * reviewer's involvement; a row menu is already on the list and stays where it is.
 *
 * <p>A failure still rejects the promise, so the dialog that asked shows it inline where the
 * click was. `onFailed` is for a caller that also keeps a banner of its own.
 *
 * @param dealId   the deal being moved
 * @param onDone   called after a successful move, with the transition that was applied
 * @param onFailed called with a human-readable message when the move is refused
 */
export function useDealStatusAction(dealId, { onDone, onFailed } = {}) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ transition, reason }) => {
      switch (transition.action) {
        case 'submit': return submitDealForReview(dealId);
        case 'hold':   return holdDeal(dealId, reason);
        case 'verify': return verifyDeal(dealId, reason);
        case 'revert': return revertDeal(dealId, reason);
        case 'close':  return closeDeal(dealId, transition.sale);
        case 'reopen': return reopenDeal(dealId, reason);
        case 'unclose': return uncloseDeal(dealId, reason);
        default:       return overrideDeal(dealId, transition.to, reason);
      }
    },
    onSuccess: (_, vars) => {
      // One prefix, every deals query. This used to name four keys and still missed
      // ['deals','list'] — the register's — so acting on a deal left the list you came from
      // showing the old status. TanStack matches key prefixes, so the root covers the detail,
      // the queues and the register at once.
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['dealNotes', dealId] });
      // Verifying writes a version and reopening stamps one, so the menu is stale after either.
      // Named unconditionally rather than per action: an override can do both too, and working
      // out which is exactly the sort of thing that goes wrong later.
      qc.invalidateQueries({ queryKey: ['dealVersions', dealId] });
      // The Transaction Monitoring tab and the close dialog both read this, and closing is
      // exactly when it changes.
      qc.invalidateQueries({ queryKey: ['dealSale', dealId] });

      showToast(SAID[vars.transition.action]
        ?? { message: `Status overridden to ${dealStatusLabel(vars.transition.to)}`, severity: 'warning' });

      onDone?.(vars.transition);
    },
    onError: (e) => onFailed?.(e.response?.data?.message || 'Could not update the status'),
  });
}
