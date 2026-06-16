import { getListingRequestPaymentStructureLabel } from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

type AdminPaymentAgreement = Pick<
  ListingRequestAgreementRow,
  | "id"
  | "status"
  | "starting_payment_status"
  | "payment_structure"
  | "deposit_amount"
  | "total_amount"
  | "currency"
>;

type ListingRequestAgreementAdminPaymentActionsProps = {
  agreement: AdminPaymentAgreement | null;
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (agreementId: string) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  warning:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm font-semibold text-zinc-900",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

const getStartingPaymentAmount = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "deposit_amount" | "total_amount"
  >
): number => agreement.deposit_amount ?? agreement.total_amount;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The starting payment could not be confirmed.";

const ListingRequestAgreementAdminPaymentActions = ({
  agreement,
  isPending = false,
  error,
  onConfirmPayment,
}: ListingRequestAgreementAdminPaymentActionsProps) => {
  if (
    !agreement ||
    agreement.status !== "buyer_accepted" ||
    agreement.starting_payment_status !== "payment_required"
  ) {
    return null;
  }

  const startingPaymentAmount = getStartingPaymentAmount(agreement);
  const errorMessage = error ? getErrorMessage(error) : null;

  const handleConfirmPayment = () => {
    const confirmed = window.confirm(
      "Confirm that the required starting payment has been independently verified as paid? This will allow work to begin."
    );

    if (!confirmed) {
      return;
    }

    void onConfirmPayment(agreement.id);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Starting payment confirmation</h2>

          <p className={classes.text}>
            Confirm the required starting payment only after the payment has
            been independently verified.
          </p>
        </div>

        <div className={classes.warning}>
          Confirming this payment will close the starting-payment hold and mark
          the project as ready for work.
        </div>

        <div className={classes.metaGrid}>
          <div className={classes.metaBlock}>
            <div className={classes.metaLabel}>Payment structure</div>

            <div className={classes.metaValue}>
              {getListingRequestPaymentStructureLabel(
                agreement.payment_structure
              )}
            </div>
          </div>

          <div className={classes.metaBlock}>
            <div className={classes.metaLabel}>Amount to confirm</div>

            <div className={classes.metaValue}>
              {formatMoney(startingPaymentAmount, agreement.currency)}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className={classes.errorBox}>{errorMessage}</div>
        )}

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={isPending}
            onClick={handleConfirmPayment}
          >
            {isPending
              ? "Confirming starting payment…"
              : "Confirm starting payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementAdminPaymentActions;