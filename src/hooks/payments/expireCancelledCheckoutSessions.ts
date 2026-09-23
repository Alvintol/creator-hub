// Sprint 4 (launch-scope.md section 5.1 / 5.2): the DB-side cancellation
// RPCs move any open payment to status "cancelled" but cannot reach the
// Stripe API. This calls the Express route that expires the live Stripe
// checkout session for each of those payments, so a buyer with the old
// checkout page still open cannot complete it. Best-effort -- if this call
// fails, the payment rows are already cancelled in the database; only the
// stale Stripe session cleanup did not happen, which
// docs/support/requests/cancellation.md documents as a known, monitorable
// gap rather than something the UI should block or retry on.
const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

export const expireCancelledCheckoutSessions = async ({
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
      `${getApiBase()}/api/stripe/checkout/expire-cancelled-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingRequestId }),
      }
    );
  } catch {
    // Best-effort cleanup -- see the comment above.
  }
};
