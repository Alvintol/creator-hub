import { Link, useParams } from "react-router-dom";
import { useCreatorRequest } from "../../hooks/creatorRequests/useCreatorRequest";
import { useUpdateCreatorListingRequestStatus } from "../../hooks/creatorRequests/useUpdateCreatorListingRequestStatus";
import {
  canAcceptListingRequest,
  canArchiveListingRequest,
  canDeclineListingRequest,
  getListingRequestStatusLabel,
} from "../../domain/listings/listingRequests";
import { useEffect, useState } from 'react';
import ListingRequestAgreementBuilder from '../../components/listingRequests/agreements/ListingRequestAgreementBuilder';
import ListingRequestAgreementCreatorActions from '../../components/listingRequests/agreements/ListingRequestAgreementCreatorActions';
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderBuilder from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuilder';
import ListingRequestChangeOrderCreatorActions from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderCreatorActions';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestStatusCard from '../../components/listingRequests/core/ListingRequestStatusCard';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliveryBuilder from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder';
import ListingRequestFinalDeliveryCreatorActions from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryCreatorActions';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestProgressUpdateForm from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateForm';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import {
  canCreateNextListingRequestFinalDelivery,
  getHasAllMilestonePaymentsPaid,
} from '../../domain/listings/listingRequestFinalDeliveries';
import { useCreateListingRequestAgreement } from '../../hooks/creatorRequests/useCreateListingRequestAgreement';
import { useCreateListingRequestChangeOrder } from '../../hooks/creatorRequests/useCreateListingRequestChangeOrder';
import { useCreateListingRequestFinalDelivery } from '../../hooks/creatorRequests/useCreateListingRequestFinalDelivery';
import { useCreateListingRequestProgressUpdate } from '../../hooks/creatorRequests/useCreateListingRequestProgressUpdate';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useSendDraftListingRequestAgreement } from '../../hooks/creatorRequests/useSendDraftListingRequestAgreement';
import { useSendDraftListingRequestChangeOrder } from '../../hooks/creatorRequests/useSendDraftListingRequestChangeOrder';
import { useSendDraftListingRequestFinalDelivery } from '../../hooks/creatorRequests/useSendDraftListingRequestFinalDelivery';
import { useSubmitListingRequestMilestone } from '../../hooks/creatorRequests/useSubmitListingRequestMilestone';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneSubmissionForm from '../../components/listingRequests/milestones/ListingRequestMilestoneSubmissionForm';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';
import { canSubmitListingRequestMilestone, getActiveListingRequestMilestone } from '../../domain/listings/listingRequestMilestones';
import { canCreateListingRequestChangeOrder, getDraftListingRequestChangeOrder, getHasPendingListingRequestChangeOrder } from '../../domain/listings/listingRequestChangeOrders';

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

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  submitError:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  hint: "text-xs text-zinc-500",
  error: "text-xs font-semibold text-red-600",
  textarea:
    "min-h-[140px] w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  infoCard:
    "rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900",
} as const;

