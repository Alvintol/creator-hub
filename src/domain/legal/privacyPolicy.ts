// REVIEW DRAFT: placeholders are intentionally left in place until the
// operating entity, brand and domain are finalized. Safe to keep live
// pre-launch; must be resolved before public launch.
export const privacyVersion = "2026-09-19-draft-2";

export const privacySections = [
  {
    "title": "1. Who is responsible",
    "body": [
      "CreatorHub is operated by [OPERATOR_LEGAL_NAME], at [BUSINESS_POSTAL_ADDRESS]. The individual responsible for privacy enquiries can be reached at [PRIVACY_EMAIL]. This policy explains personal information handled through accounts, creator applications, listings, messaging, projects, payments and support.",
      "It does not replace the privacy notices of services you choose to use, such as Stripe or a sign-in provider. We identify relevant sharing below. Where privacy law imposes additional mandatory requirements, those requirements apply."
    ]
  },
  {
    "title": "2. Information we handle",
    "body": [
      "Information: Account and authentication; Examples and sources: Email, user ID, sign-in provider and authentication state supplied by you or your selected provider",
      "Information: Profile and linked accounts; Examples and sources: Handle, display name, biography, images, country, time zone, website and authorised Twitch or YouTube connection details",
      "Information: Creator applications; Examples and sources: Samples or sample links, application answers, eligibility acknowledgements, review status and relevant moderation history",
      "Information: Projects and communications; Examples and sources: Listings, requests, agreement versions, messages, change orders, progress, deliveries, complaints and support evidence",
      "Information: Payments; Examples and sources: Transaction and connected-account IDs, amounts, currency, fee and contribution breakdowns, payment status, refund and dispute records, and limited payment-method information made available by Stripe",
      "Information: Technical and security; Examples and sources: IP address, device and browser information, access and error logs, security events and relevant session identifiers",
      "Information: Choices and acceptance records; Examples and sources: Terms version and time of acceptance, privacy preferences, cookie choices and marketing consent where applicable",
      "Information: Copyright reports; Examples and sources: Contact information, work locations, declarations, notices, counter-notices and related decisions",
      "Do not send full payment-card numbers, account passwords or unnecessary government identification through project messages. Payment-card entry and required Stripe identity verification occur through Stripe's interfaces. CreatorHub receives operational account and payment information; we do not require full card details in our ordinary application database. Any additional access to verification data is limited to authorised needs and actual integration permissions."
    ]
  },
  {
    "title": "3. Why we use it",
    "body": [
      "We use information to provide accounts, match buyers with creators, process applications, manage projects and payments, deliver service notices, answer support requests and honour accepted agreements. We also use proportionate information to secure the service, prevent fraud, moderate content, resolve disputes, respond to rights notices and meet legal obligations.",
      "Where applicable data-protection law requires a lawful basis, providing requested services relies on contractual necessity; required financial and legal records rely on legal obligation; proportionate security, abuse prevention and service administration may rely on legitimate interests after considering affected rights. Optional tracking and marketing rely on valid consent where required. Where Canadian law requires consent, we obtain meaningful consent or rely on a legally permitted exception. We do not treat a blanket acceptance of the Terms as consent to every use.",
      "We do not use private project content to train a separate general-purpose AI model without specific permission and an appropriate lawful basis. A new use incompatible with the original purpose requires the relevant notice, basis and consent where applicable."
    ]
  },
  {
    "title": "4. Public information and recipients",
    "body": [
      "Public profile fields, published listings and portfolio previews are visible to other users and may be indexed or copied by others. A draft application, private message or private project delivery is not public merely because CreatorHub stores it. Necessary project details are shared with the other party, and authorised personnel may review relevant records for support, safety or legal reasons. Access is limited to the task.",
      "We use service providers for hosting, databases, authentication, storage, payment services and enabled communications. CreatorHub uses Supabase for account and database functions and Stripe for payment and connected-account services. Where externally served Google Fonts are enabled, the browser also makes requests to Google to obtain font resources; those requests can reveal technical data such as the visitor's IP address even without an analytics cookie. Other enabled infrastructure, messaging or analytics providers must be listed in the published Service Provider Register with their functions and relevant processing locations. We share only what is needed for the stated service and require appropriate safeguards.",
      "Google, Twitch or other providers you select supply the identity or connection information covered by your authorisation. Their own services remain governed by their notices. We do not need your sign-in-provider password. Disconnecting an optional link stops future access through that authorisation, subject to existing records and provider controls.",
      "We may disclose information when law requires it, in response to valid legal process, or where law permits necessary protection against fraud or serious harm. Any business transfer must preserve applicable privacy obligations and be accompanied by notice where required."
    ]
  },
  {
    "title": "5. Stripe and transaction information",
    "body": [
      "When you provide personal data through Stripe payment or onboarding features, Stripe receives it and processes it under Stripe's Privacy Policy (https://stripe.com/privacy). Relevant account, business, verification, transaction, device and fraud-prevention information may pass between CreatorHub and Stripe to operate the requested service. Stripe may process some information for its own legal, regulatory and risk-management purposes.",
      "Creators must complete the agreement and consent steps required by Stripe. For Canadian connected accounts, this can include consent to credit-agency information for identity verification. We do not treat that as permission to obtain an unrelated consumer credit report for our own marketing or lending purposes.",
      "For a payment complaint or chargeback, relevant agreements, communications, delivery evidence and transaction records may be shared with Stripe, a bank or payment network. We avoid sharing unrelated message history where it is not necessary."
    ]
  },
  {
    "title": "6. Copyright reports and complaint evidence",
    "body": [
      "We may share a copyright notice and relevant sender details with the affected uploader. A valid DMCA counter-notice is forwarded to the original claimant as part of the legal process. The Copyright Infringement and DMCA Policy explains what is required. Avoid including unrelated sensitive information; contact us about a safety concern before submitting if appropriate.",
      "Moderation reports are not routinely published. Confidentiality cannot be absolute: we may need to explain an allegation, disclose relevant evidence for a fair response or comply with law. We restrict sharing to the purpose and redact unrelated information where appropriate."
    ]
  },
  {
    "title": "7. Cookies, marketing and advertising",
    "body": [
      "The Cookie and Tracking Policy and its Storage Register explain browser storage, optional analytics and external services. Optional tracking requires the choices stated there. You can change them through Cookie settings. Security logs necessary to operate the service are assessed separately and are not automatically erased by rejecting analytics.",
      "Service emails can include security alerts, application decisions, project messages and payment or support updates. Marketing subscriptions are separate, with consent where required and an accessible unsubscribe option. Opting out of marketing does not prevent necessary service notices.",
      "CreatorHub does not sell personal information or share it for cross-context behavioural advertising under this draft service model. Before introducing advertising arrangements that change that position, we must provide the applicable disclosures and choices, honour legally required opt-out signals and obtain consent where needed. Future advertising plans are not a statement that tracking is currently active."
    ]
  },
  {
    "title": "8. Retention and deletion",
    "body": [
      "We limit retention to the purpose for which information is needed. The following schedule sets ordinary limits, subject to a documented legal hold, security investigation or longer period specifically required by law:",
      "Record: Active account and profile; Ordinary retention: While the account is active; remove from active systems within 30 days after a verified closure request unless an identified exception applies",
      "Record: Private project messages and delivered files; Ordinary retention: Up to 24 months after project closure; preserve only necessary excerpts longer for financial or dispute evidence",
      "Record: Financial records, accepted project terms and payment-dispute evidence; Ordinary retention: Seven years after the relevant transaction or final dispute resolution, whichever is later",
      "Record: Unsuccessful or withdrawn creator application samples; Ordinary retention: Up to 12 months after the final decision; retain a minimal decision record only as needed under another applicable category",
      "Record: Ordinary support and moderation records; Ordinary retention: Up to 24 months after closure; longer only for a documented continuing safety or legal need",
      "Record: Routine technical and security logs; Ordinary retention: Up to 90 days, with relevant incident evidence retained separately for the investigation",
      "Record: Privacy-choice and contractual-consent evidence; Ordinary retention: Up to three years after withdrawal, expiry or replacement, unless tied to a longer-lived agreement or required record",
      "Record: Backup copies of deleted records; Ordinary retention: Age out through the ordinary rotation within 90 days, unless a documented legal hold requires otherwise",
      "We do not retain an entire private conversation for seven years merely because a limited financial record must be kept. Account closure does not remove another party's lawful copy of a message or erase a required financial record. We restrict retained exceptions and delete them when the reason ends. If restoring a backup, we reapply deletion instructions before returning affected data to ordinary use. Keep your own copies of deliverables you are entitled to retain.",
      "When an account is closed, we delete or anonymise its profile and account information under this schedule, but we keep a record of each policy and project agreement the account accepted: which document, which version, when it was accepted and, where relevant, the project it applied to. We also keep a copy of the text of every version of our policies. These records are kept only for the periods set out above for financial records, accepted project terms and contractual-consent evidence, are restricted to support, dispute resolution, legal compliance and audit purposes, and are not used to rebuild a closed account."
    ]
  },
  {
    "title": "9. International processing and security",
    "body": [
      "CreatorHub operates from Canada. Providers may process data in other countries, where authorities may have lawful access under local rules. The Service Provider Register identifies verified locations. Where applicable law requires a transfer mechanism or assessment, we use the appropriate contractual or other safeguards before the transfer and explain how to obtain relevant information by contacting [PRIVACY_EMAIL]. We do not promise Canadian-only storage without a verified basis.",
      "We use reasonable technical and organisational safeguards appropriate to the data, including access controls and restricted operational access. No service can guarantee absolute security. We assess incidents and notify affected people and authorities where required by applicable law."
    ]
  },
  {
    "title": "10. Your rights and complaints",
    "body": [
      "Contact [PRIVACY_EMAIL] to request access, correction, deletion, restriction, portability, withdrawal of consent or objection where applicable. You may update many profile fields in account settings. We verify identity proportionately and do not ask for more information than reasonably needed. An authorised representative may act where the law permits.",
      "We respond within the applicable legal period and normally within 30 days; if a lawful extension is needed, we explain the reason and timing. We explain refusals or retained-record exceptions and available review rights. Consent withdrawal does not undo earlier lawful processing, but it can prevent an optional service from continuing. We do not discriminate unlawfully for exercising a privacy right.",
      "You may complain to the appropriate privacy authority, including the Office of the Information and Privacy Commissioner of Alberta, the Office of the Privacy Commissioner of Canada where applicable, or your local data-protection authority. You need not complete an internal complaint before using a legally available external remedy."
    ]
  },
  {
    "title": "11. Age requirements, changes and registers",
    "body": [
      "Registered accounts are intended for adults meeting the Terms' age and capacity requirements. If we learn that an account is held by an ineligible minor, we restrict it and assess deletion, safeguarding and legal-retention duties. Public browsing can still involve basic technical data; an adult-account rule is not a claim that no minor ever visits the site.",
      "We publish the effective date and material changes. Where required, we obtain new consent before a new use begins. The published version must include the verified Service Provider Register and a working privacy contact. If an EU or UK representative or other jurisdiction-specific notice is legally required, its actual details must be added before offering the service on that basis."
    ]
  }
] as const;
