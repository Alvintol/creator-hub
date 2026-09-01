import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from "@stripe/connect-js";
import { useCallback, useMemo, useState } from "react";
import {
  createStripeConnectAccountSession,
  type StripeConnectAccountSessionResponse,
} from "../../hooks/payments/useStripeConnectAccountSession";
import {
  getCreatorPaymentAccountIsReady,
  getCreatorPaymentAccountStatusLabel,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";
import { useSyncStripeConnectAccount } from "../../hooks/payments/useStripeConnectOnboarding";
import { getStripePublishableKey } from "../../lib/stripeClient";
import { useAuth } from "../../providers/AuthProvider";

type CreatorPaymentSettingsCardProps = {
  isCreatorApproved: boolean;
};

const classes = {
  card: "card p-6",
  header: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
  eyebrow: "text-xs font-black uppercase tracking-[0.22em] text-orange-600",
  title: "text-xl font-black tracking-tight text-zinc-950",
  text: "mt-2 text-sm leading-6 text-zinc-600",
  status:
    "inline-flex w-fit items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-700",
  ready:
    "inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700",
  form: "mt-5 grid gap-4 sm:grid-cols-2",
  field: "flex flex-col gap-2",
  label: "text-sm font-bold text-zinc-900",
  input:
    "rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100",
  actions: "mt-5 flex flex-wrap items-center gap-3",
  button:
    "inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition hover:-translate-y-[1px] hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
  secondaryButton:
    "inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition hover:-translate-y-[1px] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
  warning:
    "mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900",
  error:
    "mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900",
  success:
    "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900",
  embeddedShell:
    "mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4",
  loadingShell:
    "mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5",
  loadingTitle: "text-sm font-black text-zinc-950",
  loadingText: "mt-2 text-sm leading-6 text-zinc-600",
  pulseRow: "mt-4 h-10 animate-pulse rounded-2xl bg-zinc-200",
  pulseShort: "mt-3 h-4 w-2/3 animate-pulse rounded-full bg-zinc-200",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const getDefaultCountry = (
  accountCountry: string | null | undefined,
): string => accountCountry || "CA";

const getDefaultCurrency = (
  accountCurrency: string | null | undefined,
): string => accountCurrency || "cad";

const CreatorPaymentSettingsCard = ({
  isCreatorApproved,
}: CreatorPaymentSettingsCardProps) => {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const paymentAccountQuery = useCreatorPaymentAccount();
  const syncAccount = useSyncStripeConnectAccount();

  const paymentAccount = paymentAccountQuery.data ?? null;
  const isReady = getCreatorPaymentAccountIsReady(paymentAccount);

  const [country, setCountry] = useState(() =>
    getDefaultCountry(paymentAccount?.country),
  );
  const [defaultCurrency, setDefaultCurrency] = useState(() =>
    getDefaultCurrency(paymentAccount?.default_currency),
  );
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance | null>(null);
  const [accountSession, setAccountSession] =
    useState<StripeConnectAccountSessionResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const statusLabel = useMemo(
    () => getCreatorPaymentAccountStatusLabel(paymentAccount),
    [paymentAccount],
  );

  const startEmbeddedOnboarding = useCallback(async () => {
    if (!token) {
      setErrMsg("You must be signed in to start Stripe setup.");
      return;
    }

    setIsStarting(true);
    setErrMsg(null);
    setSuccessMsg(null);
    setAccountSession(null);
    setConnectInstance(null);

    try {
      const publishableKey = getStripePublishableKey();

      const response = await createStripeConnectAccountSession({
        token,
        country,
        defaultCurrency,
      });

      setAccountSession(response);

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => response.accountSession.clientSecret,
      });

      setConnectInstance(instance);
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [country, defaultCurrency, token]);

  const handleOnboardingExit = useCallback(async () => {
    setSuccessMsg("Stripe setup was saved. Refreshing payout status…");
    setErrMsg(null);

    try {
      await syncAccount.mutateAsync();
      await paymentAccountQuery.refetch();
      setSuccessMsg("Payout status refreshed.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  }, [paymentAccountQuery, syncAccount]);

  if (!isCreatorApproved) {
    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>Creator payouts</p>
        <h2 className={classes.title}>Stripe setup locked</h2>
        <p className={classes.text}>
          Creator payout setup becomes available after your creator application
          is approved.
        </p>
      </section>
    );
  }

  return (
    <section className={classes.card}>
      <div className={classes.header}>
        <div>
          <p className={classes.eyebrow}>Creator payouts</p>
          <h2 className={classes.title}>Set up Stripe payouts</h2>
          <p className={classes.text}>
            Complete Stripe onboarding inside CreatorHub so buyers can pay you
            securely for accepted project work.
          </p>
        </div>

        <span className={isReady ? classes.ready : classes.status}>
          {statusLabel}
        </span>
      </div>

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
          <span className={classes.label}>Default currency</span>
          <input
            className={classes.input}
            maxLength={3}
            value={defaultCurrency}
            onChange={(event) =>
              setDefaultCurrency(event.target.value.toLowerCase())
            }
            placeholder="cad"
          />
        </label>
      </div>

      <div className={classes.actions}>
        <button
          className={classes.button}
          type="button"
          disabled={isStarting}
          onClick={startEmbeddedOnboarding}
        >
          {isStarting
            ? "Preparing Stripe setup…"
            : connectInstance
              ? "Restart embedded setup"
              : "Start embedded setup"}
        </button>

        <button
          className={classes.secondaryButton}
          type="button"
          disabled={syncAccount.isPending}
          onClick={() => {
            setSuccessMsg(null);
            setErrMsg(null);
            syncAccount
              .mutateAsync()
              .then(() => paymentAccountQuery.refetch())
              .then(() => setSuccessMsg("Payout status refreshed."))
              .catch((error) => setErrMsg(getErrorMessage(error)));
          }}
        >
          Refresh payout status
        </button>
      </div>

      {!isReady && (
        <div className={classes.warning}>
          Payout setup must be complete before this creator can publish active
          listings or receive buyer payments.
        </div>
      )}

      {accountSession && (
        <div className={classes.success}>
          Stripe account ready for embedded setup:{" "}
          <strong>{accountSession.account.stripeAccountId}</strong>
        </div>
      )}

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {isStarting && !connectInstance && (
        <div className={classes.loadingShell}>
          <p className={classes.loadingTitle}>Preparing Stripe setup…</p>
          <p className={classes.loadingText}>
            CreatorHub is opening the secure Stripe onboarding component. This can take
            a moment the first time.
          </p>
          <div className={classes.pulseRow} />
          <div className={classes.pulseShort} />
        </div>
      )}

      {connectInstance && (
        <div className={classes.embeddedShell}>
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding onExit={handleOnboardingExit} />
          </ConnectComponentsProvider>
        </div>
      )}
    </section>
  );
};

export default CreatorPaymentSettingsCard;