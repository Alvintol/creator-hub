import {
  canStartWorkForAcceptedRequest,
  getListingRequestPaymentStructureLabel,
} from "../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestAgreementWorkReadinessCardProps = {
  requestStatus: string;
  agreement: Pick<
    ListingRequestAgreementRow,
    | "status"
    | "starting_payment_status"
    | "payment_structure"
    | "deposit_amount"
    | "total_amount"
    | "currency"
  > | null;
};

const classes = {
  card: "rounded-2xl border px-4 py-4",
  readyCard: "border-emerald-200 bg-emerald-50 text-emerald-950",
  blockedCard: "border-amber-200 bg-amber-50 text-amber-950",
  mutedCard: "border-zinc-200 bg-zinc-50 text-zinc-800",
  title: "text-sm font-extrabold",
  text: "mt-1 text-sm",
  metaGrid: "mt-4 grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide opacity-70",
  metaValue: "text-sm font-semibold",
} as const;

const formatMoney = (amount: number | null, currency: string): string => {
  if (amount === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
};

const getStartingPaymentAmount = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "deposit_amount" | "total_amount"
  >
): number | null => agreement.deposit_amount ?? agreement.total_amount ?? null;

const ListingRequestAgreementWorkReadinessCard = ({
  requestStatus,
  agreement,
}: ListingRequestAgreementWorkReadinessCardProps) => {
  if (!agreement || agreement.status !== "buyer_accepted") {
    return null;
  }

  const canStartWork = canStartWorkForAcceptedRequest({
    requestStatus,
    agreementStatus: agreement.status,
    startingPaymentStatus: agreement.starting_payment_status,
  });

  const cardClass = canStartWork
    ? `${classes.card} ${classes.readyCard}`
    : requestStatus === "accepted"
      ? `${classes.card} ${classes.blockedCard}`
      : `${classes.card} ${classes.mutedCard}`;

  const startingPaymentAmount = getStartingPaymentAmount(agreement);

  return (
    <div className={cardClass}>
      <div className={classes.title}>
        {canStartWork
          ? "Work may begin"
          : "Payment required before work starts"}
      </div>

      <p className={classes.text}>
        {canStartWork
          ? "The buyer accepted the project agreement and the starting payment requirement is cleared."
          : requestStatus === "accepted"
            ? "The buyer accepted the project agreement, but work should not begin until the required starting payment or deposit is marked paid."
            : "This agreement was accepted, but the request is no longer in an active accepted state."}
      </p>

      <div className={classes.metaGrid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Payment structure</div>
          <div className={classes.metaValue}>
            {getListingRequestPaymentStructureLabel(agreement.payment_structure)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Starting payment</div>
          <div className={classes.metaValue}>
            {agreement.starting_payment_status === "not_required"
              ? "Not required"
              : agreement.starting_payment_status === "paid"
                ? "Paid"
                : formatMoney(startingPaymentAmount, agreement.currency)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementWorkReadinessCard;