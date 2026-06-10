import { useState } from "react";

import { canBuyerRespondToListingRequestFinalDelivery } from "../domain/listings/listingRequestFinalDeliveries";
import type { ListingRequestFinalDeliveryRow } from "../hooks/creatorRequests/useListingRequestFinalDeliveries";

type BuyerFinalDelivery = Pick<
  ListingRequestFinalDeliveryRow,
  "id" | "status" | "title"
>;

type ResponseMode =
  | "idle"
  | "approve"
  | "revision";

type ListingRequestFinalDeliveryBuyerActionsProps = {
  finalDelivery: BuyerFinalDelivery | null;
  canApprove: boolean;
  approvalBlockedReason?: string | null;
  isPending?: boolean;
  error?: unknown;
  onApprove: (
    finalDeliveryId: string
  ) => Promise<unknown> | unknown;
  onRequestRevision: (
    finalDeliveryId: string,
    revisionRequestReason: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  delivery:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900",
  warning:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  confirmation:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  textarea:
    "min-h-28 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)]",
  help: "text-xs text-zinc-500",
  validationError:
    "text-xs font-semibold text-red-600",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The final delivery response could not be saved.";

const ListingRequestFinalDeliveryBuyerActions = ({
  finalDelivery,
  canApprove,
  approvalBlockedReason,
  isPending = false,
  error,
  onApprove,
  onRequestRevision,
}: ListingRequestFinalDeliveryBuyerActionsProps) => {
  const [responseMode, setResponseMode] =
    useState<ResponseMode>("idle");

  const [revisionReason, setRevisionReason] =
    useState("");

  const [validationError, setValidationError] =
    useState<string | null>(null);

  if (
    !finalDelivery ||
    !canBuyerRespondToListingRequestFinalDelivery(
      finalDelivery.status
    )
  ) {
    return null;
  }

  const trimmedRevisionReason =
    revisionReason.trim();

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  const handleStartApproval = () => {
    if (!canApprove) {
      return;
    }

    setValidationError(null);
    setResponseMode("approve");
  };

  const handleApprove = async () => {
    try {
      await onApprove(finalDelivery.id);
    } catch {
      // Mutation errors are surfaced through the error prop.
    }
  };

  const handleStartRevision = () => {
    setValidationError(null);
    setResponseMode("revision");
  };

  const handleRequestRevision = async () => {
    if (trimmedRevisionReason.length < 10) {
      setValidationError(
        "Revision request details must contain at least 10 characters."
      );

      return;
    }

    setValidationError(null);

    try {
      await onRequestRevision(
        finalDelivery.id,
        trimmedRevisionReason
      );
    } catch {
      // Mutation errors are surfaced through the error prop.
    }
  };

  const handleKeepReviewing = () => {
    setResponseMode("idle");
    setRevisionReason("");
    setValidationError(null);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Respond to final delivery
          </h2>

          <p className={classes.text}>
            Review the submitted work before approving it
            or requesting revisions.
          </p>
        </div>

        <div className={classes.delivery}>
          {finalDelivery.title}
        </div>

        {!canApprove && approvalBlockedReason && (
          <div className={classes.warning}>
            {approvalBlockedReason}
          </div>
        )}

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        {responseMode === "approve" && (
          <div className={classes.confirmation}>
            Approving confirms that the submitted final
            delivery satisfies the accepted project
            agreement and any accepted change orders.
          </div>
        )}

        {responseMode === "revision" && (
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="final-delivery-revision-reason"
            >
              Required revisions
            </label>

            <textarea
              className={classes.textarea}
              id="final-delivery-revision-reason"
              maxLength={2000}
              value={revisionReason}
              onChange={(event) => {
                setRevisionReason(
                  event.currentTarget.value
                );

                setValidationError(null);
              }}
              placeholder="Describe the specific revisions required before you can approve the delivery."
            />

            <p className={classes.help}>
              {revisionReason.length}/2000 characters.
              Include enough detail for the creator to
              understand the required changes.
            </p>

            {validationError && (
              <p className={classes.validationError}>
                {validationError}
              </p>
            )}
          </div>
        )}

        <div className={classes.actions}>
          {responseMode === "idle" && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={!canApprove || isPending}
                type="button"
                onClick={handleStartApproval}
              >
                Approve final delivery
              </button>

              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={handleStartRevision}
              >
                Request revisions
              </button>
            </>
          )}

          {responseMode === "approve" && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={() => void handleApprove()}
              >
                {isPending
                  ? "Saving response…"
                  : "Confirm final delivery approval"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={handleKeepReviewing}
              >
                Keep reviewing
              </button>
            </>
          )}

          {responseMode === "revision" && (
            <>
              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleRequestRevision()
                }
              >
                {isPending
                  ? "Saving response…"
                  : "Submit revision request"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={handleKeepReviewing}
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

export default ListingRequestFinalDeliveryBuyerActions;