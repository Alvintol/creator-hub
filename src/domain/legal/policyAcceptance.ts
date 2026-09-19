import { communityGuidelinesVersion } from "./communityGuidelines";
import { cookiePolicyVersion } from "./cookiePolicy";
import { copyrightPolicyVersion } from "./copyrightPolicy";
import { creatorTermsVersion } from "./creatorTerms";
import { paymentTermsVersion } from "./paymentTerms";
import { privacyVersion } from "./privacyPolicy";
import { refundPolicyVersion } from "./refundPolicy";
import { termsVersion } from "./termsOfService";

// Mirrors the policy_type check constraint on public.policy_acceptances.
// "early_service_request" is the EU/UK express request to start work before
// the statutory cancellation period ends (Refund Policy section 1). It needs
// migration 114 to be applied before the database will accept it.
export type PolicyType =
  | "terms"
  | "creator_terms"
  | "privacy"
  | "refund"
  | "copyright"
  | "payment_terms"
  | "cookie"
  | "community"
  | "early_service_request";

export type PolicyAcceptanceInput = {
  policyType: PolicyType;
  policyVersion: string;
};

export type PolicyAcceptanceRecord = {
  policy_type: PolicyType;
  policy_version: string;
  related_listing_request_id: string | null;
  accepted_at: string;
};

// The early-service request is defined by Refund Policy section 1, so it
// carries that document's version.
export const currentPolicyVersions: Record<PolicyType, string> = {
  terms: termsVersion,
  creator_terms: creatorTermsVersion,
  privacy: privacyVersion,
  refund: refundPolicyVersion,
  copyright: copyrightPolicyVersion,
  payment_terms: paymentTermsVersion,
  cookie: cookiePolicyVersion,
  community: communityGuidelinesVersion,
  early_service_request: refundPolicyVersion,
};

export const signupPolicyTypes: PolicyType[] = ["terms", "privacy"];

export const creatorActivationPolicyTypes: PolicyType[] = ["creator_terms"];

export const checkoutPolicyTypes: PolicyType[] = [
  "refund",
  "payment_terms",
  "early_service_request",
];

// Pairs each policy with the version the user is being shown right now.
export const toCurrentPolicyAcceptances = (
  policyTypes: PolicyType[],
): PolicyAcceptanceInput[] =>
  policyTypes.map((policyType) => ({
    policyType,
    policyVersion: currentPolicyVersions[policyType],
  }));

// Policies still needing acceptance at their current version. An acceptance
// of an older version does not count once the document has changed.
export const getMissingPolicyTypes = (
  requiredPolicyTypes: PolicyType[],
  acceptances: Pick<PolicyAcceptanceRecord, "policy_type" | "policy_version">[],
): PolicyType[] =>
  requiredPolicyTypes.filter(
    (policyType) =>
      !acceptances.some(
        (acceptance) =>
          acceptance.policy_type === policyType &&
          acceptance.policy_version === currentPolicyVersions[policyType],
      ),
  );

// Most recent acceptance time across a set of records, for "accepted on" copy.
export const getLatestAcceptedAt = (
  acceptances: Pick<PolicyAcceptanceRecord, "accepted_at">[],
): string | null =>
  acceptances.reduce<string | null>(
    (latest, acceptance) =>
      !latest || acceptance.accepted_at > latest ? acceptance.accepted_at : latest,
    null,
  );

// The agreements a creator accepts before Stripe onboarding. These must match
// the URLs in Creator Terms section 2; a test checks they still appear there.
export const stripeConnectedAccountAgreementUrl =
  "https://stripe.com/connect-account/legal/full";

export const stripeServicesAgreementUrl = "https://stripe.com/legal/ssa";
