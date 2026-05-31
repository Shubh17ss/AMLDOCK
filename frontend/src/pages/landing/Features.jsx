import { OwnershipTreeMock } from './mockups/OwnershipTreeMock.jsx';
import { EvidenceMock } from './mockups/EvidenceMock.jsx';
import { AuditTrailMock } from './mockups/AuditTrailMock.jsx';

export function Features() {
  return (
    <section id="product" className="relative mt-20">
      <div className="mx-auto max-w-7xl px-6 pt-24 text-center">
        <h2 className="mt-3 font-baskerville text-3xl font-bold text-trust-900 sm:text-4xl">
          Three jobs. One quiet workspace.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl font-baskerville text-lg text-trust-700">
          Brokers prepare. Compliance officers verify. Managers decide. AMLDOCK keeps
          everyone on the same page — literally.
        </p>
      </div>

      <FeatureRow
        eyebrow="Ownership"
        title="Map nested ownership in minutes — not afternoons."
        body="Build the structure that actually reflects the deal: trusts with trustees, companies with shareholders, partners and beneficiaries — with percentages and roles on every edge. Cycle and percentage validation come standard."
        bullets={[
          'Natural persons, NZ companies, trusts, partnerships',
          'Trustee / beneficiary / shareholder / partner edges',
          'Cycle detection on save',
        ]}
        ctaHref="/login"
        ctaLabel="Open the workspace"
        mockup={<OwnershipTreeMock />}
      />

      <FeatureRow
        reverse
        eyebrow="Evidence"
        title="Every document where you need it, never where you don't."
        body="Driver licences, passports, sale agreements, trust deeds — uploaded once, attached to the right node, reviewable side-by-side with the ownership tree. S3-backed, presigned URLs, no proxying."
        bullets={[
          'Deal-level and per-node attachments',
          'PDF + image preview, side-by-side',
          'Short-lived presigned downloads only',
        ]}
        ctaHref="/login"
        ctaLabel="See the evidence room"
        mockup={<EvidenceMock />}
      />

      <FeatureRow
        eyebrow="Decisions"
        title="Approvals you can defend in writing."
        body="Every claim, approval, rejection, and override leaves an immutable record — with actor, IP, before/after, and decision notes. Manager override is one click, always justified, always visible."
        bullets={[
          'Per-deal audit panel + admin-wide search',
          'Approve / Reject / Override with required notes',
          'Filter by actor, action, entity, date range',
        ]}
        ctaHref="/login"
        ctaLabel="Explore the audit log"
        mockup={<AuditTrailMock />}
      />
    </section>
  );
}

function FeatureRow({ eyebrow, title, body, bullets, ctaHref, ctaLabel, mockup, reverse }) {
  return (
    <div className="mx-auto mt-20 grid max-w-7xl items-center gap-12 px-6 md:grid-cols-12 md:gap-16 md:mt-28">
      <div className={['md:col-span-5', reverse ? 'md:order-2' : ''].join(' ')}>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-trust-500">
          {eyebrow}
        </p>
        <h3 className="mt-2 font-baskerville text-2xl font-bold leading-tight text-trust-900 sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 font-baskerville text-base leading-relaxed text-trust-700">{body}</p>
        <ul className="mt-5 space-y-2 text-sm text-trust-700">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-trust-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <a
          href={ctaHref}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-trust-700 hover:text-trust-900"
        >
          {ctaLabel} <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className={['relative md:col-span-7', reverse ? 'md:order-1' : ''].join(' ')}>
        <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-trust-100/50 via-white/0 to-warm-100/40 blur-2xl" />
        {mockup}
      </div>
    </div>
  );
}
