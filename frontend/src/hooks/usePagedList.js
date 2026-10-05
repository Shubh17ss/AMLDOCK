import { useEffect, useState } from 'react';

/**
 * Page, page size and a debounced search for a list the server pages.
 *
 * `search` is what the box shows and updates on every keystroke; `q` is what goes to the server,
 * 300 ms after typing stops, so a word is one request rather than one per letter. The page goes
 * back to 0 whenever the search or any of `resetOn` changes: page 4 of a new filter is usually
 * empty, and the user meant "show me these from the start".
 *
 * @param resetOn values that, when changed, mean a different list (status tab, firm, branch...)
 */
export function usePagedList({ defaultSize = 25, resetOn = [] } = {}) {
  const [page, setPage] = useState(0);
  const [size, setSizeState] = useState(defaultSize);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset during render rather than in an effect, so the request for the new filter already asks
  // for page 0 instead of first fetching the old page number of the new list.
  const listKey = JSON.stringify([q, ...resetOn]);
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (listKey !== prevListKey) {
    setPrevListKey(listKey);
    setPage(0);
  }

  const setSize = (s) => { setSizeState(s); setPage(0); };

  return { page, setPage, size, setSize, search, setSearch, q, params: { page, size, q: q || undefined } };
}
