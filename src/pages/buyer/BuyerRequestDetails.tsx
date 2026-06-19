import { Link, useParams } from "react-router-dom";
import { useBuyerRequest } from "../../hooks/creatorRequests/useBuyerRequest";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import { useState } from 'react';

import ListingRequestAgreementBuyerActions from '../../components/listingRequests/agreements/ListingRequestAgreementBuyerActions';
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderBuyerActions from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuyerActions';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestStatusCard from '../../components/listingRequests/core/ListingRequestStatusCard';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliveryBuyerActions from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import { useArchiveBuyerListingRequest } from '../../hooks/creatorRequests/useArchiveBuyerListingRequest';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useRespondListingRequestAgreement } from '../../hooks/creatorRequests/useRespondListingRequestAgreement';
import { useRespondListingRequestChangeOrder } from '../../hooks/creatorRequests/useRespondListingRequestChangeOrder';
import { useRespondListingRequestFinalDelivery } from '../../hooks/creatorRequests/useRespondListingRequestFinalDelivery';
import { useRespondListingRequestMilestone } from '../../hooks/creatorRequests/useRespondListingRequestMilestone';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneBuyerActions from '../../components/listingRequests/milestones/ListingRequestMilestoneBuyerActions';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';
import { canApproveListingRequestFinalDelivery, getHasAllMilestonePaymentsPaid, getListingRequestFinalDeliveryApprovalBlockedReason } from '../../domain/listings/listingRequestFinalDeliveries';
import { getActiveListingRequestMilestone } from '../../domain/listings/listingRequestMilestones';

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  grid: "grid gap-6 lg:grid-cols-[0.9fr_1.1fr]",
  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  list: "space-y-2",
  listItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorBox:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  warningBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
} as const;

