// What the app does, grouped the way its own menu groups it (navigation/moduleRegistry.jsx).
// Only modules that are built are listed — placeholders in the registry (PEPs, Management
// Reports) are left out until they exist.
export const MODULE_GROUPS = [
  {
    id: 'cdd',
    name: 'Customer due diligence',
    intro: 'The working file for every listing, and the registers that are drawn from it.',
    modules: [
      { name: 'Listing register', desc: 'Every listing with its status, from first capture to closed. Each role sees the listings it is responsible for.' },
      { name: 'Ownership structure', desc: 'Trusts, companies and individuals, nested as deep as the structure goes. Each one carries its own documents and its own verification.' },
      { name: 'Risk rating', desc: 'A rating worked out from the answers on the file, with the factors that drove it. A reviewer can override it and must say why.' },
      { name: 'Beneficial owners', desc: 'Every individual behind your listings in one register, with how they are connected and whether they are verified.' },
      { name: 'Overseas residents', desc: 'Owners who live, or are registered, outside New Zealand, and a count of those nobody has asked yet.' },
      { name: 'CDD exceptions', desc: 'Every owner accepted despite a gap in the evidence, with the reason and the listing it was on.' },
      { name: 'Assurance', desc: 'A second look at signed-off files, recorded against the exact version that was verified.' },
    ],
  },
  {
    id: 'documents',
    name: 'Programme documents',
    intro: 'The two documents an AML/CFT programme rests on, kept with their history.',
    modules: [
      { name: 'Risk assessment', desc: 'Upload each revision. Earlier versions stay on record.' },
      { name: 'Compliance programme', desc: 'The current programme and every version before it.' },
    ],
  },
  {
    id: 'training',
    name: 'AML training',
    intro: 'Who was trained, on what, and when.',
    modules: [
      { name: 'Staff training', desc: 'Sessions, courses and providers for a branch, with completion recorded per person.' },
      { name: 'My training', desc: 'Each staff member’s own courses and sessions, including course material and questionnaires.' },
    ],
  },
  {
    id: 'reporting',
    name: 'Reporting',
    intro: 'The registers behind your reporting obligations.',
    modules: [
      { name: 'Suspicious activity register', desc: 'Record each suspicious activity and whether it was reported to the Financial Intelligence Unit.' },
      { name: 'International fund transactions', desc: 'Overseas transfers tied to a listing, with supporting evidence.' },
      { name: 'Annual report', desc: 'File each year’s report and keep prior years to hand.' },
    ],
  },
  {
    id: 'oversight',
    name: 'Oversight',
    intro: 'Who can do what, and a record of what they did.',
    modules: [
      { name: 'Users and roles', desc: 'Invite staff and set their role. Access follows the role and the branch.' },
      { name: 'Notifications', desc: 'Choose who is emailed when a listing is created or changes status, branch by branch.' },
      { name: 'Audit log', desc: 'Every recorded action, with who did it and when.' },
    ],
  },
];