// Prefers handle for buyer display, then display name, then user id
const buyerText = (
  buyer: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  buyer?.handle ? `@${buyer.handle}` : buyer?.display_name ?? fallbackUserId;

// Formats timestamps for the creator request detail page
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

const getCreatorMilestoneWaitMessage = (
  milestone: {
    status: string;
    sort_order: number;
    title: string;
  } | null
): string | null => {
  if (!milestone) {
    return null;
  }

  const milestoneLabel = `Milestone ${milestone.sort_order + 1
    }: ${milestone.title}`;

  if (milestone.status === "submitted") {
    return `${milestoneLabel} is waiting for buyer review. The next milestone will unlock after the buyer approves this one and payment is confirmed.`;
  }

  if (
    milestone.status === "buyer_approved" ||
    milestone.status === "payment_required"
  ) {
    return `${milestoneLabel} has been approved by the buyer and is waiting for admin payment confirmation. The next milestone will unlock after payment is confirmed.`;
  }

  return null;
};

const CreatorRequestDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useCreatorRequest(id ?? null);
  const updateStatusMutation = useUpdateCreatorListingRequestStatus();

  const request = data?.request ?? null;
  const buyer = data?.buyer ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);
  const createAgreementMutation = useCreateListingRequestAgreement();
  const sendDraftAgreementMutation = useSendDraftListingRequestAgreement();
  const createProgressUpdateMutation =
    useCreateListingRequestProgressUpdate();
  const sendDraftChangeOrderMutation =
    useSendDraftListingRequestChangeOrder();
  const createChangeOrderMutation =
    useCreateListingRequestChangeOrder();
  const createFinalDeliveryMutation =
    useCreateListingRequestFinalDelivery();
  const sendDraftFinalDeliveryMutation =
    useSendDraftListingRequestFinalDelivery();
  const submitMilestoneMutation =
    useSubmitListingRequestMilestone();


  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineReasonError, setDeclineReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!request?.creator_status_reason) return;
    setDeclineReason(request.creator_status_reason);
  }, [request?.creator_status_reason]);

  const trimmedDeclineReason = declineReason.trim();

  const canConfirmDecline =
    trimmedDeclineReason.length >= 10 &&
    trimmedDeclineReason.length <= 1000 &&
    !updateStatusMutation.isPending;

  const agreement = agreementQuery.data ?? null;

  const progressUpdatesQuery = useListingRequestProgressUpdates(
    agreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrdersQuery = useListingRequestChangeOrders(
    agreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const finalDeliveriesQuery =
    useListingRequestFinalDeliveries(
      agreement?.status === "buyer_accepted"
        ? request?.id ?? null
        : null
    );

  const milestoneRequestId =
    agreement?.status === "buyer_accepted" &&
      agreement.payment_structure === "milestone_payments"
      ? request?.id ?? null
      : null;

  const milestonesQuery =
    useListingRequestMilestones(milestoneRequestId);

  const milestoneSubmissionsQuery =
    useListingRequestMilestoneSubmissions(
      milestoneRequestId
    );


  const handleAcceptRequest = async () => {
    if (!request) return;

    setShowDeclineForm(false);
    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "accepted",
        reason: null,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleDeclineRequest = async () => {
    if (!request) return;

    if (trimmedDeclineReason.length < 10 || trimmedDeclineReason.length > 1000) {
      setDeclineReasonError(
        "Decline reason must be between 10 and 1000 characters."
      );
      return;
    }

    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "declined",
        reason: trimmedDeclineReason,
      });

      setShowDeclineForm(false);
    } catch {
      // Error is surfaced below
    }
  };

  const handleArchiveRequest = async () => {
    if (!request) return;

    setShowDeclineForm(false);
    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "archived",
        reason: null,
      });
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/creator/requests" className={classes.backLink}>
          ← Back to creator requests
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request not found</h1>
          <p className={classes.sub}>
            This request could not be loaded from your creator account.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;


  const backTo =
    request.status === "archived"
      ? "/creator/requests/archived"
      : request.status === "completed"
        ? "/creator/requests/completed"
        : "/creator/requests";

  const changeOrders = changeOrdersQuery.data ?? [];

  const canCreateChangeOrder =
    canCreateListingRequestChangeOrder(
      request.status,
      agreement,
      changeOrders
    ) &&
    !changeOrdersQuery.isLoading &&
    !changeOrdersQuery.error;

  const draftChangeOrder =
    getDraftListingRequestChangeOrder(changeOrders);

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

  const draftFinalDelivery =
    finalDeliveries.find(
      (finalDelivery) =>
        finalDelivery.status === "draft"
    ) ?? null;

  const startingPaymentResolved =
    agreement?.starting_payment_status === "paid" ||
    agreement?.starting_payment_status ===
    "not_required";

  const canCreateFinalDelivery =
    request.status === "accepted" &&
    agreement?.status === "buyer_accepted" &&
    startingPaymentResolved &&
    canCreateNextListingRequestFinalDelivery(
      agreement,
      finalDeliveries
    ) &&
    !finalDeliveriesQuery.isLoading &&
    !finalDeliveriesQuery.error;

  const requestReadOnly =
    request.status === "archived" ||
    request.status === "declined" ||
    request.status === "completed";

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const activeMilestone =
    getActiveListingRequestMilestone(milestones);

  const canSubmitActiveMilestone =
    activeMilestone
      ? canSubmitListingRequestMilestone(
        activeMilestone.status
      )
      : false;

  const activeMilestoneWaitMessage =
    getCreatorMilestoneWaitMessage(activeMilestone);

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;

  const requestReadOnlyMessage =
    request.status === "archived"
      ? "Archived requests are read-only."
      : request.status === "declined"
        ? "Declined requests are read-only because the conversation has been ended."
        : request.status === "completed"
          ? "Completed projects are read-only because the buyer approved the final delivery."
          : undefined;

  const finalDeliveryBlockedByMilestones =
    request.status === "accepted" &&
    agreement?.status === "buyer_accepted" &&
    agreement.payment_structure === "milestone_payments" &&
    startingPaymentResolved &&
    !getHasAllMilestonePaymentsPaid(agreement) &&
    !finalDeliveriesQuery.isLoading &&
    !finalDeliveriesQuery.error;


  return (
    <div className={classes.page}>
      <Link to={backTo} className={classes.backLink}>
        ← Back to creator requests
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Listing request</h1>

        <p className={classes.sub}>
          Review the buyer message and the frozen listing snapshot recorded at
          submission time.
        </p>
      </div>

      {error && (
        <div className={classes.errorCard}>
          This request could not be loaded right now.
        </div>
      )}

      <div className={classes.grid}>
        <div className={classes.card}>
          <ListingRequestSubmissionDetails
            heading="Buyer request"
            requestTitle={request.request_title}
            requestDetails={request.request_details}
            fallbackMessage={request.message}
            requestedTimeline={request.requested_timeline}
            budgetAmount={request.budget_amount}
            referenceLinks={request.reference_links}
          />

          <ListingRequestStatusCard
            status={request.status}
            reason={request.creator_status_reason}
            archiveContext={request}
          />

          <ListingRequestAgreementSummary
            agreement={agreementQuery.data ?? null}
            isLoading={agreementQuery.isLoading}
          />

          <ListingRequestAgreementCreatorActions
            agreement={agreement}
            isPending={sendDraftAgreementMutation.isPending}
            error={sendDraftAgreementMutation.error}
            onSendAgreement={(agreementId) =>
              sendDraftAgreementMutation.mutateAsync({ agreementId })
            }
          />

          <ListingRequestAgreementWorkReadinessCard
            requestStatus={request.status}
            agreement={agreement}
          />

          <div className={classes.metaGrid}>
            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Buyer</div>
              <div className={classes.metaValue}>
                {buyerText(buyer, request.buyer_user_id)}
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
          </div>
        </div>

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Request actions</h2>

            <p className={classes.text}>
              Update the request status so the buyer can clearly track your response.
            </p>
          </div>

          {updateStatusMutation.error && (
            <div className={classes.submitError}>
              The request status could not be updated right now.
            </div>
          )}

          <div className={classes.row}>
            {canAcceptListingRequest(request.status) && (
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={() => void handleAcceptRequest()}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Updating…" : "Accept request"}
              </button>
            )}

            {canDeclineListingRequest(request.status) && (
              <button
                className={classes.btnDanger}
                type="button"
                onClick={() => {
                  setShowDeclineForm((current) => !current);
                  setDeclineReasonError(null);
                }}
                disabled={updateStatusMutation.isPending}
              >
                {showDeclineForm ? "Cancel decline" : "Decline request"}
              </button>
            )}

            {canArchiveListingRequest(request.status) && (
              <button
                className={classes.btnOutline}
                type="button"
                onClick={() => void handleArchiveRequest()}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Updating…" : "Archive request"}
              </button>
            )}
          </div>

          {showDeclineForm && canDeclineListingRequest(request.status) && (
            <div className={classes.field}>
              <label className={classes.label} htmlFor="declineReason">
                Decline reason
              </label>

              <textarea
                id="declineReason"
                className={classes.textarea}
                value={declineReason}
                onChange={(event) => {
                  setDeclineReason(event.target.value);
                  setDeclineReasonError(null);
                }}
                placeholder="Explain why this request is being declined for audit and client clarity."
                maxLength={1000}
              />

              <div className={classes.hint}>
                {trimmedDeclineReason.length}/1000 characters. Minimum 10 characters required.
              </div>

              {declineReasonError && (
                <div className={classes.error}>{declineReasonError}</div>
              )}

              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  onClick={() => void handleDeclineRequest()}
                  disabled={!canConfirmDecline}
                >
                  {updateStatusMutation.isPending
                    ? "Declining request…"
                    : "Confirm decline request"}
                </button>
              </div>
            </div>
          )}
        </div>

        {agreementQuery.error && (
          <div className={classes.errorCard}>
            Project agreement could not be loaded right now.
          </div>
        )}

        {request.status === "accepted" &&
          !agreement &&
          !agreementQuery.isLoading &&
          !agreementQuery.error && (
            <ListingRequestAgreementBuilder
              request={request}
              isPending={createAgreementMutation.isPending}
              error={createAgreementMutation.error}
              onCreateAgreement={(input) => createAgreementMutation.mutateAsync(input)}
            />
          )}

        <div className={classes.card}>
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Frozen listing snapshot</h2>
            <p className={classes.text}>
              This captures the listing state the buyer reached out about.
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

      {agreement?.status === "buyer_accepted" && (
        <>
          <ListingRequestChangeOrderSummary
            changeOrders={changeOrders}
            viewer="creator"
            isLoading={changeOrdersQuery.isLoading}
            error={changeOrdersQuery.error}
          />

          <ListingRequestChangeOrderCreatorActions
            changeOrder={draftChangeOrder}
            isPending={
              sendDraftChangeOrderMutation.isPending
            }
            error={sendDraftChangeOrderMutation.error}
            onSendChangeOrder={(changeOrderId) =>
              sendDraftChangeOrderMutation.mutateAsync({
                changeOrderId,
              })
            }
          />

          {canCreateChangeOrder && (
            <ListingRequestChangeOrderBuilder
              requestStatus={request.status}
              agreement={agreement}
              isPending={
                createChangeOrderMutation.isPending
              }
              error={createChangeOrderMutation.error}
              onCreateChangeOrder={(input) =>
                createChangeOrderMutation.mutateAsync(
                  input
                )
              }
            />
          )}
        </>
      )}

      {agreement?.status === "buyer_accepted" &&
        agreement.payment_structure === "milestone_payments" && (
          <>
            <ListingRequestMilestoneSummary
              milestones={milestones}
              submissions={milestoneSubmissions}
              viewer="creator"
              isLoading={milestonesAreLoading}
              error={milestoneError}
            />

            {!requestReadOnly &&
              request.status === "accepted" &&
              startingPaymentResolved &&
              canSubmitActiveMilestone && (
                <ListingRequestMilestoneSubmissionForm
                  milestone={activeMilestone}
                  isPending={
                    submitMilestoneMutation.isPending
                  }
                  error={submitMilestoneMutation.error}
                  onSubmitMilestone={(input) =>
                    submitMilestoneMutation.mutateAsync(
                      input
                    )
                  }
                />
              )}

            {activeMilestoneWaitMessage && (
              <div className={classes.infoCard}>
                {activeMilestoneWaitMessage}
              </div>
            )}
          </>
        )}

      {agreement?.status === "buyer_accepted" && (
        <>
          <ListingRequestFinalDeliverySummary
            finalDeliveries={finalDeliveries}
            viewer="creator"
            isLoading={finalDeliveriesQuery.isLoading}
            error={finalDeliveriesQuery.error}
          />


          <ListingRequestFinalDeliveryCreatorActions
            finalDelivery={draftFinalDelivery}
            isPending={
              sendDraftFinalDeliveryMutation.isPending
            }
            error={sendDraftFinalDeliveryMutation.error}
            onSubmitFinalDelivery={(finalDeliveryId) =>
              sendDraftFinalDeliveryMutation.mutateAsync({
                finalDeliveryId,
              })
            }
          />

          {finalDeliveryBlockedByMilestones && (
            <div className={classes.infoCard}>
              Final delivery is locked until every milestone payment has been confirmed.
              Submit each milestone for buyer review, wait for buyer approval, and then
              wait for admin payment confirmation before creating the final delivery.
            </div>
          )}

          {canCreateFinalDelivery && (
            <ListingRequestFinalDeliveryBuilder
              requestStatus={request.status}
              agreement={agreement}
              isPending={
                createFinalDeliveryMutation.isPending
              }
              error={createFinalDeliveryMutation.error}
              onCreateFinalDelivery={(input) =>
                createFinalDeliveryMutation.mutateAsync(
                  input
                )
              }
            />
          )}
        </>
      )}

      <ListingRequestProgressUpdateScheduleCard
        agreement={agreement}
        updates={progressUpdatesQuery.data ?? []}
      />

      <ListingRequestProgressUpdateForm
        requestStatus={request.status}
        agreement={agreement}
        isPending={createProgressUpdateMutation.isPending}
        error={createProgressUpdateMutation.error}
        onCreateProgressUpdate={(input) =>
          createProgressUpdateMutation.mutateAsync(input)
        }
      />

      {agreement?.status === "buyer_accepted" && (
        <ListingRequestProgressUpdateTimeline
          updates={progressUpdatesQuery.data ?? []}
          isLoading={progressUpdatesQuery.isLoading}
          error={progressUpdatesQuery.error}
        />
      )}

      <RequestConversationThread
        requestId={request.id}
        buyerUserId={request.buyer_user_id}
        creatorUserId={request.creator_user_id}
        buyerLabel={buyerText(
          buyer,
          request.buyer_user_id
        )}
        creatorLabel="You"
        viewer="creator"
        requestReadOnly={requestReadOnly}
        requestReadOnlyMessage={requestReadOnlyMessage}
      />

      <div className={classes.row}>
        <Link className={classes.btnOutline} to="/creator/requests">
          Back to creator requests
        </Link>
      </div>
    </div>
  );
};

export default CreatorRequestDetails;