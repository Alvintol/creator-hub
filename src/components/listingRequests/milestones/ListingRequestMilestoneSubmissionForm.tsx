import {
  useEffect,
  useState,
  type SubmitEventHandler,
} from "react";

import {
  canSubmitListingRequestMilestone,
} from "../../../domain/listings/listingRequestMilestones";
import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import type { SubmitListingRequestMilestoneInput } from "../../../hooks/creatorRequests/useSubmitListingRequestMilestone";

type SubmittableMilestone = Pick<
  ListingRequestMilestoneRow,
  "id" | "status" | "title" | "sort_order"
>;

type ListingRequestMilestoneSubmissionFormProps = {
  milestone: SubmittableMilestone | null;
  isPending?: boolean;
  error?: unknown;
  onSubmitMilestone: (
    input: SubmitListingRequestMilestoneInput
  ) => Promise<unknown> | unknown;
};

type MilestoneSubmissionFormState = {
  summary: string;
  deliveryLinksText: string;
};

type MilestoneSubmissionValidationErrors = {
  summary?: string;
  deliveryLinksText?: string;
};

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title:
    "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  milestone:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  milestoneLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  milestoneTitle:
    "mt-1 text-sm font-extrabold text-zinc-900",
  notice:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  revisionNotice:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  textarea:
    "min-h-32 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
  linksTextarea:
    "min-h-28 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500",
  help: "text-xs text-zinc-500",
  errorText:
    "text-xs font-semibold text-red-600",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  actions:
    "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

const defaultFormState: MilestoneSubmissionFormState = {
  summary: "",
  deliveryLinksText: "",
};

const getErrorMessage = (
  error: unknown
): string =>
  error instanceof Error
    ? error.message
    : "The milestone submission could not be saved.";

const splitDeliveryLinks = (
  value: string
): string[] =>
  value
    .split("\n")
    .map((deliveryLink) =>
      deliveryLink.trim()
    )
    .filter(Boolean);

const validateForm = (
  form: MilestoneSubmissionFormState
): MilestoneSubmissionValidationErrors => {
  const errors: MilestoneSubmissionValidationErrors =
    {};

  const cleanSummary = form.summary.trim();

  const deliveryLinks = splitDeliveryLinks(
    form.deliveryLinksText
  );

  if (
    cleanSummary.length < 10 ||
    cleanSummary.length > 4000
  ) {
    errors.summary =
      "Milestone submission summary must be between 10 and 4000 characters.";
  }

  if (deliveryLinks.length > 20) {
    errors.deliveryLinksText =
      "A milestone submission can contain no more than 20 delivery links.";
  } else if (
    deliveryLinks.some(
      (deliveryLink) =>
        deliveryLink.length > 2000
    )
  ) {
    errors.deliveryLinksText =
      "Each milestone delivery link must be 2000 characters or fewer.";
  }

  return errors;
};

const ListingRequestMilestoneSubmissionForm = ({
  milestone,
  isPending = false,
  error,
  onSubmitMilestone,
}: ListingRequestMilestoneSubmissionFormProps) => {
  const [form, setForm] =
    useState<MilestoneSubmissionFormState>(
      defaultFormState
    );

  const [
    validationErrors,
    setValidationErrors,
  ] =
    useState<MilestoneSubmissionValidationErrors>(
      {}
    );

  useEffect(() => {
    setForm(defaultFormState);
    setValidationErrors({});
  }, [milestone?.id]);

  if (
    !milestone ||
    !canSubmitListingRequestMilestone(
      milestone.status
    )
  ) {
    return null;
  }

  const isRevisionSubmission =
    milestone.status === "revision_requested";

  const updateField = <
    Key extends keyof MilestoneSubmissionFormState,
  >(
    key: Key,
    value: MilestoneSubmissionFormState[Key]
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));

    setValidationErrors(
      (currentErrors) => ({
        ...currentErrors,
        [key]: undefined,
      })
    );
  };

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form);

    setValidationErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0
    ) {
      return;
    }

    try {
      await onSubmitMilestone({
        milestoneId: milestone.id,
        summary: form.summary.trim(),
        deliveryLinks: splitDeliveryLinks(
          form.deliveryLinksText
        ),
      });

      setForm(defaultFormState);
      setValidationErrors({});
    } catch {
      // Mutation errors are rendered through the error prop.
    }
  };

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  return (
    <form
      className={classes.card}
      onSubmit={handleSubmit}
    >
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            {isRevisionSubmission
              ? "Resubmit milestone"
              : "Submit milestone"}
          </h2>

          <p className={classes.text}>
            Provide the completed milestone work and
            supporting links for buyer review.
          </p>
        </div>

        <div className={classes.milestone}>
          <div
            className={classes.milestoneLabel}
          >
            Milestone{" "}
            {milestone.sort_order + 1}
          </div>

          <div
            className={classes.milestoneTitle}
          >
            {milestone.title}
          </div>
        </div>

        {isRevisionSubmission ? (
          <div
            className={classes.revisionNotice}
          >
            The buyer requested revisions. Submit an
            updated version after completing the
            requested changes.
          </div>
        ) : (
          <div className={classes.notice}>
            Submitting starts the buyer-review period.
            Payment becomes due only after the buyer
            approves this milestone.
          </div>
        )}

        {errorMessage && (
          <div className={classes.errorBox}>
            {errorMessage}
          </div>
        )}

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="milestone-submission-summary"
          >
            Milestone submission summary
          </label>

          <textarea
            className={classes.textarea}
            disabled={isPending}
            id="milestone-submission-summary"
            maxLength={4000}
            value={form.summary}
            onChange={(event) =>
              updateField(
                "summary",
                event.currentTarget.value
              )
            }
          />

          <p className={classes.help}>
            {form.summary.trim().length}/4000
            characters. Explain what was completed
            and any details the buyer should review.
          </p>

          {validationErrors.summary && (
            <p className={classes.errorText}>
              {validationErrors.summary}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="milestone-delivery-links"
          >
            Milestone delivery links
          </label>

          <textarea
            className={classes.linksTextarea}
            disabled={isPending}
            id="milestone-delivery-links"
            value={form.deliveryLinksText}
            onChange={(event) =>
              updateField(
                "deliveryLinksText",
                event.currentTarget.value
              )
            }
            placeholder={
              "https://example.com/review-files\nhttps://example.com/source-files"
            }
          />

          <p className={classes.help}>
            Optional. Add one link per line, up to
            20 links.
          </p>

          {validationErrors.deliveryLinksText && (
            <p className={classes.errorText}>
              {
                validationErrors.deliveryLinksText
              }
            </p>
          )}
        </div>

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? "Submitting milestone…"
              : isRevisionSubmission
                ? "Resubmit milestone for review"
                : "Submit milestone for review"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestMilestoneSubmissionForm;