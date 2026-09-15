import { Link } from "react-router-dom";

import {
  canOpenListingRequestPaymentCheckout,
  getListingRequestPaymentActionLabel,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTitle,
  getListingRequestPaymentTypeLabel,
} from "../../../domain/payments/listingRequestPaymentDisplay";
import type { ListingRequestPaymentRow } from "../../../hooks/payments/useListingRequestPayments";

type ListingRequestPaymentsCardProps = {
  payments: ListingRequestPaymentRow[];
  isLoading?: boolean;
  error?: unknown;
  readOnly?: boolean;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemType: "text-xs font-semibold text-zinc-500",
  status:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  metaGrid: "mt-4 grid gap-3 sm:grid-cols-3",
  metaBlock: "space-y-1",
  metaLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm font-semibold text-zinc-900",
  feeText: "mt-3 text-xs leading-5 text-zinc-500",
  actions: "mt-4 flex flex-wrap items-center gap-3",
  payButton:
    "inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.14)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-zinc-800 hover:shadow-[0_9px_24px_rgba(0,0,0,0.18)]",
  loading:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  empty:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700",
} as const;

const formatMoney = (
  amountCents: number,
  currency: string,
): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Payments could not be loaded.";

const ListingRequestPaymentsCard = ({
  payments,
  isLoading = false,
  error,
  readOnly = false,
}: ListingRequestPaymentsCardProps) => {
  if (isLoading) {
    return (
      <section className={classes.card}>
        <div className={classes.loading}>Loading payments…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={classes.card}>
        <div className={classes.error}>
          {getErrorMessage(error)}
        </div>
      </section>
    );
  }

  if (payments.length === 0) {
    return null;
  }

  return (
    <section className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Payments</h2>
          <p className={classes.text}>
            Complete project payments securely through Stripe inside
            CreatorHub.
          </p>
        </div>

        <div className={classes.list}>
          {payments.map((payment) => {
            const actionLabel =
              getListingRequestPaymentActionLabel(payment.status);

            const canPay =
              !readOnly &&
              canOpenListingRequestPaymentCheckout(payment);

            return (
              <article
                key={payment.id}
                className={classes.item}
              >
                <div className={classes.itemHeader}>
                  <div className={classes.itemHeading}>
                    <h3 className={classes.itemTitle}>
                      {getListingRequestPaymentTitle(payment)}
                    </h3>

                    <p className={classes.itemType}>
                      {getListingRequestPaymentTypeLabel(
                        payment.payment_type,
                      )}
                    </p>
                  </div>

                  <span className={classes.status}>
                    {getListingRequestPaymentStatusLabel(
                      payment.status,
                    )}
                  </span>
                </div>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      Project amount
                    </div>
                    <div className={classes.metaValue}>
                      {formatMoney(
                        payment.base_amount_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      Service fee
                    </div>
                    <div className={classes.metaValue}>
                      {formatMoney(
                        payment.buyer_service_fee_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>
                      Total
                    </div>
                    <div className={classes.metaValue}>
                      {formatMoney(
                        payment.total_checkout_cents,
                        payment.currency,
                      )}
                    </div>
                  </div>
                </div>

                {payment.creator_tip_cents > 0 && (
                  <p className={classes.feeText}>
                    Includes{" "}
                    {formatMoney(
                      payment.creator_tip_cents,
                      payment.currency,
                    )}{" "}
                    creator tip.
                  </p>
                )}

                {payment.platform_support_cents > 0 && (
                  <p className={classes.feeText}>
                    Includes{" "}
                    {formatMoney(
                      payment.platform_support_cents,
                      payment.currency,
                    )}{" "}
                    optional CreatorHub support.
                  </p>
                )}

                {canPay && actionLabel && (
                  <div className={classes.actions}>
                    <Link
                      className={classes.payButton}
                      to={`/payments/checkout/${payment.id}`}
                    >
                      {actionLabel}
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ListingRequestPaymentsCard;