// Prefers handle for creator display, then display name, then user id
const creatorText = (
  creator: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  creator?.handle ? `@${creator.handle}` : creator?.display_name ?? fallbackUserId;

// Formats request timestamps for buyer request details
const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const priceText = (
  priceType: "fixed" | "starting_at" | "range",
  priceMin: number,
  priceMax: number | null
) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `From $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

const BuyerRequestDetails = () => {

  const [isArchiveConfirming, setIsArchiveConfirming] = useState(false);

  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useBuyerRequest(id ?? null);
  const archiveRequestMutation = useArchiveBuyerListingRequest();

  const request = data?.request ?? null;
  const creator = data?.creator ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);
  const respondAgreementMutation = useRespondListingRequestAgreement();
  const respondChangeOrderMutation =
    useRespondListingRequestChangeOrder();
  const respondFinalDeliveryMutation =
    useRespondListingRequestFinalDelivery();
  const respondMilestoneMutation =
    useRespondListingRequestMilestone();

  const agreement = agreementQuery.data ?? null;

  // Buyers should not see creator drafts.
  // RLS should block these too, but this keeps the UI safe if stale mocked data exists.
  const buyerVisibleAgreement =
    agreement?.status === "draft" ? null : agreement;

  const milestoneRequestId =
    buyerVisibleAgreement?.status === "buyer_accepted" &&
      buyerVisibleAgreement.payment_structure ===
      "milestone_payments"
      ? request?.id ?? null
      : null;

  const milestonesQuery =
    useListingRequestMilestones(milestoneRequestId);

  const milestoneSubmissionsQuery =
    useListingRequestMilestoneSubmissions(
      milestoneRequestId
    );

  const progressUpdatesQuery = useListingRequestProgressUpdates(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrdersQuery = useListingRequestChangeOrders(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrders = changeOrdersQuery.data ?? [];

  const activeSentChangeOrder =
    changeOrders.find(
      (changeOrder) => changeOrder.status === "sent"
    ) ?? null;

  const finalDeliveriesQuery =
    useListingRequestFinalDeliveries(
      buyerVisibleAgreement?.status ===
        "buyer_accepted"
        ? request?.id ?? null
        : null
    );

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

  const activeSubmittedFinalDelivery =
    finalDeliveries.find(
      (finalDelivery) =>
        finalDelivery.status === "submitted"
    ) ?? null;

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const activeMilestone =
    getActiveListingRequestMilestone(milestones);

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;

  const finalDeliveryApprovalBlockedReason =
    getListingRequestFinalDeliveryApprovalBlockedReason(
      buyerVisibleAgreement
    );

  const canApproveFinalDelivery =
    canApproveListingRequestFinalDelivery(
      buyerVisibleAgreement
    );

  const handleArchiveRequest = async () => {
    if (!request) {
      return;
    }

    await archiveRequestMutation.mutateAsync({
      requestId: request.id,
    });

    setIsArchiveConfirming(false);
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/requests" className={classes.backLink}>
          ← Back to my requests
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request not found</h1>
          <p className={classes.sub}>
            This request could not be loaded from your account.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;

  const backTo =
    request.status === "archived"
      ? "/requests/archived"
      : request.status === "completed"
        ? "/requests/completed"
        : "/requests";

  const handleAcceptAgreement = async (acknowledgementKeys: string[]) => {
    if (!buyerVisibleAgreement || buyerVisibleAgreement.status !== "sent") {
      return;
    }

    await respondAgreementMutation.mutateAsync({
      agreementId: buyerVisibleAgreement.id,
      response: "buyer_accepted",
      acknowledgementKeys,
    });
  };

  const handleDeclineAgreement = async () => {
    if (!buyerVisibleAgreement || buyerVisibleAgreement.status !== "sent") {
      return;
    }

    await respondAgreementMutation.mutateAsync({
      agreementId: buyerVisibleAgreement.id,
      response: "buyer_declined",
    });
  };

  const requestReadOnly =
    request.status === "archived" ||
    request.status === "declined" ||
    request.status === "completed";

  const requestReadOnlyMessage =
    request.status === "archived"
      ? "Archived requests are read-only."
      : request.status === "declined"
        ? "Declined requests are read-only because the conversation has been ended."
        : request.status === "completed"
          ? "Completed projects are read-only because the buyer approved the final delivery."
          : undefined;

  return (
    <div className={classes.page}>
      <Link to={backTo} className={classes.backLink}>
        ← Back to my requests
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>My request</h1>

        <p className={classes.sub}>
          Review your request and the frozen listing snapshot captured when you
          submitted it.
        </p>
      </div>

      <div className={classes.grid}>
        <div className={classes.card}>
          <div className={classes.section}>
            <ListingRequestSubmissionDetails
              heading="Request summary"
              requestTitle={request.request_title}
              requestDetails={request.request_details}
              fallbackMessage={request.message}
              requestedTimeline={request.requested_timeline}
              budgetAmount={request.budget_amount}
              referenceLinks={request.reference_links}
            />
          </div>

          {request.status === "submitted" && (
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Request actions</h2>
              <p className={classes.text}>
                Archive this request if you no longer want the creator to review it. You
                can submit a new request for this listing after archiving.
              </p>

              {archiveRequestMutation.error && (
                <div className={classes.errorBox}>
                  {archiveRequestMutation.error instanceof Error
                    ? archiveRequestMutation.error.message
                    : "This request could not be archived."}
                </div>
              )}

              {isArchiveConfirming ? (
                <div className={classes.warningBox}>
                  <p>
                    Are you sure you want to archive this request? The creator will no
                    longer see it as an active request.
                  </p>

                  <div className={classes.row}>
                    <button
                      className={classes.btnDanger}
                      type="button"
                      disabled={archiveRequestMutation.isPending}
                      onClick={() => void handleArchiveRequest()}
                    >
                      {archiveRequestMutation.isPending
                        ? "Archiving request…"
                        : "Confirm archive"}
                    </button>

                    <button
                      className={classes.btnOutline}
                      type="button"
                      disabled={archiveRequestMutation.isPending}
                      onClick={() => setIsArchiveConfirming(false)}
                    >
                      Keep request
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={classes.btnOutline}
                  type="button"
                  disabled={archiveRequestMutation.isPending}
                  onClick={() => setIsArchiveConfirming(true)}
                >
                  Archive request
                </button>
              )}
            </div>
          )}

          <ListingRequestStatusCard
            status={request.status}
            reason={request.creator_status_reason}
            archiveContext={request}
          />

          <ListingRequestAgreementSummary
            agreement={buyerVisibleAgreement}
            isLoading={agreementQuery.isLoading}
          />

          <ListingRequestAgreementBuyerActions
            agreement={buyerVisibleAgreement}
            isPending={respondAgreementMutation.isPending}
            error={respondAgreementMutation.error}
            onAccept={handleAcceptAgreement}
            onDecline={handleDeclineAgreement}
          />

          <ListingRequestAgreementWorkReadinessCard
            requestStatus={request.status}
            agreement={buyerVisibleAgreement}
          />

          <div className={classes.metaGrid}>
            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Creator</div>
              <div className={classes.metaValue}>
                {creatorText(creator, request.creator_user_id)}
              </div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Status</div>
              <div className={classes.metaValue}>
                {getListingRequestStatusLabel(request.status, request)}
              </div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Submitted</div>
              <div className={classes.metaValue}>
                {dateText(request.created_at)}
              </div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Last updated</div>
              <div className={classes.metaValue}>
                {dateText(request.updated_at)}
              </div>
            </div>

            {request.status === "completed" &&
              request.completed_at && (
                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>
                    Completed
                  </div>

                  <div className={classes.metaValue}>
                    {dateText(request.completed_at)}
                  </div>
                </div>
              )}
          </div>
        </div>

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Frozen listing snapshot</h2>
            <p className={classes.text}>
              This captures the listing state you submitted your request against.
            </p>
          </div>

          <div className={classes.metaGrid}>
            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Title</div>
              <div className={classes.metaValue}>{snapshot.title}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Price</div>
              <div className={classes.metaValue}>
                {priceText(
                  snapshot.price_type,
                  snapshot.price_min,
                  snapshot.price_max
                )}
              </div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Purchase flow</div>
              <div className={classes.metaValue}>{snapshot.fulfilment_mode}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Offering type</div>
              <div className={classes.metaValue}>{snapshot.offering_type}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Category</div>
              <div className={classes.metaValue}>{snapshot.category}</div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Listing last updated</div>
              <div className={classes.metaValue}>
                {dateText(snapshot.updated_at)}
              </div>
            </div>
          </div>

          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Deliverables</h2>

            {snapshot.deliverables.length > 0 ? (
              <div className={classes.list}>
                {snapshot.deliverables.map((deliverable) => (
                  <div key={deliverable} className={classes.listItem}>
                    {deliverable}
                  </div>
                ))}
              </div>
            ) : (
              <p className={classes.text}>No deliverables were listed.</p>
            )}
          </div>

          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Tags</h2>

            {snapshot.tags.length > 0 ? (
              <div className={classes.list}>
                {snapshot.tags.map((tag) => (
                  <div key={tag} className={classes.listItem}>
                    {tag}
                  </div>
                ))}
              </div>
            ) : (
              <p className={classes.text}>No tags were listed.</p>
            )}
          </div>
        </div>
      </div>

      {buyerVisibleAgreement?.status ===
        "buyer_accepted" && (
          <>
            {buyerVisibleAgreement.payment_structure ===
              "milestone_payments" && (
                <>
                  <ListingRequestMilestoneSummary
                    milestones={milestones}
                    submissions={milestoneSubmissions}
                    viewer="buyer"
                    isLoading={milestonesAreLoading}
                    error={milestoneError}
                  />

                  {!requestReadOnly &&
                    request.status === "accepted" && (
                      <ListingRequestMilestoneBuyerActions
                        milestone={activeMilestone}
                        isPending={
                          respondMilestoneMutation.isPending
                        }
                        error={
                          respondMilestoneMutation.error
                        }
                        onRespondMilestone={(input) =>
                          respondMilestoneMutation.mutateAsync(
                            input
                          )
                        }
                      />
                    )}
                </>
              )}

            <ListingRequestChangeOrderSummary
              changeOrders={changeOrders}
              viewer="buyer"
              isLoading={changeOrdersQuery.isLoading}
              error={changeOrdersQuery.error}
            />

            <ListingRequestChangeOrderBuyerActions
              changeOrder={activeSentChangeOrder}
              isPending={
                respondChangeOrderMutation.isPending
              }
              error={respondChangeOrderMutation.error}
              onAccept={(changeOrderId) =>
                respondChangeOrderMutation.mutateAsync({
                  changeOrderId,
                  response: "buyer_accepted",
                })
              }
              onDecline={(
                changeOrderId,
                responseReason
              ) =>
                respondChangeOrderMutation.mutateAsync({
                  changeOrderId,
                  response: "buyer_declined",
                  responseReason,
                })
              }
            />

            <ListingRequestFinalDeliverySummary
              finalDeliveries={finalDeliveries}
              viewer="buyer"
              isLoading={finalDeliveriesQuery.isLoading}
              error={finalDeliveriesQuery.error}
            />

            <ListingRequestFinalDeliveryBuyerActions
              finalDelivery={activeSubmittedFinalDelivery}
              canApprove={canApproveFinalDelivery}
              approvalBlockedReason={
                finalDeliveryApprovalBlockedReason
              }
              isPending={
                respondFinalDeliveryMutation.isPending
              }
              error={respondFinalDeliveryMutation.error}
              onApprove={(finalDeliveryId) =>
                respondFinalDeliveryMutation.mutateAsync({
                  finalDeliveryId,
                  response: "buyer_approved",
                })
              }
              onRequestRevision={(
                finalDeliveryId,
                revisionRequestReason
              ) =>
                respondFinalDeliveryMutation.mutateAsync({
                  finalDeliveryId,
                  response: "revision_requested",
                  revisionRequestReason,
                })
              }
            />

            <ListingRequestProgressUpdateScheduleCard
              agreement={buyerVisibleAgreement}
              updates={progressUpdatesQuery.data ?? []}
            />

            <ListingRequestProgressUpdateTimeline
              updates={progressUpdatesQuery.data ?? []}
              isLoading={progressUpdatesQuery.isLoading}
              error={progressUpdatesQuery.error}
            />
          </>
        )}

      <RequestConversationThread
        requestId={request.id}
        buyerUserId={request.buyer_user_id}
        creatorUserId={request.creator_user_id}
        buyerLabel="You"
        creatorLabel={creatorText(
          creator,
          request.creator_user_id
        )}
        viewer="buyer"
        requestReadOnly={requestReadOnly}
        requestReadOnlyMessage={requestReadOnlyMessage}
      />

      <div className={classes.row}>
        <Link className={classes.btnOutline} to={backTo}>
          Back to my requests
        </Link>
      </div>
    </div>
  );
};

export default BuyerRequestDetails;