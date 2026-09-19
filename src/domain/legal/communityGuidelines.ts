// REVIEW DRAFT: resolve publication inputs and implement linked workflows before adoption.
export const communityGuidelinesVersion = "2026-09-17-draft-1";

export const communityGuidelinesSections = [
  {
    "title": "1. The basic standard",
    "body": [
      "Be honest about your work, respect other people and deliver what you agree to provide. These standards apply to profiles, listings, portfolios, previews, project files, messages, reviews and linked material used to offer or deliver a service. Private messages and external delivery links are not exceptions to the rules.",
      "These guidelines form part of the Terms of Service and Creator Terms. A mature label permits only content that is otherwise allowed. CreatorHub approval is not a promise that content is lawful or acceptable to every payment provider."
    ]
  },
  {
    "title": "2. Content examples",
    "body": [
      "Content: Logos, stream overlays, ordinary portraits and non-graphic fantasy art; Treatment: Generally allowed; What to do: Own or hold the necessary rights and describe the offer accurately",
      "Content: Strong language, frightening horror, limited fictional blood or non-explicit suggestive themes; Treatment: May be allowed with a mature label; What to do: Use a safe preview, a clear warning and appropriate visibility controls",
      "Content: A horror emote with a small amount of stylised blood; Treatment: Mature: horror and fictional blood; What to do: Keep the public preview mild and warn before displaying the full image",
      "Content: Graphic dismemberment, realistic extreme gore or imagery celebrating real violence; Treatment: Prohibited; What to do: Do not upload or offer it",
      "Content: Pornography, explicit sexual acts, genital-focused sexual imagery, sexual services or work intended primarily for sexual gratification; Treatment: Prohibited; What to do: A mature label, private delivery or “artistic” title does not make it allowed",
      "Content: Sexualised minors or minor-looking characters, child sexual abuse material or exploitative sexual depictions; Treatment: Prohibited; What to do: Do not upload, commission, link or circulate it, including fictional or AI-generated depictions",
      "Content: Non-consensual intimate imagery, sexual deepfakes or voyeuristic material; Treatment: Prohibited; What to do: Consent and privacy cannot be bypassed through editing or AI",
      "Content: Stolen portfolios, unlicensed resale packs or a copied logo presented as original; Treatment: Prohibited; What to do: Use your own work or work you are authorised to supply",
      "Content: Threats, targeted hateful abuse, doxxing, scams, malware or fraudulent reviews; Treatment: Prohibited; What to do: Report through the available reporting channel or support",
      "We may refuse a category that conflicts with Stripe's restrictions, even if it is lawful or labelled mature. Borderline artistic nudity or other sensitive material must be reviewed before publication or payment; absence of a specific example is not approval."
    ]
  },
  {
    "title": "3. How mature labelling works",
    "body": [
      "Apply the available mature-content classification to every relevant listing or portfolio item. Begin the description with a plain warning such as “Mature content: strong language and horror” or “Mature content: suggestive, non-explicit themes.” A vague “NSFW” label by itself is insufficient.",
      "Public thumbnails, avatars, banners and previews must remain suitable for general discovery. Use a genuinely safe crop, neutral cover or other preview that does not expose the sensitive material. Put the warning before the content, not underneath it. Do not tag unrelated safe work as mature to manipulate discovery.",
      "For a project conversation, first describe the sensitive category in text and obtain the recipient's agreement before sending an allowed mature reference or file. Do not send sensitive images to test someone's boundaries. Adult content prohibitions still apply after a recipient agrees.",
      "If the relevant surface does not provide working labelling and visibility controls, do not publish mature material there. Contact support or use a general-audience preview until those controls are available. Do not assume a label alone creates a reliable age gate."
    ]
  },
  {
    "title": "4. Original work, licences and AI",
    "body": [
      "Do not present someone else's work as your own. Attribution does not replace permission. If work is collaborative, identify your contribution and confirm that you can show it. Client work, reference images, fonts, music, stock assets and character designs may have separate rights restrictions.",
      "Disclose material use of generative AI before a buyer accepts the agreement, particularly when the listing promises original hand-created work. Identify relevant licence limitations and do not promise exclusive ownership of outputs where you cannot grant it. Do not use confidential buyer files in an AI service or for training without the buyer's specific permission and a lawful basis. AI use does not excuse plagiarism, misleading claims or prohibited content.",
      "Copyright owners or their representatives can use our Copyright Infringement and DMCA Policy. Other users can report suspicious work with specific evidence. Do not organise harassment or publicly circulate private identity details over an accusation."
    ]
  },
  {
    "title": "5. Working together",
    "body": [
      "Describe price, deliverables, included revisions, timing and licence terms before payment. Do not bait buyers with a price that cannot purchase the advertised deliverable. Buyers must provide accurate instructions and timely feedback; creators must provide honest progress updates and explain delays.",
      "An in-scope correction is not a paid upgrade. Extra work needs an accepted change order. Do not use threats, abusive messages, fake legal claims, withholding already-paid work or review extortion to force agreement. A good-faith complaint or bank dispute is not, by itself, abuse.",
      "Tips and CreatorHub support are voluntary. Do not demand them as a condition of delivery, ordinary customer service or a favourable moderation outcome. Never ask for passwords, full card details or unnecessary identity documents in messages."
    ]
  },
  {
    "title": "6. Reporting, moderation and appeals",
    "body": [
      "Use the report option where available, or email [SUPPORT_EMAIL] with the URL or project ID, the rule involved and a concise explanation. For suspected child exploitation, report the location without downloading, forwarding or attaching the material. For immediate danger, use the appropriate emergency service; CreatorHub support is not an emergency response service.",
      "We may request edits, change visibility, remove content, pause listings or messaging, restrict payments where authorised, or suspend or terminate an account. Serious safety risks can require immediate action. We consider context, severity, repeated conduct and the reliability of evidence. Linked accounts are trust signals, not an exemption from these standards.",
      "Where lawful and appropriate, we explain the reason for an action and how to request review. Appeal to [SUPPORT_EMAIL] within 14 days with the decision reference, the error you believe occurred and any new evidence. Copyright counter-notices follow their separate legal process. We do not promise a different reviewer when a sole operator handles support.",
      "Account restrictions do not automatically forfeit money, erase records or end refund rights. We preserve an appropriate support route for existing projects. Do not evade restrictions by opening another account or reposting prohibited material."
    ]
  }
] as const;
