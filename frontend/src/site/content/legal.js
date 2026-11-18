// The text of the privacy policy and the terms and conditions.
//
// SAMPLE TEXT. This is placeholder wording so the pages and footer links exist. It has not been
// reviewed by a lawyer and makes no commitments that were checked against how the business runs.
// Replace it with reviewed text, and set LAST_UPDATED, before the site goes live.
//
// Shape: each document is a list of clauses; a clause is a title and blocks, where a block is a
// paragraph (string) or a bullet list (array of strings). Clause numbers are added by the page.
import { CONTACT_EMAIL } from './company.js';

export const LAST_UPDATED = '14 November 2026';

export const PRIVACY = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    blocks: [
      'AMLDOCK Ltd (“AMLDOCK”, “we”, “us”) provides software that real-estate agencies use to carry out and record customer due diligence. This policy explains what personal information we handle, why, and what you can do about it.',
      'We handle personal information in two different capacities. For visitors to this website and for the people who hold accounts with us, we decide how the information is used. For the information an agency records about its own clients, the agency decides, and we handle it on the agency’s instructions.',
    ],
  },
  {
    id: 'what-we-collect',
    title: 'Information we collect',
    blocks: [
      'From visitors and account holders we collect:',
      [
        'Contact details you give us, such as your name, work email address and agency, when you enquire or are given an account.',
        'Sign-in information, such as the email address a one-time code is sent to and the time you signed in.',
        'A record of the actions you take in the product, kept as part of the audit log.',
      ],
      'On behalf of agencies, the product stores what the agency enters about its clients. This can include names, dates of birth, addresses, identity documents and information about ownership of companies and trusts.',
    ],
  },
  {
    id: 'how-we-use-it',
    title: 'How we use information',
    blocks: [
      [
        'To provide the product and keep it secure.',
        'To sign you in and to confirm that actions were taken by the right person.',
        'To reply to enquiries and to tell account holders about changes to the service.',
        'To meet our legal obligations.',
      ],
      'We do not sell personal information, and we do not use the information agencies record about their clients for our own purposes.',
    ],
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    blocks: [
      'We share personal information only with service providers who help us run the product, such as hosting and email delivery, and only as far as they need it to do that work. They are required to keep it confidential and secure.',
      'We may also disclose information where the law requires it.',
    ],
  },
  {
    id: 'storage-and-security',
    title: 'Storage and security',
    blocks: [
      'We take reasonable steps to protect personal information from loss and from unauthorised access, use or disclosure. Access within the product is limited by role, documents are opened through links that expire, and actions are recorded.',
      'No system is completely secure. If we become aware of a privacy breach that is likely to cause serious harm, we will notify the people affected and the Privacy Commissioner as the law requires.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    blocks: [
      'We keep account information for as long as the account is open and for a reasonable period afterwards. Information an agency records is kept for as long as the agency instructs, which will reflect the record-keeping periods that apply to it under anti-money laundering law.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    blocks: [
      'Under the Privacy Act 2020 you may ask for a copy of the personal information we hold about you and ask us to correct it. If your information was recorded by an agency as part of its due diligence, please ask that agency first; we will help it respond.',
      'If you are not satisfied with how we have handled a request, you can complain to the Office of the Privacy Commissioner.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    blocks: [
      'We may update this policy from time to time. The date at the top of the page shows when it last changed. If a change is significant we will tell account holders directly.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    blocks: [
      { text: 'Questions about this policy or about your information can be sent to', email: CONTACT_EMAIL },
    ],
  },
];

export const TERMS = [
  {
    id: 'agreement',
    title: 'These terms',
    blocks: [
      'These terms apply to your use of the AMLDOCK website and product. By using either, you agree to them. If you are using the product on behalf of an agency, you confirm that you are authorised to accept these terms for it.',
    ],
  },
  {
    id: 'the-service',
    title: 'The service',
    blocks: [
      'AMLDOCK is a record-keeping tool. It helps an agency carry out and record customer due diligence, keep its programme documents, and maintain related registers.',
      'AMLDOCK does not give legal or compliance advice, and using it does not by itself make an agency compliant. Each agency remains responsible for its own obligations under the Anti-Money Laundering and Countering Financing of Terrorism Act 2009, including the judgements recorded in the product.',
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts',
    blocks: [
      [
        'Accounts are created by an agency or by us; each belongs to one person and must not be shared.',
        'You are responsible for keeping access to your email secure, because sign-in codes are sent to it.',
        'Tell us promptly if you believe someone else has used your account.',
      ],
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    blocks: [
      'You agree not to:',
      [
        'use the product for anything unlawful;',
        'try to access information you are not authorised to see;',
        'interfere with the product’s operation or security;',
        'upload material you do not have the right to upload.',
      ],
    ],
  },
  {
    id: 'your-data',
    title: 'Your data',
    blocks: [
      'The agency owns the information it puts into the product. It gives us permission to store and process that information in order to provide the service, and it is responsible for having the right to record it.',
      'How we handle personal information is described in our privacy policy.',
    ],
  },
  {
    id: 'fees',
    title: 'Fees',
    blocks: [
      'Fees for a paid plan are those agreed when the plan is taken up. Unless we agree otherwise, fees are charged in advance and are not refundable for a period already begun.',
    ],
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    blocks: [
      'We aim to keep the product available but do not promise that it will be uninterrupted or free of errors. We may change or withdraw features, and will give reasonable notice of a change that materially reduces what the product does.',
    ],
  },
  {
    id: 'liability',
    title: 'Liability',
    blocks: [
      'To the extent the law allows, we are not liable for indirect or consequential loss, or for loss arising from decisions an agency makes using the product. Nothing in these terms limits any right you have under the Consumer Guarantees Act 1993 or other law that cannot be excluded.',
    ],
  },
  {
    id: 'ending',
    title: 'Ending the agreement',
    blocks: [
      'An agency may stop using the product at any time. We may suspend or end access if these terms are seriously or repeatedly breached. When an agreement ends, we will make the agency’s information available to it for a reasonable period so that it can meet its record-keeping obligations.',
    ],
  },
  {
    id: 'law',
    title: 'Governing law',
    blocks: [
      'These terms are governed by the laws of New Zealand, and the New Zealand courts have jurisdiction over any dispute about them.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    blocks: [
      { text: 'Questions about these terms can be sent to', email: CONTACT_EMAIL },
    ],
  },
];
