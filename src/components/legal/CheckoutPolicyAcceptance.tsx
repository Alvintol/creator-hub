import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  checkoutPolicyTypes,
  earlyServiceRequestExplanation,
  earlyServiceRequestHeading,
  earlyServiceRequestLabel,
  getLatestAcceptedAt,
  getMissingPolicyTypes,
  toCurrentPolicyAcceptances,
} from "../../domain/legal/policyAcceptance";
import {
  logPolicyAcceptanceFailure,
  usePolicyAcceptances,
  useRecordPolicyAcceptances,
} from "../../hooks/legal/usePolicyAcceptances";
import PolicyAcceptanceCheckbox from "./PolicyAcceptanceCheckbox";

type CheckoutPolicyAcceptanceProps = {
  listingRequestId: string;
  onAccepted: () => void;
};

const classes = {
  card: "card space-y-4 p-6",
  group: "space-y-2",
  heading: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm leading-6 text-zinc-600",
  link: "font-semibold underline underline-offset-2",
  row: "flex flex-wrap items-center gap-3",
  button: "btnPrimary",
  error: "notice noticeError",
} as const;

const formatAcceptedDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// Acceptance a buyer gives before paying for a project. Recorded once per
// listing request at the current policy versions; later payments on the same
// request go straight through unless a policy has changed.
//
// The early-start request is deliberately its own checkbox with its own
// wording, never folded into the general agreement (Refund Policy section 1).
// It is first recorded when the buyer accepts the agreement (20260923_138),
// so here it only reappears if the Refund Policy has changed since.
const CheckoutPolicyAcceptance = (props: CheckoutPolicyAcceptanceProps) => {
  const { listingRequestId, onAccepted } = props;

  const acceptancesQuery = usePolicyAcceptances({
    policyTypes: checkoutPolicyTypes,
    relatedListingRequestId: listingRequestId,
  });
  const recordAcceptances = useRecordPolicyAcceptances();

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [earlyStartRequested, setEarlyStartRequested] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const acceptances = acceptancesQuery.data ?? [];
  const missingPolicyTypes = acceptancesQuery.data
    ? getMissingPolicyTypes(checkoutPolicyTypes, acceptances)
    : checkoutPolicyTypes;
  const hasAccepted = Boolean(acceptancesQuery.data) && missingPolicyTypes.length === 0;
  const acceptedAt = hasAccepted ? getLatestAcceptedAt(acceptances) : null;

  useEffect(() => {
    if (hasAccepted) onAccepted();
  }, [hasAccepted, onAccepted]);

  if (hasAccepted) {
    return (
      <section className={classes.card}>
        <p className={classes.text}>
          You accepted the project terms, the{" "}
          <Link className={classes.link} to="/policies/fees" target="_blank" rel="noopener">
            Fee Schedule
          </Link>{" "}
          and the{" "}
          <Link className={classes.link} to="/policies/refunds" target="_blank" rel="noopener">
            Refund, Cancellation and Dispute Policy
          </Link>{" "}
          for this project
          {acceptedAt ? ` on ${formatAcceptedDate(acceptedAt)}` : ""}.
        </p>
      </section>
    );
  }

  const isBusy = acceptancesQuery.isLoading || recordAcceptances.isPending;
  const needsEarlyStartRequest = missingPolicyTypes.includes("early_service_request");

  const onContinue = async () => {
    setErrMsg(null);

    try {
      await recordAcceptances.mutateAsync({
        policies: toCurrentPolicyAcceptances(missingPolicyTypes),
        relatedListingRequestId: listingRequestId,
      });
      onAccepted();
    } catch (error) {
      logPolicyAcceptanceFailure("checkout acceptance", error);
      setErrMsg(
        "We couldn’t record your acceptance, so checkout hasn’t started. Please try again.",
      );
    }
  };

  return (
    <section className={classes.card} aria-label="Terms for this payment">
      <div className={classes.group}>
        <h2 className={classes.heading}>Project terms</h2>
        <p className={classes.text}>
          Review the{" "}
          <Link className={classes.link} to={`/requests/${listingRequestId}`}>
            project agreement
          </Link>{" "}
          for the scope, payment schedule and usage rights before you pay.
        </p>

        <PolicyAcceptanceCheckbox
          id="checkout-terms-acceptance"
          checked={termsAgreed}
          onChange={setTermsAgreed}
          disabled={isBusy}
        >
          I agree to the project scope, payment schedule, usage rights,{" "}
          <Link className={classes.link} to="/policies/fees" target="_blank" rel="noopener">
            Fee Schedule
          </Link>{" "}
          and{" "}
          <Link className={classes.link} to="/policies/refunds" target="_blank" rel="noopener">
            Refund, Cancellation and Dispute Policy
          </Link>{" "}
          shown here.
        </PolicyAcceptanceCheckbox>
      </div>

      {needsEarlyStartRequest && (
      <div className={classes.group}>
        <h2 className={classes.heading}>{earlyServiceRequestHeading}</h2>
        <p className={classes.text}>{earlyServiceRequestExplanation}</p>

        <PolicyAcceptanceCheckbox
          id="checkout-early-service-request"
          checked={earlyStartRequested}
          onChange={setEarlyStartRequested}
          disabled={isBusy}
        >
          {earlyServiceRequestLabel}
        </PolicyAcceptanceCheckbox>
      </div>
      )}

      <div className={classes.row}>
        <button
          className={classes.button}
          type="button"
          disabled={
            !termsAgreed ||
            (needsEarlyStartRequest && !earlyStartRequested) ||
            isBusy
          }
          onClick={() => void onContinue()}
        >
          {recordAcceptances.isPending ? "Saving…" : "Continue to payment"}
        </button>
      </div>

      {errMsg && <div className={classes.error}>{errMsg}</div>}
    </section>
  );
};

export default CheckoutPolicyAcceptance;
