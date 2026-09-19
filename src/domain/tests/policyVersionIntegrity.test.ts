import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { communityGuidelinesSections, communityGuidelinesVersion } from "../legal/communityGuidelines";
import { cookiePolicySections, cookiePolicyVersion } from "../legal/cookiePolicy";
import { copyrightPolicySections, copyrightPolicyVersion } from "../legal/copyrightPolicy";
import { creatorTermsSections, creatorTermsVersion } from "../legal/creatorTerms";
import { paymentTermsSections, paymentTermsVersion } from "../legal/paymentTerms";
import { privacySections, privacyVersion } from "../legal/privacyPolicy";
import { refundPolicySections, refundPolicyVersion } from "../legal/refundPolicy";
import { termsSections, termsVersion } from "../legal/termsOfService";

// Acceptance records store a policy version, so each version must always
// mean exactly one text. If this test fails, a policy's text changed:
// bump that policy's version constant, then record the new fingerprint
// here. Never change a fingerprint without changing the version.
const recordedFingerprints: Record<string, Record<string, string>> = {
  terms: { "2026-09-19-draft-2": "5b9080a96cfd915ecd26220289a3eaac9f6c0ac8b6851020c2a1efbc851b7548" },
  privacy: { "2026-09-19-draft-2": "2935f8bfc76d3dad7d0350fa532e3265c8d274e0896c94bb97010385460336e2" },
  creator_terms: { "2026-09-17-draft-1": "9c675d4ce1d149b104d45a017b841072a08f6331fd234a9b7904e0a6bf356115" },
  refund: { "2026-09-17-draft-1": "6727c6c4209f6f28bb34645e8f7716b5ffa777c7bdb519d3a8fb5de6dc8e535a" },
  payment_terms: { "2026-09-17-draft-1": "3203fd680eafba0ff2f961eaa460efed3bafad1cd9cb0605670ed5fdafd2672a" },
  copyright: { "2026-09-17-draft-1": "529478dfb5fb54299d537240e92b0f141c1072c79c16910ae7fd1e7284687e06" },
  cookie: { "2026-09-17-draft-1": "cca5da84dbead978aef8973561e33b10e8e098fde40707e1f13adb30db00cd16" },
  community: { "2026-09-17-draft-1": "e86d880e0ee8ca6858a97c3e46cc81a31cf78614bef1d6ca28f399ca01e658fb" },
};

const documents = [
  { name: "terms", version: termsVersion, sections: termsSections },
  { name: "privacy", version: privacyVersion, sections: privacySections },
  { name: "creator_terms", version: creatorTermsVersion, sections: creatorTermsSections },
  { name: "refund", version: refundPolicyVersion, sections: refundPolicySections },
  { name: "payment_terms", version: paymentTermsVersion, sections: paymentTermsSections },
  { name: "copyright", version: copyrightPolicyVersion, sections: copyrightPolicySections },
  { name: "cookie", version: cookiePolicyVersion, sections: cookiePolicySections },
  { name: "community", version: communityGuidelinesVersion, sections: communityGuidelinesSections },
];

const fingerprint = (sections: unknown): string =>
  createHash("sha256").update(JSON.stringify(sections)).digest("hex");

describe("policy version integrity", () => {
  it.each(documents)("$name text matches the fingerprint recorded for its version", (doc) => {
    expect(recordedFingerprints[doc.name]?.[doc.version]).toBe(fingerprint(doc.sections));
  });
});
