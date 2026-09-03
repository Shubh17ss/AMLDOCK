import { useState } from 'react';
import { Switch } from '@mui/material';

/**
 * A switch that moves when you click it.
 *
 * <p>Every toggle in this app used to bind `checked` straight to server state and do nothing to
 * that state until the mutation resolved and a refetch landed — so the thumb sat still through a
 * PATCH *and* a full list re-fetch before it moved. On a good connection that reads as a sticky
 * control; on a slow one it reads as broken, and the usual response is to click again, which
 * toggles it back.
 *
 * <p>The fix is to show what the user just asked for until the server has caught up. That override
 * lives here rather than in each caller's mutation because the call sites keep their state in five
 * different shapes — a users list, a firms list, a branches list, a notification grid — and an
 * optimistic cache write for each would be five separate chances to get the rollback wrong. This
 * needs to know nothing about any of them.
 *
 * <p>A refused change corrects itself: the override is dropped when `onToggle` settles, and
 * `checked` still holds whatever the server actually thinks.
 *
 * @param onToggle async, receiving the requested value. **It must not resolve until the query cache
 *                 reflects the result** — `await mutateAsync(...)` then `await
 *                 qc.invalidateQueries(...)`, which resolves once refetches settle. Resolving
 *                 earlier drops the override while `checked` is still stale, and the thumb flicks
 *                 back and then forward again.
 */
export function InstantSwitch({ checked, onToggle, disabled = false, ...rest }) {
  // The value the user asked for, held only until the server agrees. Null means "show the truth".
  const [pending, setPending] = useState(null);

  const handleChange = async (event) => {
    const next = event.target.checked;
    setPending(next);
    try {
      await onToggle(next);
    } catch {
      // Swallowed deliberately. The caller owns error reporting — it knows what failed and has the
      // toast; all this needs to do is stop showing a change that did not happen, which the
      // `finally` below does either way.
    } finally {
      setPending(null);
    }
  };

  return (
    <Switch
      {...rest}
      checked={pending ?? checked}
      // Deliberately not disabled while the request is in flight. Disabling mid-gesture is what
      // makes the notification toggles feel frozen, and it locks out the one person best placed to
      // fix a mis-click. `disabled` here means "you may not change this", not "wait".
      disabled={disabled}
      onChange={handleChange}
    />
  );
}
