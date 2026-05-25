import { canSendListingRequestAgreement } from "../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestAgreementCreatorActionsProps = {
  agreement: Pick<ListingRequestAgreementRow, "id" | "status"> | null;
  isPending?: boolean;
  error?: unknown;
  onSendAgreement: (agreementId: string) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project agreement could not be sent right now.";

const ListingRequestAgreementCreatorActions = ({
  agreement,
  isPending = false,
  error,
  onSendAgreement,
}: ListingRequestAgreementCreatorActionsProps) => {
  if (!agreement || !canSendListingRequestAgreement(agreement.status)) {
    return null;
  }

  const sendErrorMessage = error ? getErrorMessage(error) : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Project agreement actions</h2>

          <p className={classes.text}>
            This agreement is saved as a draft. Send it to the buyer when it is
            ready for review and acknowledgement.
          </p>
        </div>

        {sendErrorMessage && (
          <div className={classes.errorBox}>{sendErrorMessage}</div>
        )}

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={isPending}
            onClick={() => void onSendAgreement(agreement.id)}
          >
            {isPending ? "Sending agreement…" : "Send draft to buyer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementCreatorActions;