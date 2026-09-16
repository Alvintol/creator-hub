import { useMemo, useState } from "react";

import {
  areRequiredAgreementAcknowledgementsChecked,
  getRequiredListingRequestAgreementAcknowledgements,
} from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestAgreementBuyerActionsProps = {
  agreement: ListingRequestAgreementRow | null;
  isPending: boolean;
  error: unknown;
  onAccept: (acknowledgementKeys: string[]) => Promise<void> | void;
  onDecline: () => Promise<void> | void;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  checklist: "space-y-3",
  checkboxRow:
    "flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkbox: "mt-1 h-4 w-4 rounded border-zinc-300",
  checkboxLabel: "text-sm font-semibold text-zinc-800",
  row: "flex flex-wrap items-center gap-3",
  errorBox:
    "notice noticeError",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project agreement response could not be saved.";

const ListingRequestAgreementBuyerActions = ({
  agreement,
  isPending,
  error,
  onAccept,
  onDecline,
}: ListingRequestAgreementBuyerActionsProps) => {
  const [checkedAcknowledgementKeys, setCheckedAcknowledgementKeys] = useState<
    string[]
  >([]);

  const requiredAcknowledgements = useMemo(
    () =>
      agreement
        ? getRequiredListingRequestAgreementAcknowledgements(agreement)
        : [],
    [agreement]
  );

  if (!agreement || agreement.status !== "sent") {
    return null;
  }

  const hasCheckedAllRequiredAcknowledgements =
    areRequiredAgreementAcknowledgementsChecked({
      requiredAcknowledgements,
      checkedKeys: checkedAcknowledgementKeys,
    });

  const handleToggleAcknowledgement = (key: string) => {
    setCheckedAcknowledgementKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key]
    );
  };

  const handleAccept = async () => {
    if (!hasCheckedAllRequiredAcknowledgements) {
      return;
    }

    await onAccept(checkedAcknowledgementKeys);
  };

  const handleDecline = async () => {
    await onDecline();
  };

  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Review and confirm agreement</h2>
          <p className={classes.text}>
            Check each item to confirm you have read and understood the project
            scope, payment schedule, timeline, update expectations, and change
            order rules before accepting.
          </p>
        </div>

        {errorMessage && <div className={classes.errorBox}>{errorMessage}</div>}

        <div className={classes.checklist}>
          {requiredAcknowledgements.map((acknowledgement) => {
            const inputId = `agreement-acknowledgement-${acknowledgement.key}`;

            return (
              <label
                key={acknowledgement.key}
                className={classes.checkboxRow}
                htmlFor={inputId}
              >
                <input
                  id={inputId}
                  className={classes.checkbox}
                  type="checkbox"
                  checked={checkedAcknowledgementKeys.includes(
                    acknowledgement.key
                  )}
                  disabled={isPending}
                  onChange={() =>
                    handleToggleAcknowledgement(acknowledgement.key)
                  }
                />

                <span className={classes.checkboxLabel}>
                  {acknowledgement.label}
                </span>
              </label>
            );
          })}
        </div>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={isPending || !hasCheckedAllRequiredAcknowledgements}
            onClick={() => void handleAccept()}
          >
            {isPending ? "Saving response…" : "Accept project agreement"}
          </button>

          <button
            className={classes.btnOutline}
            type="button"
            disabled={isPending}
            onClick={() => void handleDecline()}
          >
            Decline agreement
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementBuyerActions;