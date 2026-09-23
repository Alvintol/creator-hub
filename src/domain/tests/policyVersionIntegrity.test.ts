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
  terms: { "2026-09-20-draft-1": "c47911f5e9812f0966eb7b262d8b8604f961401669010a1cd8dcf228c11a8d49", "2026-09-19-draft-2": "5b9080a96cfd915ecd26220289a3eaac9f6c0ac8b6851020c2a1efbc851b7548" },
  privacy: { "2026-09-20-draft-1": "1f19953f731c6ee9c1729227cdc2ffe63d200f5b6cd105f0d803223d79013b28", "2026-09-19-draft-2": "2935f8bfc76d3dad7d0350fa532e3265c8d274e0896c94bb97010385460336e2" },
  creator_terms: { "2026-09-22-draft-1": "eadaa3f37da8a3278821ec589acbaff6b2a96178cfc7f5470d9575a9831aa967", "2026-09-20-draft-1": "bc5917a801a8d234fc596415238e611b95260456e788bdde1ef9cc37542071e8", "2026-09-17-draft-1": "9c675d4ce1d149b104d45a017b841072a08f6331fd234a9b7904e0a6bf356115" },
  refund: { "2026-09-20-draft-1": "eceb39cfc21582e83abeb00d0b0bf83e5c797da6bffad516e8c4146c015a5d42", "2026-09-17-draft-1": "6727c6c4209f6f28bb34645e8f7716b5ffa777c7bdb519d3a8fb5de6dc8e535a" },
  payment_terms: { "2026-09-22-draft-1": "59d31bbc4c74d86a4854f4d279efabb624f10f1869034c303133035faef6d360", "2026-09-20-draft-1": "97b3fe9fe50113c9932e209c44f4dd2587679051ea0a5db4dea0523ec441df17", "2026-09-17-draft-1": "3203fd680eafba0ff2f961eaa460efed3bafad1cd9cb0605670ed5fdafd2672a" },
  copyright: { "2026-09-20-draft-1": "aefa50f55ce7a95f0c186d0907f32609a9581efb071369665175fe787ea8dfa6", "2026-09-17-draft-1": "529478dfb5fb54299d537240e92b0f141c1072c79c16910ae7fd1e7284687e06" },
  cookie: { "2026-09-20-draft-1": "ad9f55e45a7b736f872cb84017ff61cf3d7a8666a3f72efb2515b3c04acdc0d5", "2026-09-17-draft-1": "cca5da84dbead978aef8973561e33b10e8e098fde40707e1f13adb30db00cd16" },
  community: { "2026-09-20-draft-1": "d508291e7702e89782687e5441577600a121be107a1d36c3795cbdeb860e0471", "2026-09-17-draft-1": "e86d880e0ee8ca6858a97c3e46cc81a31cf78614bef1d6ca28f399ca01e658fb" },
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
