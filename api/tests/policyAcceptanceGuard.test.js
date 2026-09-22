import { describe, expect, it } from "vitest";
import { getMissingCheckoutPolicyTypes } from "../policyAcceptanceGuard.js";

// The first server-side tests for api/ (AGENTS.md: "api/server.js has no
// tests at all. Any substantial change there should start closing that
// gap."). This exercises the pure logic the checkout endpoint now enforces;
// server.js itself has no test harness yet and is not touched here.

const requiredVersions = {
  refund: "v2",
  payment_terms: "v3",
};

describe("getMissingCheckoutPolicyTypes", () => {
  it("returns every required type when there are no acceptances at all", () => {
    expect(getMissingCheckoutPolicyTypes(requiredVersions, [])).toEqual([
      "refund",
      "payment_terms",
    ]);
  });

  it("returns nothing when every policy is accepted at its required version", () => {
    const acceptances = [
      { policy_type: "refund", policy_version: "v2" },
      { policy_type: "payment_terms", policy_version: "v3" },
    ];

    expect(getMissingCheckoutPolicyTypes(requiredVersions, acceptances)).toEqual(
      [],
    );
  });

  it("treats an acceptance of an older version as missing", () => {
    // An accepted v1 must not satisfy a v2 requirement -- the document changed.
    const acceptances = [
      { policy_type: "refund", policy_version: "v1" },
      { policy_type: "payment_terms", policy_version: "v3" },
    ];

    expect(getMissingCheckoutPolicyTypes(requiredVersions, acceptances)).toEqual(
      ["refund"],
    );
  });

  it("ignores acceptances of policies that are not required", () => {
    const acceptances = [
      { policy_type: "terms", policy_version: "v1" },
      { policy_type: "refund", policy_version: "v2" },
      { policy_type: "payment_terms", policy_version: "v3" },
    ];

    expect(getMissingCheckoutPolicyTypes(requiredVersions, acceptances)).toEqual(
      [],
    );
  });

  it("does not double-count when the same policy has multiple rows", () => {
    // A buyer who accepted, then the policy changed, then accepted again --
    // both rows exist, the current version among them satisfies the check.
    const acceptances = [
      { policy_type: "refund", policy_version: "v1" },
      { policy_type: "refund", policy_version: "v2" },
      { policy_type: "payment_terms", policy_version: "v3" },
    ];

    expect(getMissingCheckoutPolicyTypes(requiredVersions, acceptances)).toEqual(
      [],
    );
  });

  it("returns an empty array when nothing is required", () => {
    expect(getMissingCheckoutPolicyTypes({}, [])).toEqual([]);
  });
});
