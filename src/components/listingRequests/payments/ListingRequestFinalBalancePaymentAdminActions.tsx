import type {
  ListingRequestAgreementRow,
  ListingRequestPaymentScheduleItemRow,
} from "../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestFinalBalancePaymentAdminActionsProps = {
  agreement: Pick<
    ListingRequestAgreementRow,
    "listing_request_payment_schedule_items"
  > | null;
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (
    paymentScheduleItemId: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  notice:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  list: "space-y-3",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemTitle: "font-extrabold text-zinc-900",
  itemText: "mt-1 text-sm text-zinc-600",
  amount: "text-sm font-extrabold text-zinc-900",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  actions: "mt-4 flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const formatMoney = (
  amount: number,
  currency: string
): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The final-balance payment could not be confirmed.";

const getPendingFinalBalancePayments = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "listing_request_payment_schedule_items"
  >
): ListingRequestPaymentScheduleItemRow[] =>
  agreement.listing_request_payment_schedule_items
    .filter(
      (paymentItem) =>
        paymentItem.payment_timing ===
          "due_before_final_release" &&
        paymentItem.status === "payment_required" &&
        paymentItem.amount > 0
    )
    .sort(
      (firstPaymentItem, secondPaymentItem) =>
        firstPaymentItem.sort_order -
        secondPaymentItem.sort_order
    );

const ListingRequestFinalBalancePaymentAdminActions = ({
  agreement,
  isPending = false,
  error,
  onConfirmPayment,
}: ListingRequestFinalBalancePaymentAdminActionsProps) => {
  if (!agreement) {
    return null;
  }

  const pendingPayments =
    getPendingFinalBalancePayments(agreement);

  if (pendingPayments.length === 0) {
    return null;
  }

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  const handleConfirmPayment = (
    paymentItem: ListingRequestPaymentScheduleItemRow
  ) => {
    const confirmed = window.confirm(
      `Confirm that the final-balance payment "${paymentItem.title}" has been independently verified as paid?`
    );

    if (!confirmed) {
      return;
    }

    void onConfirmPayment(paymentItem.id);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Final-balance payment confirmation
          </h2>

          <p className={classes.text}>
            Confirm each final-balance payment only after
            payment has been independently verified.
          </p>
        </div>

        <div className={classes.notice}>
          Buyer approval remains blocked until every
          required final-balance payment has been
          confirmed.
        </div>

        {errorMessage && (
          <div className={classes.errorBox}>
            {errorMessage}
          </div>
        )}

        <div className={classes.list}>
          {pendingPayments.map((paymentItem) => (
            <div
              className={classes.item}
              key={paymentItem.id}
            >
              <div className={classes.itemHeader}>
                <div>
                  <div className={classes.itemTitle}>
                    {paymentItem.title}
                  </div>

                  {paymentItem.description && (
                    <div className={classes.itemText}>
                      {paymentItem.description}
                    </div>
                  )}
                </div>

                <div className={classes.amount}>
                  {formatMoney(
                    paymentItem.amount,
                    paymentItem.currency
                  )}
                </div>
              </div>

              <div className={classes.actions}>
                <button
                  className={classes.btnPrimary}
                  disabled={isPending}
                  type="button"
                  onClick={() =>
                    handleConfirmPayment(paymentItem)
                  }
                >
                  {isPending
                    ? "Confirming payment…"
                    : "Confirm final-balance payment"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListingRequestFinalBalancePaymentAdminActions;