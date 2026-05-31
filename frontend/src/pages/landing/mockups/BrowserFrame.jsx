/**
 * Lightweight stylised browser chrome used to frame product mockups on the landing.
 * Optional `label` shows in the address bar so each mockup feels like a real screen.
 */
export function BrowserFrame({ label, children, className = '' }) {
  return (
    <div
      className={[
        'overflow-hidden rounded-2xl bg-white ring-1 ring-trust-100',
        'shadow-2xl shadow-trust-900/15',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-2 border-b border-trust-100 bg-trust-50/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
        {label && (
          <div className="ml-3 truncate rounded-md bg-white/80 px-2.5 py-1 text-[0.7rem] font-mono tracking-tight text-trust-500 ring-1 ring-trust-100">
            {label}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
