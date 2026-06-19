import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";

type ListingRequestMilestonePaymentAdminActionsProps = {
  milestones: ListingRequestMilestoneRow[];
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (
    paymentScheduleItemId: string
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
  button:
    "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300",
  error:
    "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
};

const getErrorMessage = (
  error: unknown
): string | null => {
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

  return "The milestone payment could not be confirmed.";
};

const getSortedMilestones = (
  milestones: ListingRequestMilestoneRow[]
) =>
  [...milestones].sort(
    (firstMilestone, secondMilestone) =>
      firstMilestone.sort_order -
      secondMilestone.sort_order
  );

const getPaymentRequiredMilestone = (
  milestones: ListingRequestMilestoneRow[]
) =>
  getSortedMilestones(milestones).find(
    (milestone) =>
      milestone.status ===
      "payment_required"
  ) ?? null;

const getAdminMilestonePaymentStatusMessage = (
  milestones: ListingRequestMilestoneRow[]
): string => {
  if (milestones.length === 0) {
    return "No milestone payments are configured for this request yet.";
  }

  const sortedMilestones =
    getSortedMilestones(milestones);

  const submittedMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status === "submitted"
    ) ?? null;

  if (submittedMilestone) {
    return `Milestone ${submittedMilestone.sort_order + 1
      }: ${submittedMilestone.title
      } is waiting for buyer review before payment is required.`;
  }

  const revisionMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status ===
        "revision_requested"
    ) ?? null;

  if (revisionMilestone) {
    return `Milestone ${revisionMilestone.sort_order + 1
      }: ${revisionMilestone.title
      } has revisions requested. Payment is not required until the buyer approves the revised work.`;
  }

  const pendingMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status === "pending"
    ) ?? null;

  if (pendingMilestone) {
    return `Milestone ${pendingMilestone.sort_order + 1
      }: ${pendingMilestone.title
      } is waiting for creator submission.`;
  }

  const allMilestonesPaid =
    sortedMilestones.every(
      (milestone) =>
        milestone.status === "paid" ||
        milestone.status === "cancelled"
    );

  if (allMilestonesPaid) {
    return "All milestone payments have been confirmed.";
  }

  return "No milestone payment is awaiting admin confirmation right now.";
};

const ListingRequestMilestonePaymentAdminActions =
  ({
    milestones,
    isPending = false,
    error = null,
    onConfirmPayment,
  }: ListingRequestMilestonePaymentAdminActionsProps) => {
    const milestone =
      getPaymentRequiredMilestone(milestones);

    const errorMessage =
      getErrorMessage(error);

    if (!milestone) {
      return (
        <section className={classes.card}>
          <p className={classes.eyebrow}>
            Milestone payment
          </p>

          <h2 className={classes.title}>
            No milestone payment to confirm
          </h2>

          <p className={classes.description}>
            {getAdminMilestonePaymentStatusMessage(
              milestones
            )}
          </p>

          {errorMessage && (
            <div className={classes.error}>
              {errorMessage}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone payment
        </p>

        <h2 className={classes.title}>
          Confirm payment for milestone{" "}
          {milestone.sort_order + 1}:{" "}
          {milestone.title}
        </h2>

        <p className={classes.description}>
          The buyer approved this milestone.
          Confirm the milestone payment once it has
          cleared so the creator can continue with the
          next milestone.
        </p>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <div className={classes.actions}>
          <button
            className={classes.button}
            disabled={isPending}
            type="button"
            onClick={() =>
              onConfirmPayment(
                milestone.payment_schedule_item_id
              )
            }
          >
            Confirm milestone payment
          </button>
        </div>
      </section>
    );
  };

export default ListingRequestMilestonePaymentAdminActions;