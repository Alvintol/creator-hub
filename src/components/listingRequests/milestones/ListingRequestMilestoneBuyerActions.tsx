import { useState } from "react";

import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import type { RespondListingRequestMilestoneInput } from "../../../hooks/creatorRequests/useRespondListingRequestMilestone";

type ListingRequestMilestoneBuyerActionsProps = {
  milestone: ListingRequestMilestoneRow | null;
  isPending?: boolean;
  error?: unknown;
  onRespondMilestone: (
    input: RespondListingRequestMilestoneInput
  ) => Promise<unknown> | unknown;
};

const classes = {
  card:
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
  eyebrow:
    "text-xs font-semibold uppercase tracking-[0.2em] text-blue-600",
  title:
    "mt-2 text-lg font-semibold text-slate-950",
  description:
    "mt-2 text-sm leading-6 text-slate-600",
  actions:
    "mt-5 flex flex-wrap gap-3",
  primaryButton:
    "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300",
  secondaryButton:
    "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400",
  form:
    "mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4",
  label:
    "text-sm font-semibold text-slate-800",
  textarea:
    "min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100",
  help:
    "text-xs leading-5 text-slate-500",
  error:
    "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
};

const getErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message
    );
  }

  return "The milestone response could not be saved.";
};

const getMilestonePosition = (
  milestone: ListingRequestMilestoneRow
): string => `Milestone ${milestone.sort_order + 1}`;

const getIsSubmittedMilestone = (
  milestone: ListingRequestMilestoneRow | null
): boolean => milestone?.status === "submitted";

const ListingRequestMilestoneBuyerActions = ({
  milestone,
  isPending = false,
  error = null,
  onRespondMilestone,
}: ListingRequestMilestoneBuyerActionsProps) => {
  const [showRevisionForm, setShowRevisionForm] =
    useState(false);
  const [revisionReason, setRevisionReason] =
    useState("");
  const [clientError, setClientError] =
    useState<string | null>(null);

  const errorMessage =
    clientError ?? getErrorMessage(error);

  const handleApprove = async () => {
    const currentMilestone = milestone;

    if (
      !currentMilestone ||
      !getIsSubmittedMilestone(currentMilestone)
    ) {
      return;
    }

    setClientError(null);

    await onRespondMilestone({
      milestoneId: currentMilestone.id,
      response: "buyer_approved",
    });
  };

  const handleOpenRevisionForm = () => {
    setClientError(null);
    setShowRevisionForm(true);
  };

  const handleCancelRevision = () => {
    setClientError(null);
    setRevisionReason("");
    setShowRevisionForm(false);
  };

  const handleRequestRevision = async () => {
    const currentMilestone = milestone;

    if (
      !currentMilestone ||
      !getIsSubmittedMilestone(currentMilestone)
    ) {
      return;
    }

    const cleanReason = revisionReason.trim();

    if (
      cleanReason.length < 10 ||
      cleanReason.length > 2000
    ) {
      setClientError(
        "Revision notes must be between 10 and 2000 characters."
      );

      return;
    }

    setClientError(null);

    await onRespondMilestone({
      milestoneId: currentMilestone.id,
      response: "revision_requested",
      revisionRequestReason: cleanReason,
    });

    setRevisionReason("");
    setShowRevisionForm(false);
  };

  if (!milestone) {
    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone review
        </p>

        <h2 className={classes.title}>
          No milestone is ready for review.
        </h2>

        <p className={classes.description}>
          The creator can submit the next milestone once
          earlier milestone work and payments are resolved.
        </p>
      </section>
    );
  }

  const currentMilestone = milestone;

  if (!getIsSubmittedMilestone(currentMilestone)) {
    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone review
        </p>

        <h2 className={classes.title}>
          No buyer response is needed.
        </h2>

        <p className={classes.description}>
          {getMilestonePosition(currentMilestone)} is currently{" "}
          {currentMilestone.status.replaceAll("_", " ")}.
        </p>
      </section>
    );
  }

  return (
    <section className={classes.card}>
      <p className={classes.eyebrow}>
        Milestone review
      </p>

      <h2 className={classes.title}>
        Review {getMilestonePosition(currentMilestone)}
        : {currentMilestone.title}
      </h2>

      <p className={classes.description}>
        Approve this milestone when the submitted work is
        accepted. If something needs to change, request
        revisions and include clear notes for the creator.
      </p>

      {errorMessage && (
        <div className={classes.error}>
          {errorMessage}
        </div>
      )}

      <div className={classes.actions}>
        <button
          className={classes.primaryButton}
          disabled={isPending}
          type="button"
          onClick={handleApprove}
        >
          Approve milestone
        </button>

        <button
          className={classes.secondaryButton}
          disabled={isPending}
          type="button"
          onClick={handleOpenRevisionForm}
        >
          Request revisions
        </button>
      </div>

      {showRevisionForm && (
        <div className={classes.form}>
          <label className={classes.label}>
            Revision notes
            <textarea
              className={classes.textarea}
              disabled={isPending}
              placeholder="Describe what needs to change before this milestone can be approved."
              value={revisionReason}
              onChange={(event) =>
                setRevisionReason(
                  event.target.value
                )
              }
            />
          </label>

          <p className={classes.help}>
            Be specific so the creator knows what to
            adjust. Notes must be between 10 and 2000
            characters.
          </p>

          <div className={classes.actions}>
            <button
              className={classes.primaryButton}
              disabled={isPending}
              type="button"
              onClick={handleRequestRevision}
            >
              Send revision request
            </button>

            <button
              className={classes.secondaryButton}
              disabled={isPending}
              type="button"
              onClick={handleCancelRevision}
            >
              Cancel revision request
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ListingRequestMilestoneBuyerActions;