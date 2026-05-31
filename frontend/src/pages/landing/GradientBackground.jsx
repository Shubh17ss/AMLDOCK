/**
 * Soft multi-blob gradient mesh that sits behind the entire landing page.
 * Mimics the calm "Persona" aesthetic — large blurred ovals at low opacity, never busy.
 */
export function GradientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-32 -left-32 h-[34rem] w-[34rem] rounded-full bg-trust-100 opacity-70 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full bg-warm-100 opacity-60 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-trust-50 opacity-80 blur-3xl" />
    </div>
  );
}
