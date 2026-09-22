// Pure logic for whether a buyer has accepted every policy checkout requires,
// at its current version. No Supabase, Express or Stripe imports, so this is
// directly unit-testable without booting the API.
//
// Mirrors src/domain/legal/policyAcceptance.ts's getMissingPolicyTypes: an
// acceptance of an older version does not count once the document has changed.

export const getMissingCheckoutPolicyTypes = (
  requiredPolicyVersions,
  acceptanceRows,
) =>
  Object.entries(requiredPolicyVersions)
    .filter(
      ([policyType, requiredVersion]) =>
        !acceptanceRows.some(
          (row) =>
            row.policy_type === policyType &&
            row.policy_version === requiredVersion,
        ),
    )
    .map(([policyType]) => policyType);
