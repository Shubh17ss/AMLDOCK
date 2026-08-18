// Loader for the AddressFinder address-autocomplete widget.
//
// The script is injected on first use rather than sitting in index.html, so a third-party
// request isn't on the critical path of every page — only the deal form needs it.
//
// VITE_ADDRESSFINDER_KEY is the widget key, which is public and domain-restricted: it is safe
// in the browser bundle, but only works from a host whitelisted in the AddressFinder
// dashboard. If lookups return nothing on a new environment, that whitelist is the first thing
// to check. (The separate Address Verification REST API uses a key *and secret* and cannot be
// called from here — that would need a backend proxy.)

import { useEffect, useState } from 'react';

const SRC = 'https://api.addressfinder.io/assets/v3/widget.js';

export const ADDRESSFINDER_KEY = import.meta.env.VITE_ADDRESSFINDER_KEY || '';

// Module-level so React StrictMode's double-effect and any remount share one injection
// instead of racing two script tags.
let loader = null;

export function loadAddressFinder() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.AddressFinder) return Promise.resolve(window.AddressFinder);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => {
      if (window.AddressFinder) resolve(window.AddressFinder);
      else reject(new Error('AddressFinder loaded but exposed no widget'));
    };
    s.onerror = () => {
      loader = null; // let a later mount retry — this is usually a transient network failure
      reject(new Error('Could not load AddressFinder'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * Loads the widget script and reports where it got to.
 *
 * @returns { status, error } — status is 'disabled' (no key configured), 'loading', 'ready'
 *          or 'error'. Callers fall back to manual address entry for anything but 'ready',
 *          so a missing key or a blocked script degrades rather than blocking the broker.
 */
export function useAddressFinder() {
  const [status, setStatus] = useState(ADDRESSFINDER_KEY ? 'loading' : 'disabled');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ADDRESSFINDER_KEY) return undefined;
    let cancelled = false;
    loadAddressFinder()
      .then(() => { if (!cancelled) setStatus('ready'); })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  return { status, error };
}
