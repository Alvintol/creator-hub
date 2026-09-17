import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from "@stripe/connect-js";
import { useCallback, useState } from "react";
import {
  createStripeConnectAccountSession,
} from "../../hooks/payments/useStripeConnectAccountSession";
import {
  getCreatorPaymentAccountIsReady,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";
import { useSyncStripeConnectAccount } from "../../hooks/payments/useStripeConnectOnboarding";
import { getStripePublishableKey } from "../../lib/stripeClient";
import { useAuth } from "../../providers/AuthProvider";

type CreatorPayoutSettingsProps = {
  isCreatorApproved: boolean;
};

const classes = {
  text: "text-sm text-zinc-600",
  form: "grid gap-3 sm:grid-cols-[8rem_8rem_1fr] sm:items-end",
  field: "flex flex-col gap-1.5",
  label: "formLabel",
  input: "formControl uppercase",
  actions: "flex flex-wrap items-center gap-2 sm:justify-end",
  button: "btnPrimary",
  secondaryButton: "btnOutline",
  warning: "notice noticeWarning",
  error: "notice noticeError",
  success: "notice noticeSuccess",
  embeddedShell: "overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white p-3",
  loadingShell: "space-y-3 rounded-2xl border border-dashed border-zinc-300 p-4",
  loadingText: "text-sm text-zinc-600",
  pulseRow: "h-9 animate-pulse rounded-xl bg-zinc-200",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// Stripe Connect onboarding, rendered inside the settings Payouts section.
const CreatorPayoutSettings = ({ isCreatorApproved }: CreatorPayoutSettingsProps) => {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const paymentAccountQuery = useCreatorPaymentAccount();
  const syncAccount = useSyncStripeConnectAccount();

  const paymentAccount = paymentAccountQuery.data ?? null;
  const isReady = getCreatorPaymentAccountIsReady(paymentAccount);

  const [country, setCountry] = useState(() => paymentAccount?.country || "CA");
  const [defaultCurrency, setDefaultCurrency] = useState(
    () => paymentAccount?.default_currency || "cad",
  );
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startEmbeddedOnboarding = useCallback(async () => {
    if (!token) {
      setErrMsg("You must be signed in to start Stripe setup.");
      return;
    }

    setIsStarting(true);
    setErrMsg(null);
    setSuccessMsg(null);
    setConnectInstance(null);

    try {
      const publishableKey = getStripePublishableKey();
      const response = await createStripeConnectAccountSession({
        token,
        country,
        defaultCurrency,
      });

      setConnectInstance(
        loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => response.accountSession.clientSecret,
        }),
      );
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [country, defaultCurrency, token]);

  const refreshStatus = useCallback(async () => {
    setErrMsg(null);

    try {
      await syncAccount.mutateAsync();
      await paymentAccountQuery.refetch();
      setSuccessMsg("Payout status refreshed.");
    } catch (error) {
      setSuccessMsg(null);
      setErrMsg(getErrorMessage(error));
    }
  }, [paymentAccountQuery, syncAccount]);

  const handleOnboardingExit = useCallback(async () => {
    setSuccessMsg("Stripe setup was saved. Refreshing payout status…");
    await refreshStatus();
  }, [refreshStatus]);

  if (!isCreatorApproved) {
    return (
      <p className={classes.text}>
        Payout setup opens once your creator application is approved.
      </p>
    );
  }

  return (
    <>
      {!isReady && (
        <div className={classes.warning}>
          Finish Stripe setup before publishing active listings or receiving buyer payments.
        </div>
      )}

      <div className={classes.form}>
        <label className={classes.field}>
          <span className={classes.label}>Country</span>
          <input
            className={classes.input}
            maxLength={2}
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            placeholder="CA"
          />
        </label>

        <label className={classes.field}>
          <span className={classes.label}>Currency</span>
          <input
            className={classes.input}
            maxLength={3}
            value={defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value.toLowerCase())}
            placeholder="cad"
          />
        </label>

        <div className={classes.actions}>
          <button
            className={classes.secondaryButton}
            type="button"
            disabled={syncAccount.isPending}
            onClick={() => void refreshStatus()}
          >
            {syncAccount.isPending ? "Refreshing…" : "Refresh status"}
          </button>

          <button
            className={classes.button}
            type="button"
            disabled={isStarting}
            onClick={() => void startEmbeddedOnboarding()}
          >
            {isStarting
              ? "Preparing…"
              : connectInstance
                ? "Restart Stripe setup"
                : isReady
                  ? "Review Stripe details"
                  : "Start Stripe setup"}
          </button>
        </div>
      </div>

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {isStarting && !connectInstance && (
        <div className={classes.loadingShell}>
          <p className={classes.loadingText}>Opening secure Stripe onboarding…</p>
          <div className={classes.pulseRow} />
        </div>
      )}

      {connectInstance && (
        <div className={classes.embeddedShell}>
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding onExit={() => void handleOnboardingExit()} />
          </ConnectComponentsProvider>
        </div>
      )}
    </>
  );
};

export default CreatorPayoutSettings;
