// Sprint 5 (launch-scope.md section 6): an accepted post-payment
// cancellation flags unearned amounts for refund
// (listing_request_cancellation_proposal_items.flagged_for_refund_at) but
// the DB-side RPC that accepts it cannot reach the Stripe API. This calls
// the Express route that actually issues those refunds, the same
// best-effort-follow-up pattern expireCancelledCheckoutSessions already
// uses for the Stripe-side half of a DB-side cascade -- if this call fails,
// the acceptance itself already succeeded; the flagged amounts stay flagged
// and unrefunded, which is a real gap to reconcile (see
// docs/support/requests/cancellation.md), not something the UI should block
// or retry on.
const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

export const drainFlaggedListingRequestRefunds = async ({
  listingRequestId,
  accessToken,
}: {
  listingRequestId: string;
  accessToken: string | undefined;
}): Promise<void> => {
  if (!accessToken) {
    return;
  }

  try {
    await fetch(
      `${getApiBase()}/api/stripe/refunds/drain-flagged-for-request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingRequestId }),
      },
    );
  } catch {
    // Best-effort -- see the comment above.
  }
};
