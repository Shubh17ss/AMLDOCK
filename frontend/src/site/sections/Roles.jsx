const ROLES = [
  {
    name: 'Agents and their assistants',
    lead: 'Start the file where the listing starts.',
    points: [
      'Record the property and the client',
      'Build the ownership structure behind them',
      'Upload identity documents, or capture them with a phone camera',
      'Hear by email when the status changes',
    ],
  },
  {
    name: 'Compliance officers and senior managers',
    lead: 'Review with the whole file in front of you.',
    points: [
      'Check each owner against their documents',
      'Set the risk rating, or override it with a reason',
      'Put a listing on hold or send it back to the agent',
      'Verify, which saves a numbered version',
    ],
  },
  {
    name: 'Managers, auditors and finance',
    lead: 'See what you need to, and no more.',
    points: [
      'Sales managers follow their own branch',
      'Auditors read everything and change nothing',
      'Finance keeps the fund transaction register',
    ],
  },
];

export function Roles() {
  return (
    <section className="site-section">
      <div className="site-wrap">
        <div className="site-head">
          <h2 className="site-h2" style={{ maxWidth: '16em' }}>One file, worked on by the people responsible for it.</h2>
        </div>
        <div className="site-roles">
          {ROLES.map((r) => (
            <div key={r.name} className="site-role">
              <h3 className="site-h3">{r.name}</h3>
              <p className="site-body">{r.lead}</p>
              <ul>{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
