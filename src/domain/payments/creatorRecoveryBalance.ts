// Mirrors resolve_listing_request_payment_recovery_instalment
// (supabase/migrations/20260922_129_add_recovery_instalment_diversion.sql)
// for testability without a live database, same reason
// listingRequestPaymentRefunds.ts mirrors the refund arithmetic. The SQL
// function is the source of truth; this exists so the section 6.6 cap logic
// has a test suite at all.

// Section 6.6: recover at most 50% of each base payment, and never more
// than what is actually still owed.
export const resolveRecoveryInstalmentCents = (
  baseAmountCents: number,
  outstandingBalanceCents: number,
): number => {
  if (outstandingBalanceCents <= 0) {
    return 0;
  }

  const capCents = Math.floor(baseAmountCents * 0.5);

  return Math.min(capCents, outstandingBalanceCents);
};
