import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCreateListingRequestPaymentCheckout } from "../../hooks/payments/useCreateListingRequestPaymentCheckout";
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
    "inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition hover:-translate-y-[1px] hover:bg-zinc-50",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const ListingRequestPaymentCheckout = () => {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const createCheckout = useCreateListingRequestPaymentCheckout();

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
    void startCheckout();
  }, [startCheckout]);

  const checkoutOptions = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret],
  );

  return (
    <main className={classes.shell}>
      <section className={classes.card}>
        <h1 className={classes.title}>Complete payment</h1>
        <p className={classes.text}>
          Your payment is processed securely by Stripe inside CreatorHub. Payment
          status updates after Stripe confirms the transaction.
        </p>
      </section>

      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {!errMsg && (!stripePromise || !checkoutOptions) && (
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
        <Link className={classes.btn} to="/buyer/requests">
          Back to requests
        </Link>
      </div>
    </main>
  );
};

export default ListingRequestPaymentCheckout;