import { canSendListingRequestChangeOrder } from "../domain/listings/listingRequestChangeOrders";
import type { ListingRequestChangeOrderRow } from "../hooks/creatorRequests/useListingRequestChangeOrders";

type ListingRequestChangeOrderCreatorActionsProps = {
  changeOrder: Pick<
    ListingRequestChangeOrderRow,
    "id" | "status" | "title"
  > | null;
  isPending?: boolean;
  error?: unknown;
  onSendChangeOrder: (
    changeOrderId: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  draft:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project change order could not be sent.";

const ListingRequestChangeOrderCreatorActions = ({
  changeOrder,
  isPending = false,
  error,
  onSendChangeOrder,
}: ListingRequestChangeOrderCreatorActionsProps) => {
  if (
    !changeOrder ||
    !canSendListingRequestChangeOrder(changeOrder.status)
  ) {
    return null;
  }

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Change order actions
          </h2>

          <p className={classes.text}>
            This change order is saved as a private draft.
            Send it when it is ready for buyer review.
          </p>
        </div>

        <div className={classes.draft}>
          Draft: {changeOrder.title}
        </div>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="button"
            onClick={() =>
              void onSendChangeOrder(changeOrder.id)
            }
          >
            {isPending
              ? "Sending change order…"
              : "Send draft to buyer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderCreatorActions;