import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CheckoutPolicyAcceptance from "../../components/legal/CheckoutPolicyAcceptance";
import {
  formatPaymentCents,
  getListingRequestPaymentTitle,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { useCreateListingRequestPaymentCheckout } from "../../hooks/payments/useCreateListingRequestPaymentCheckout";
import { useListingRequestPayment } from "../../hooks/payments/useListingRequestPayments";
import { getStripeForConnectedAccount } from "../../lib/stripeClient";

const classes = {
  shell:
    "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8",
  card: "card p-6",
  title: "text-2xl font-black tracking-tight text-zinc-950",
  text: "mt-2 text-sm leading-6 text-zinc-600",
  error:
    "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900",
  checkoutWrap: "overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2",
  actions: "flex flex-wrap items-center gap-3",
  btn:
    "btnOutline",
  summaryTitle: "font-display text-base font-extrabold tracking-tight",
  amounts: "mt-3 space-y-1 text-sm text-zinc-700",
  amountRow: "flex justify-between gap-4",
  totalRow: "flex justify-between gap-4 border-t border-zinc-200 pt-2 font-bold text-zinc-950",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const ListingRequestPaymentCheckout = () => {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const createCheckout = useCreateListingRequestPaymentCheckout();
  const paymentQuery = useListingRequestPayment(paymentId);
  const payment = paymentQuery.data ?? null;

  // Stripe checkout opens only after the buyer has accepted the project
  // terms and policies for this request.
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const onPoliciesAccepted = useCallback(() => setPoliciesAccepted(true), []);

  const startedPaymentIdRef = useRef<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const startCheckout = useCallback(async () => {
    if (!paymentId) {
      setErrMsg("Payment id is missing.");
      return;
    }

    if (startedPaymentIdRef.current === paymentId) {
      return;
    }

    startedPaymentIdRef.current = paymentId;

    setErrMsg(null);
    setClientSecret(null);
    setStripePromise(null);

    try {
      const response = await createCheckout.mutateAsync({ paymentId });

      setClientSecret(response.checkout.clientSecret);
      setStripePromise(
        getStripeForConnectedAccount(
          response.payment.stripe_connected_account_id,
        ),
      );
    } catch (error) {
      startedPaymentIdRef.current = null;
      setErrMsg(getErrorMessage(error));
    }
  }, [createCheckout.mutateAsync, paymentId]);

  useEffect(() => {
    if (!policiesAccepted) return;

    void startCheckout();
  }, [policiesAccepted, startCheckout]);

  const checkoutOptions = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret],
  );

  return (
    <main className={classes.shell}>
      <section className={classes.card}>
        <h1 className={classes.title}>Complete payment</h1>
        <p className={classes.text}>
          Your payment is processed securely by Stripe inside Made for Stream. Payment
          status updates after Stripe confirms the transaction.
        </p>
      </section>

      {paymentQuery.isLoading && (
        <section className={classes.card}>
          <p className={classes.text}>Loading payment details…</p>
        </section>
      )}

      {paymentQuery.isError && (
        <div className={classes.error}>We couldn’t load this payment. Please try again.</div>
      )}

      {!paymentQuery.isLoading && !paymentQuery.isError && !payment && (
        <div className={classes.error}>This payment could not be found.</div>
      )}

      {payment && (
        <section className={classes.card}>
          <h2 className={classes.summaryTitle}>{getListingRequestPaymentTitle(payment)}</h2>
          <dl className={classes.amounts}>
            <div className={classes.amountRow}>
              <dt>Project payment</dt>
              <dd>{formatPaymentCents(payment.base_amount_cents, payment.currency)}</dd>
            </div>
            <div className={classes.amountRow}>
              <dt>Buyer service fee</dt>
              <dd>{formatPaymentCents(payment.buyer_service_fee_cents, payment.currency)}</dd>
            </div>
            {payment.creator_tip_cents > 0 && (
              <div className={classes.amountRow}>
                <dt>Creator tip</dt>
                <dd>{formatPaymentCents(payment.creator_tip_cents, payment.currency)}</dd>
              </div>
            )}
            {payment.platform_support_cents > 0 && (
              <div className={classes.amountRow}>
                <dt>Made for Stream support</dt>
                <dd>{formatPaymentCents(payment.platform_support_cents, payment.currency)}</dd>
              </div>
            )}
            <div className={classes.totalRow}>
              <dt>Total</dt>
              <dd>{formatPaymentCents(payment.total_checkout_cents, payment.currency)}</dd>
            </div>
          </dl>
        </section>
      )}

      {payment && (
        <CheckoutPolicyAcceptance
          listingRequestId={payment.listing_request_id}
          onAccepted={onPoliciesAccepted}
        />
      )}

      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {policiesAccepted && !errMsg && (!stripePromise || !checkoutOptions) && (
        <section className={classes.card}>
          <p className={classes.text}>Preparing secure checkout…</p>
        </section>
      )}

      {stripePromise && checkoutOptions && (
        <section className={classes.checkoutWrap}>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={checkoutOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </section>
      )}

      <div className={classes.actions}>
        <Link className={classes.btn} to="/requests">
          Back to requests
        </Link>
      </div>
    </main>
  );
};

export default ListingRequestPaymentCheckout;