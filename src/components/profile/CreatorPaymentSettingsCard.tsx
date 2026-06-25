import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getCreatorPaymentAccountIsReady,
  getCreatorPaymentAccountStatusLabel,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";
import {
  getStripeConnectErrorActionUrl,
  useStartStripeConnectOnboarding,
  useSyncStripeConnectAccount,
} from "../../hooks/payments/useStripeConnectOnboarding";

type CreatorPaymentSettingsCardProps = {
  isCreatorApproved: boolean;
};

const classes = {
  card: "card p-6",
  header: "flex flex-wrap items-start justify-between gap-4",
  title: "text-base font-extrabold tracking-tight",
  help: "mt-1 text-sm text-zinc-600",
  grid: "mt-4 grid gap-4 md:grid-cols-2",
  field: "space-y-2",
  label: "text-sm font-extrabold text-zinc-800",
  input:
    "w-full rounded-xl bg-white px-4 py-3 text-sm outline-none transition ring-1 ring-zinc-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
  statusGrid: "mt-4 grid gap-3 md:grid-cols-3",
  statusCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  statusLabel: "text-xs font-bold uppercase tracking-[0.18em] text-zinc-500",
  statusValue: "mt-1 text-sm font-extrabold text-zinc-900",
  row: "mt-5 flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  bannerInfo: "mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900",
  bannerOk:
    "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  bannerErr:
    "mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900",
  bannerTitle: "text-sm font-extrabold",
  bannerText: "mt-1 text-sm",
  muted: "mt-2 text-xs text-zinc-500",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const isTwoLetterCountryCode = (value: string): boolean =>
  /^[A-Z]{2}$/.test(value.trim().toUpperCase());

const isThreeLetterCurrencyCode = (value: string): boolean =>
  /^[a-z]{3}$/.test(value.trim().toLowerCase());

const formatBooleanStatus = (value?: boolean | null): string =>
  value ? "Yes" : "No";

const CreatorPaymentSettingsCard = ({
  isCreatorApproved,
}: CreatorPaymentSettingsCardProps) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const {
    data: account = null,
    isLoading,
    error,
  } = useCreatorPaymentAccount();
  const startStripeConnect = useStartStripeConnectOnboarding();
  const syncStripeConnect = useSyncStripeConnectAccount();

  const [country, setCountry] = useState("CA");
  const [defaultCurrency, setDefaultCurrency] = useState("cad");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [actionUrl, setActionUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      return;
    }

    setCountry(account.country);
    setDefaultCurrency(account.default_currency);
  }, [account]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const stripeStatus = params.get("stripe");

    if (stripeStatus !== "return" && stripeStatus !== "refresh") {
      return;
    }

    const sync = async () => {
      setOkMsg(null);
      setErrMsg(null);
      setInfoMsg("Refreshing your Stripe payout status…");

      try {
        await syncStripeConnect.mutateAsync();
        setOkMsg("Stripe payout status refreshed.");
        setInfoMsg(null);
      } catch (error) {
        setErrMsg(getErrorMessage(error));
        setInfoMsg(null);
      } finally {
        navigate({ pathname: "/settings/profile", search: "" }, { replace: true });
      }
    };

    void sync();
  }, [navigate, search, syncStripeConnect]);

  const statusLabel = useMemo(
    () => getCreatorPaymentAccountStatusLabel(account),
    [account],
  );

  const isReady = useMemo(
    () => getCreatorPaymentAccountIsReady(account),
    [account],
  );

  const isBusy =
    isLoading ||
    startStripeConnect.isPending ||
    syncStripeConnect.isPending;

  const onStartStripeConnect = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);
    setActionUrl(null);

    const nextCountry = country.trim().toUpperCase();
    const nextCurrency = defaultCurrency.trim().toLowerCase();

    if (!isTwoLetterCountryCode(nextCountry)) {
      setErrMsg("Enter a valid two-letter country code, such as CA or US.");
      return;
    }

    if (!isThreeLetterCurrencyCode(nextCurrency)) {
      setErrMsg("Enter a valid three-letter currency code, such as cad or usd.");
      return;
    }

    try {
      const response = await startStripeConnect.mutateAsync({
        country: nextCountry,
        defaultCurrency: nextCurrency,
      });

      window.location.assign(response.url);
    } catch (error) {
      setErrMsg(getErrorMessage(error));
      setActionUrl(getStripeConnectErrorActionUrl(error));
    }
  };

  const onSyncStripeConnect = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);
    setActionUrl(null);

    try {
      await syncStripeConnect.mutateAsync();
      setOkMsg("Stripe payout status refreshed.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  return (
    <section className={classes.card}>
      <div className={classes.header}>
        <div>
          <h2 className={classes.title}>Creator payouts</h2>
          <p className={classes.help}>
            Connect Stripe so CreatorHub can collect buyer payments and release
            approved creator earnings automatically.
          </p>
        </div>
        <div className={classes.statusCard}>
          <div className={classes.statusLabel}>Status</div>
          <div className={classes.statusValue}>{statusLabel}</div>
        </div>
      </div>

      {!isCreatorApproved && (
        <div className={classes.bannerInfo}>
          <div className={classes.bannerTitle}>Creator approval required</div>
          <p className={classes.bannerText}>
            Stripe payout onboarding opens after your CreatorHub creator
            application is approved.
          </p>
        </div>
      )}

      {isReady && (
        <div className={classes.bannerOk}>
          <div className={classes.bannerTitle}>Payouts ready</div>
          <p className={classes.bannerText}>
            Your Stripe account is ready. You can publish paid listings once the
            listing passes the usual listing checks.
          </p>
        </div>
      )}

      {(errMsg || error) && (
        <div className={classes.bannerErr}>
          <div className={classes.bannerTitle}>Action needed</div>
          <p className={classes.bannerText}>
            {errMsg ?? getErrorMessage(error)}
          </p>
        </div>
      )}

      {actionUrl && (
        <div className={classes.row}>
          <a
            className={classes.btnOutline}
            href={actionUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Stripe Connect setup
          </a>
        </div>
      )}

      {okMsg && (
        <div className={classes.bannerOk}>
          <div className={classes.bannerTitle}>Success</div>
          <p className={classes.bannerText}>{okMsg}</p>
        </div>
      )}

      {infoMsg && (
        <div className={classes.bannerInfo}>
          <div className={classes.bannerTitle}>Checking Stripe</div>
          <p className={classes.bannerText}>{infoMsg}</p>
        </div>
      )}

      <div className={classes.statusGrid}>
        <div className={classes.statusCard}>
          <div className={classes.statusLabel}>Details submitted</div>
          <div className={classes.statusValue}>
            {formatBooleanStatus(account?.details_submitted)}
          </div>
        </div>
        <div className={classes.statusCard}>
          <div className={classes.statusLabel}>Charges enabled</div>
          <div className={classes.statusValue}>
            {formatBooleanStatus(account?.charges_enabled)}
          </div>
        </div>
        <div className={classes.statusCard}>
          <div className={classes.statusLabel}>Payouts enabled</div>
          <div className={classes.statusValue}>
            {formatBooleanStatus(account?.payouts_enabled)}
          </div>
        </div>
      </div>

      <div className={classes.grid}>
        <label className={classes.field}>
          <span className={classes.label}>Stripe country</span>
          <input
            className={classes.input}
            value={country}
            onChange={(event) =>
              setCountry(event.currentTarget.value.toUpperCase())
            }
            maxLength={2}
            placeholder="CA"
            disabled={!isCreatorApproved || Boolean(account)}
          />
        </label>

        <label className={classes.field}>
          <span className={classes.label}>Default currency</span>
          <input
            className={classes.input}
            value={defaultCurrency}
            onChange={(event) =>
              setDefaultCurrency(event.currentTarget.value.toLowerCase())
            }
            maxLength={3}
            placeholder="cad"
            disabled={!isCreatorApproved || Boolean(account)}
          />
        </label>
      </div>

      <p className={classes.muted}>
        Use the country and currency for the Stripe account that will receive
        creator payouts. After an account is created, changes should happen
        through Stripe or support.
      </p>

      <div className={classes.row}>
        <button
          className={classes.btnPrimary}
          type="button"
          onClick={onStartStripeConnect}
          disabled={!isCreatorApproved || isBusy || isReady}
        >
          {account ? "Continue Stripe onboarding" : "Connect Stripe"}
        </button>

        <button
          className={classes.btnOutline}
          type="button"
          onClick={onSyncStripeConnect}
          disabled={!isCreatorApproved || isBusy || !account}
        >
          Refresh payout status
        </button>
      </div>
    </section>
  );
};

export default CreatorPaymentSettingsCard;