import {
  getListingRequestAgreementStatusLabel,
  getListingRequestAgreementStatusSummary,
  getListingRequestPaymentStructureLabel,
  getListingRequestPaymentStructureSummary,
  getListingRequestPaymentTimingLabel,
  getListingRequestPaymentTimingSummary,
  getListingRequestBuyerHoldReasonLabel,
} from "../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestAgreementSummaryProps = {
  agreement: ListingRequestAgreementRow | null;
  isLoading?: boolean;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  h3: "text-sm font-extrabold text-zinc-900",
  text: "text-sm text-zinc-600",
  muted: "text-xs text-zinc-500",
  grid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",
  badge:
    "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  list: "space-y-2",
  item:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",
  itemTitle: "font-bold text-zinc-900",
  itemText: "mt-1 text-sm text-zinc-600",
  payment:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700",
  warning:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
} as const;

const formatMoney = (amount: number | null, currency: string): string => {
  if (amount === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
};

const formatDate = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
    }).format(new Date(value))
    : "Not set";

const sortedBySortOrder = <T extends { sort_order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sort_order - b.sort_order);

const sortedAcknowledgements = (
  acknowledgements: ListingRequestAgreementRow["listing_request_agreement_acknowledgements"]
) =>
  [...acknowledgements].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

const ListingRequestAgreementSummary = ({
  agreement,
  isLoading = false,
}: ListingRequestAgreementSummaryProps) => {
  if (isLoading) {
    return (
      <div className={classes.card}>
        <p className={classes.text}>Loading project agreement…</p>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className={classes.card}>
        <div className={classes.header}>
          <h2 className={classes.title}>Project agreement</h2>
          <p className={classes.text}>
            No project agreement has been created for this request yet.
          </p>
        </div>
      </div>
    );
  }

  const completedHoldDays = agreement.listing_request_timeline_holds
    .filter((hold) => hold.ended_at)
    .reduce((total, hold) => total + hold.rounded_extension_days, 0);

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Project agreement</h2>
          <p className={classes.text}>
            Version {agreement.version_number} ·{" "}
            {getListingRequestAgreementStatusSummary(agreement.status)}
          </p>
        </div>

        <span className={classes.badge}>
          {getListingRequestAgreementStatusLabel(agreement.status)}
        </span>
      </div>

      <div className={classes.grid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Payment structure</div>
          <div className={classes.metaValue}>
            {getListingRequestPaymentStructureLabel(
              agreement.payment_structure
            )}
          </div>
          <p className={classes.muted}>
            {getListingRequestPaymentStructureSummary(
              agreement.payment_structure
            )}
          </p>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Total</div>
          <div className={classes.metaValue}>
            {formatMoney(agreement.total_amount, agreement.currency)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Deposit</div>
          <div className={classes.metaValue}>
            {formatMoney(agreement.deposit_amount, agreement.currency)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Included revisions</div>
          <div className={classes.metaValue}>
            {agreement.included_revision_count}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Estimated completion</div>
          <div className={classes.metaValue}>
            {formatDate(agreement.estimated_completion_at)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Adjusted completion</div>
          <div className={classes.metaValue}>
            {formatDate(agreement.adjusted_estimated_completion_at)}
          </div>
          {completedHoldDays > 0 && (
            <p className={classes.muted}>
              Includes +{completedHoldDays} day
              {completedHoldDays === 1 ? "" : "s"} from buyer-side holds.
            </p>
          )}
        </div>
      </div>

      <div className={classes.section}>
        <h3 className={classes.h3}>Scope summary</h3>
        <p className={classes.text}>{agreement.scope_summary}</p>
      </div>

      <div className={classes.section}>
        <h3 className={classes.h3}>Included deliverables</h3>

        {agreement.included_deliverables.length > 0 ? (
          <div className={classes.list}>
            {agreement.included_deliverables.map((deliverable) => (
              <div key={deliverable} className={classes.item}>
                {deliverable}
              </div>
            ))}
          </div>
        ) : (
          <p className={classes.text}>No deliverables listed.</p>
        )}
      </div>

      <div className={classes.section}>
        <h3 className={classes.h3}>Scope checklist</h3>

        {agreement.listing_request_agreement_items.length > 0 ? (
          <div className={classes.list}>
            {sortedBySortOrder(agreement.listing_request_agreement_items).map(
              (item) => (
                <div key={item.id} className={classes.item}>
                  <div className={classes.itemTitle}>{item.title}</div>

                  {item.description && (
                    <p className={classes.itemText}>{item.description}</p>
                  )}

                  <p className={classes.itemText}>
                    {getListingRequestPaymentTimingLabel(item.payment_timing)}
                    {item.price_amount !== null
                      ? ` · ${formatMoney(item.price_amount, agreement.currency)}`
                      : ""}
                    {item.timeline_impact_days
                      ? ` · +${item.timeline_impact_days} day${item.timeline_impact_days === 1 ? "" : "s"
                      }`
                      : ""}
                  </p>
                </div>
              )
            )}
          </div>
        ) : (
          <p className={classes.text}>No checklist items listed.</p>
        )}
      </div>

      <div className={classes.section}>
        <h3 className={classes.h3}>Payment schedule</h3>

        {agreement.listing_request_payment_schedule_items.length > 0 ? (
          <div className={classes.list}>
            {sortedBySortOrder(
              agreement.listing_request_payment_schedule_items
            ).map((paymentItem) => (
              <div key={paymentItem.id} className={classes.payment}>
                <div className={classes.itemTitle}>{paymentItem.title}</div>

                {paymentItem.description && (
                  <p className={classes.itemText}>{paymentItem.description}</p>
                )}

                <p className={classes.itemText}>
                  {formatMoney(paymentItem.amount, paymentItem.currency)} ·{" "}
                  {getListingRequestPaymentTimingLabel(
                    paymentItem.payment_timing
                  )}
                </p>

                <p className={classes.muted}>
                  {getListingRequestPaymentTimingSummary(
                    paymentItem.payment_timing
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={classes.text}>No payment schedule items listed.</p>
        )}
      </div>

      <div className={classes.section}>
        <h3 className={classes.h3}>Policies</h3>
        <p className={classes.text}>{agreement.additional_cost_policy}</p>

        {agreement.revision_policy && (
          <p className={classes.text}>{agreement.revision_policy}</p>
        )}

        {agreement.update_schedule_summary && (
          <p className={classes.text}>{agreement.update_schedule_summary}</p>
        )}
      </div>

      {agreement.listing_request_agreement_acknowledgements.length > 0 && (
        <div className={classes.section}>
          <h3 className={classes.h3}>Buyer confirmations</h3>

          <div className={classes.list}>
            {sortedAcknowledgements(
              agreement.listing_request_agreement_acknowledgements
            ).map((acknowledgement) => (
              <div key={acknowledgement.id} className={classes.item}>
                <div className={classes.itemTitle}>
                  {acknowledgement.acknowledgement_label}
                </div>

                <p className={classes.itemText}>
                  Confirmed on {formatDate(acknowledgement.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {agreement.listing_request_timeline_holds.some((hold) => !hold.ended_at) && (
        <div className={classes.warning}>
          This project is currently waiting on buyer action. The estimated
          completion date may be adjusted after the hold is resolved.
        </div>
      )}

      {agreement.listing_request_timeline_holds.length > 0 && (
        <div className={classes.section}>
          <h3 className={classes.h3}>Timeline holds</h3>

          <div className={classes.list}>
            {agreement.listing_request_timeline_holds.map((hold) => (
              <div key={hold.id} className={classes.item}>
                <div className={classes.itemTitle}>
                  {getListingRequestBuyerHoldReasonLabel(hold.reason)}
                </div>
                <p className={classes.itemText}>
                  {hold.ended_at
                    ? `Resolved with +${hold.rounded_extension_days} day${hold.rounded_extension_days === 1 ? "" : "s"
                    } added.`
                    : "Currently active."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingRequestAgreementSummary;