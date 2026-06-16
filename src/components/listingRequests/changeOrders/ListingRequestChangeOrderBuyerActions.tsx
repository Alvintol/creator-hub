import { useState } from "react";

import { canBuyerRespondToListingRequestChangeOrder } from "../domain/listings/listingRequestChangeOrders";
import type { ListingRequestChangeOrderRow } from "../hooks/creatorRequests/useListingRequestChangeOrders";

type BuyerChangeOrder = Pick<
  ListingRequestChangeOrderRow,
  "id" | "status" | "title"
>;

type ListingRequestChangeOrderBuyerActionsProps = {
  changeOrder: BuyerChangeOrder | null;
  isPending?: boolean;
  error?: unknown;
  onAccept: (
    changeOrderId: string
  ) => Promise<unknown> | unknown;
  onDecline: (
    changeOrderId: string,
    responseReason: string | null
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  changeOrder:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900",
  warning:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  textarea:
    "min-h-28 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)]",
  help: "text-xs text-zinc-500",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project change order response could not be saved.";

const ListingRequestChangeOrderBuyerActions = ({
  changeOrder,
  isPending = false,
  error,
  onAccept,
  onDecline,
}: ListingRequestChangeOrderBuyerActionsProps) => {
  const [isAcceptConfirming, setIsAcceptConfirming] =
    useState(false);

  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  if (
    !changeOrder ||
    !canBuyerRespondToListingRequestChangeOrder(
      changeOrder.status
    )
  ) {
    return null;
  }

  const trimmedDeclineReason = declineReason.trim();
  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  const handleStartAccept = () => {
    setIsDeclining(false);
    setIsAcceptConfirming(true);
  };

  const handleConfirmAccept = async () => {
    await onAccept(changeOrder.id);
  };

  const handleStartDecline = () => {
    setIsAcceptConfirming(false);
    setIsDeclining(true);
  };

  const handleConfirmDecline = async () => {
    await onDecline(
      changeOrder.id,
      trimmedDeclineReason || null
    );
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Respond to change order
          </h2>

          <p className={classes.text}>
            Review the proposed changes carefully. They do
            not become enforceable until you accept them.
          </p>
        </div>

        <div className={classes.changeOrder}>
          {changeOrder.title}
        </div>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        {isAcceptConfirming && (
          <div className={classes.warning}>
            By accepting, you agree that the proposed
            project changes replace the affected terms of
            the currently accepted agreement.
          </div>
        )}

        {isDeclining && (
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="change-order-decline-reason"
            >
              Decline reason
            </label>

            <textarea
              className={classes.textarea}
              id="change-order-decline-reason"
              maxLength={2000}
              value={declineReason}
              onChange={(event) =>
                setDeclineReason(
                  event.currentTarget.value
                )
              }
              placeholder="Optionally explain why you are declining these changes."
            />

            <p className={classes.help}>
              {declineReason.length}/2000 characters.
              Providing a reason is optional.
            </p>
          </div>
        )}

        <div className={classes.actions}>
          {!isAcceptConfirming && !isDeclining && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={handleStartAccept}
              >
                Accept change order
              </button>

              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={handleStartDecline}
              >
                Decline change order
              </button>
            </>
          )}

          {isAcceptConfirming && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleConfirmAccept()
                }
              >
                {isPending
                  ? "Saving response…"
                  : "Confirm change order acceptance"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={() =>
                  setIsAcceptConfirming(false)
                }
              >
                Keep reviewing
              </button>
            </>
          )}

          {isDeclining && (
            <>
              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleConfirmDecline()
                }
              >
                {isPending
                  ? "Saving response…"
                  : "Confirm change order decline"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={() => {
                  setIsDeclining(false);
                  setDeclineReason("");
                }}
              >
                Keep reviewing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderBuyerActions;