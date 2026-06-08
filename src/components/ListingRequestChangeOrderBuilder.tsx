import {
  useState,
  type SubmitEventHandler,
} from "react";

import {
  hasListingRequestChangeOrderImpact,
  type ListingRequestChangeOrderImpact,
} from "../domain/listings/listingRequestChangeOrders";
import type { ListingRequestAgreementRow } from "../hooks/creatorRequests/useListingRequestAgreement";
import type { CreateListingRequestChangeOrderInput } from "../hooks/creatorRequests/useCreateListingRequestChangeOrder";

type ChangeOrderAgreement = Pick<
  ListingRequestAgreementRow,
  | "id"
  | "status"
  | "currency"
  | "total_amount"
  | "adjusted_estimated_completion_at"
>;

type ListingRequestChangeOrderBuilderProps = {
  requestStatus: string;
  agreement: ChangeOrderAgreement | null;
  isPending?: boolean;
  error?: unknown;
  onCreateChangeOrder: (
    input: CreateListingRequestChangeOrderInput
  ) => Promise<unknown> | unknown;
};

type BuilderFormState = {
  title: string;
  summary: string;
  changesScope: boolean;
  changesPrice: boolean;
  changesTimeline: boolean;
  changesDeliverables: boolean;
  changesPaymentSchedule: boolean;
  changesMilestones: boolean;
  revisedTotalAmount: string;
  revisedCompletionDate: string;
  sendNow: boolean;
};

type BuilderValidationErrors = {
  title?: string;
  summary?: string;
  impact?: string;
  revisedTotalAmount?: string;
  revisedCompletionDate?: string;
};

const classes = {
  card: "card p-6",
  section: "space-y-5",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  help: "text-xs text-zinc-500",
  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)]",
  textarea:
    "min-h-32 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-[rgb(var(--brand))] focus:ring-2 focus:ring-[rgba(244,92,44,0.18)]",
  grid: "grid gap-4 sm:grid-cols-2",
  fieldset:
    "space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  legend: "px-1 text-sm font-bold text-zinc-900",
  checkboxGrid: "grid gap-3 sm:grid-cols-2",
  checkboxRow: "flex items-start gap-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-800",
  currentValue:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  sendRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  errorText: "text-xs font-semibold text-red-600",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const defaultFormState: BuilderFormState = {
  title: "",
  summary: "",
  changesScope: false,
  changesPrice: false,
  changesTimeline: false,
  changesDeliverables: false,
  changesPaymentSchedule: false,
  changesMilestones: false,
  revisedTotalAmount: "",
  revisedCompletionDate: "",
  sendNow: true,
};

const formatMoney = (
  amount: number,
  currency: string
): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));

const getDateInputIso = (value: string): string =>
  new Date(`${value}T12:00:00.000Z`).toISOString();

const getDateOnly = (value: string): string =>
  value.slice(0, 10);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project change order could not be created.";

const getImpact = (
  form: BuilderFormState
): ListingRequestChangeOrderImpact => ({
  changesScope: form.changesScope,
  changesPrice: form.changesPrice,
  changesTimeline: form.changesTimeline,
  changesDeliverables: form.changesDeliverables,
  changesPaymentSchedule:
    form.changesPaymentSchedule,
  changesMilestones: form.changesMilestones,
});

const validateForm = (
  form: BuilderFormState,
  agreement: ChangeOrderAgreement
): BuilderValidationErrors => {
  const errors: BuilderValidationErrors = {};
  const impact = getImpact(form);

  if (
    form.title.trim().length < 3 ||
    form.title.trim().length > 160
  ) {
    errors.title =
      "Change order title must be between 3 and 160 characters.";
  }

  if (
    form.summary.trim().length < 10 ||
    form.summary.trim().length > 4000
  ) {
    errors.summary =
      "Change order summary must be between 10 and 4000 characters.";
  }

  if (!hasListingRequestChangeOrderImpact(impact)) {
    errors.impact =
      "Select at least one project term being changed.";
  }

  if (form.changesPrice) {
    const revisedTotalAmount = Number.parseFloat(
      form.revisedTotalAmount
    );

    if (
      !Number.isFinite(revisedTotalAmount) ||
      revisedTotalAmount < 0
    ) {
      errors.revisedTotalAmount =
        "Enter a revised total amount of 0 or more.";
    } else if (
      revisedTotalAmount === agreement.total_amount
    ) {
      errors.revisedTotalAmount =
        "The revised total must differ from the current total.";
    }
  }

  if (form.changesTimeline) {
    if (!form.revisedCompletionDate) {
      errors.revisedCompletionDate =
        "Choose a revised completion date.";
    } else if (
      form.revisedCompletionDate ===
      getDateOnly(
        agreement.adjusted_estimated_completion_at
      )
    ) {
      errors.revisedCompletionDate =
        "The revised completion date must differ from the current date.";
    }
  }

  return errors;
};

const ListingRequestChangeOrderBuilder = ({
  requestStatus,
  agreement,
  isPending = false,
  error,
  onCreateChangeOrder,
}: ListingRequestChangeOrderBuilderProps) => {
  const [form, setForm] =
    useState<BuilderFormState>(defaultFormState);

  const [validationErrors, setValidationErrors] =
    useState<BuilderValidationErrors>({});

  if (
    requestStatus !== "accepted" ||
    !agreement ||
    agreement.status !== "buyer_accepted"
  ) {
    return null;
  }

  const updateField = <
    Key extends keyof BuilderFormState,
  >(
    key: Key,
    value: BuilderFormState[Key]
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));

    setValidationErrors((currentErrors) => ({
      ...currentErrors,
      [key]: undefined,
      impact:
        key.startsWith("changes")
          ? undefined
          : currentErrors.impact,
    }));
  };

  const handleSubmit: SubmitEventHandler<
    HTMLFormElement
  > = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form, agreement);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const revisedTotalAmount = form.changesPrice
      ? Number.parseFloat(form.revisedTotalAmount)
      : null;

    const revisedCompletionAt =
      form.changesTimeline
        ? getDateInputIso(form.revisedCompletionDate)
        : null;

    const impact = getImpact(form);

    const input: CreateListingRequestChangeOrderInput =
    {
      agreementId: agreement.id,
      status: form.sendNow ? "sent" : "draft",
      title: form.title.trim(),
      summary: form.summary.trim(),
      changesScope: form.changesScope,
      changesPrice: form.changesPrice,
      changesTimeline: form.changesTimeline,
      changesDeliverables:
        form.changesDeliverables,
      changesPaymentSchedule:
        form.changesPaymentSchedule,
      changesMilestones: form.changesMilestones,
      revisedTotalAmount,
      revisedCompletionAt,
      proposedSnapshot: {
        summary: form.summary.trim(),
        impacts: impact,
        revised_total_amount:
          revisedTotalAmount,
        revised_completion_at:
          revisedCompletionAt,
      },
    };

    try {
      await onCreateChangeOrder(input);
    } catch {
      // Mutation error is surfaced through the error prop.
    }
  };

  const createErrorMessage = error
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
            Create project change order
          </h2>

          <p className={classes.text}>
            Formally document changes to the accepted
            project agreement. The changes do not become
            enforceable until the buyer accepts them.
          </p>
        </div>

        {createErrorMessage && (
          <div className={classes.errorBox}>
            {createErrorMessage}
          </div>
        )}

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="change-order-title"
          >
            Change order title
          </label>

          <input
            className={classes.input}
            id="change-order-title"
            maxLength={160}
            value={form.title}
            onChange={(event) =>
              updateField(
                "title",
                event.currentTarget.value
              )
            }
          />

          {validationErrors.title && (
            <p className={classes.errorText}>
              {validationErrors.title}
            </p>
          )}
        </div>

        <div className={classes.field}>
          <label
            className={classes.label}
            htmlFor="change-order-summary"
          >
            Proposed change details
          </label>

          <textarea
            className={classes.textarea}
            id="change-order-summary"
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
            Clearly describe what changes, why it is
            changing, and what the buyer will receive.
          </p>

          {validationErrors.summary && (
            <p className={classes.errorText}>
              {validationErrors.summary}
            </p>
          )}
        </div>

        <fieldset className={classes.fieldset}>
          <legend className={classes.legend}>
            Terms being changed
          </legend>

          <div className={classes.checkboxGrid}>
            <label className={classes.checkboxRow}>
              <input
                checked={form.changesScope}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesScope",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Scope
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesPrice}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesPrice",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Price
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesTimeline}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesTimeline",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Timeline
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesDeliverables}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesDeliverables",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Deliverables
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={
                  form.changesPaymentSchedule
                }
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesPaymentSchedule",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Payment schedule
              </span>
            </label>

            <label className={classes.checkboxRow}>
              <input
                checked={form.changesMilestones}
                className={classes.checkbox}
                type="checkbox"
                onChange={(event) =>
                  updateField(
                    "changesMilestones",
                    event.currentTarget.checked
                  )
                }
              />

              <span className={classes.checkboxLabel}>
                Milestones
              </span>
            </label>
          </div>

          {validationErrors.impact && (
            <p className={classes.errorText}>
              {validationErrors.impact}
            </p>
          )}
        </fieldset>

        {form.changesPrice && (
          <div className={classes.grid}>
            <div className={classes.field}>
              <div className={classes.label}>
                Current project total
              </div>

              <div className={classes.currentValue}>
                {formatMoney(
                  agreement.total_amount,
                  agreement.currency
                )}
              </div>
            </div>

            <div className={classes.field}>
              <label
                className={classes.label}
                htmlFor="change-order-total"
              >
                Revised project total
              </label>

              <input
                className={classes.input}
                id="change-order-total"
                min="0"
                step="0.01"
                type="number"
                value={form.revisedTotalAmount}
                onChange={(event) =>
                  updateField(
                    "revisedTotalAmount",
                    event.currentTarget.value
                  )
                }
              />

              {validationErrors.revisedTotalAmount && (
                <p className={classes.errorText}>
                  {
                    validationErrors.revisedTotalAmount
                  }
                </p>
              )}
            </div>
          </div>
        )}

        {form.changesTimeline && (
          <div className={classes.grid}>
            <div className={classes.field}>
              <div className={classes.label}>
                Current completion date
              </div>

              <div className={classes.currentValue}>
                {formatDate(
                  agreement.adjusted_estimated_completion_at
                )}
              </div>
            </div>

            <div className={classes.field}>
              <label
                className={classes.label}
                htmlFor="change-order-completion"
              >
                Revised completion date
              </label>

              <input
                className={classes.input}
                id="change-order-completion"
                type="date"
                value={form.revisedCompletionDate}
                onChange={(event) =>
                  updateField(
                    "revisedCompletionDate",
                    event.currentTarget.value
                  )
                }
              />

              {validationErrors.revisedCompletionDate && (
                <p className={classes.errorText}>
                  {
                    validationErrors.revisedCompletionDate
                  }
                </p>
              )}
            </div>
          </div>
        )}

        <label className={classes.sendRow}>
          <input
            checked={form.sendNow}
            className={classes.checkbox}
            type="checkbox"
            onChange={(event) =>
              updateField(
                "sendNow",
                event.currentTarget.checked
              )
            }
          />

          <span className={classes.checkboxLabel}>
            Send to the buyer now. Uncheck to save as a
            private draft.
          </span>
        </label>

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="submit"
          >
            {isPending
              ? "Saving change order…"
              : form.sendNow
                ? "Create and send change order"
                : "Save change order draft"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ListingRequestChangeOrderBuilder;