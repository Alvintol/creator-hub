import { FadeIn } from "../../lib/motion";
import { Link, useParams } from "react-router-dom";
import { useBuyerRequest } from "../../hooks/creatorRequests/useBuyerRequest";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";
import { getRequestNextStep, getRequestStages } from "../../domain/listings/requestWorkspace";
import { useState } from 'react';

import ListingRequestAgreementBuyerActions from '../../components/listingRequests/agreements/ListingRequestAgreementBuyerActions';
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderBuyerActions from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuyerActions';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliveryBuyerActions from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import ListingSnapshotDetails from "../../components/listingRequests/workspace/ListingSnapshotDetails";
import ActionMenu from "../../components/ui/ActionMenu";
import RequestNextStepCard from "../../components/listingRequests/workspace/RequestNextStepCard";
import RequestStatusNotice from "../../components/listingRequests/workspace/RequestStatusNotice";
import RequestWorkspace from "../../components/listingRequests/workspace/RequestWorkspace";
import StatusHeader from "../../components/ui/StatusHeader";
import WorkspaceSectionList from "../../components/listingRequests/workspace/WorkspaceSectionList";
import {
  getSectionFlags,
  summarizeAgreement,
  summarizeChangeOrders,
  summarizeDeliveries,
  summarizeMilestones,
  summarizeProgress,
  summarizeSchedule,
  workspaceDate,
  type WorkspaceSectionSpec,
} from "../../components/listingRequests/workspace/sectionSummaries";
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
import { canApproveSubmittedListingRequestFinalDelivery, getListingRequestFinalDeliveryApprovalBlockedReason, getSubmittedListingRequestFinalDelivery } from '../../domain/listings/listingRequestFinalDeliveries';
import { getActiveListingRequestMilestone } from '../../domain/listings/listingRequestMilestones';
import { getSentListingRequestChangeOrder } from '../../domain/listings/listingRequestChangeOrders';
import { useListingRequestPayments } from '../../hooks/payments/useListingRequestPayments';
import ListingRequestPaymentsCard from '../../components/listingRequests/payments/ListingRequestPaymentsCard';

const classes = {
  page: "space-y-6",
  backLink: "backLink",
  h1: "pageTitle",
  sub: "pageSub",
  card: "card p-6",
  text: "text-sm text-zinc-600",
  row: "flex flex-wrap items-center gap-3",
  btnOutline: "btnOutline btnSm",
  loadingText: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  warningBox: "notice noticeWarning space-y-3",
  btnDanger: "btnDangerOutline btnSm",
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

  const paymentsQuery = useListingRequestPayments(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null,
  );

  const changeOrdersQuery = useListingRequestChangeOrders(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrders = changeOrdersQuery.data ?? [];

  const activeSentChangeOrder =
    getSentListingRequestChangeOrder(changeOrders);

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
    getSubmittedListingRequestFinalDelivery(
      finalDeliveries
    );

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
    activeSubmittedFinalDelivery
      ? canApproveSubmittedListingRequestFinalDelivery(
        activeSubmittedFinalDelivery.status,
        buyerVisibleAgreement
      )
      : false;

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

  const creatorLabel = creatorText(creator, request.creator_user_id);

  const workspaceInput = {
    requestStatus: request.status,
    agreement: buyerVisibleAgreement,
    milestones,
    changeOrders,
    finalDeliveries,
  };

  const nextStep = getRequestNextStep(workspaceInput);
  const workspaceLoading =
    agreementQuery.isLoading ||
    milestonesAreLoading ||
    changeOrdersQuery.isLoading ||
    finalDeliveriesQuery.isLoading;
  const flags = getSectionFlags(nextStep, "buyer", {
    readOnly: requestReadOnly,
    isLoading: workspaceLoading,
  });

  const agreementAccepted = buyerVisibleAgreement?.status === "buyer_accepted";
  const usesMilestones =
    agreementAccepted && buyerVisibleAgreement?.payment_structure === "milestone_payments";
  const progressUpdates = progressUpdatesQuery.data ?? [];

  const sections: WorkspaceSectionSpec[] = [
    {
      id: "request",
      title: "Your request",
      summary: "Brief, timeline, budget and references",
      ...flags("request"),
      defaultOpen: request.status === "submitted",
      content: (
        <ListingRequestSubmissionDetails
          requestTitle={request.request_title}
          requestDetails={request.request_details}
          fallbackMessage={request.message}
          requestedTimeline={request.requested_timeline}
          budgetAmount={request.budget_amount}
          referenceLinks={request.reference_links}
        />
      ),
    },
    {
      id: "agreement",
      title: "Project agreement",
      summary: summarizeAgreement(buyerVisibleAgreement, "Not created yet"),
      ...flags("agreement"),
      content: (
        <>
          <ListingRequestAgreementBuyerActions
            agreement={buyerVisibleAgreement}
            isPending={respondAgreementMutation.isPending}
            error={respondAgreementMutation.error}
            onAccept={handleAcceptAgreement}
            onDecline={handleDeclineAgreement}
          />

          <ListingRequestAgreementSummary
            agreement={buyerVisibleAgreement}
            isLoading={agreementQuery.isLoading}
          />
        </>
      ),
    },
    {
      id: "payments",
      title: "Payments",
      summary: summarizeSchedule(buyerVisibleAgreement),
      ...flags("payments"),
      visible: request.status === "accepted" || Boolean(buyerVisibleAgreement),
      content: (
        <>
          <ListingRequestAgreementWorkReadinessCard
            requestStatus={request.status}
            agreement={buyerVisibleAgreement}
          />

          {agreementAccepted && (
            <ListingRequestPaymentsCard
              payments={paymentsQuery.data ?? []}
              isLoading={paymentsQuery.isLoading}
              error={paymentsQuery.error}
              readOnly={requestReadOnly}
            />
          )}
        </>
      ),
    },
    {
      id: "milestones",
      title: "Milestones",
      summary: summarizeMilestones(milestones),
      ...flags("milestones"),
      visible: usesMilestones,
      content: (
        <>
          {!requestReadOnly && request.status === "accepted" && (
            <ListingRequestMilestoneBuyerActions
              milestone={activeMilestone}
              isPending={respondMilestoneMutation.isPending}
              error={respondMilestoneMutation.error}
              onRespondMilestone={(input) => respondMilestoneMutation.mutateAsync(input)}
            />
          )}

          <ListingRequestMilestoneSummary
            milestones={milestones}
            submissions={milestoneSubmissions}
            viewer="buyer"
            isLoading={milestonesAreLoading}
            error={milestoneError}
          />
        </>
      ),
    },
    {
      id: "delivery",
      title: "Final delivery",
      summary: summarizeDeliveries(finalDeliveries),
      ...flags("delivery"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestFinalDeliveryBuyerActions
            finalDelivery={activeSubmittedFinalDelivery}
            canApprove={canApproveFinalDelivery}
            approvalBlockedReason={finalDeliveryApprovalBlockedReason}
            isPending={respondFinalDeliveryMutation.isPending}
            error={respondFinalDeliveryMutation.error}
            onApprove={(finalDeliveryId) =>
              respondFinalDeliveryMutation.mutateAsync({
                finalDeliveryId,
                response: "buyer_approved",
              })
            }
            onRequestRevision={(finalDeliveryId, revisionRequestReason) =>
              respondFinalDeliveryMutation.mutateAsync({
                finalDeliveryId,
                response: "revision_requested",
                revisionRequestReason,
              })
            }
          />

          <ListingRequestFinalDeliverySummary
            finalDeliveries={finalDeliveries}
            viewer="buyer"
            isLoading={finalDeliveriesQuery.isLoading}
            error={finalDeliveriesQuery.error}
          />
        </>
      ),
    },
    {
      id: "changeOrders",
      title: "Change orders",
      summary: summarizeChangeOrders(changeOrders),
      ...flags("changeOrders"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestChangeOrderBuyerActions
            changeOrder={activeSentChangeOrder}
            isPending={respondChangeOrderMutation.isPending}
            error={respondChangeOrderMutation.error}
            onAccept={(changeOrderId) =>
              respondChangeOrderMutation.mutateAsync({
                changeOrderId,
                response: "buyer_accepted",
              })
            }
            onDecline={(changeOrderId, responseReason) =>
              respondChangeOrderMutation.mutateAsync({
                changeOrderId,
                response: "buyer_declined",
                responseReason,
              })
            }
          />

          <ListingRequestChangeOrderSummary
            changeOrders={changeOrders}
            viewer="buyer"
            isLoading={changeOrdersQuery.isLoading}
            error={changeOrdersQuery.error}
          />
        </>
      ),
    },
    {
      id: "progress",
      title: "Progress updates",
      summary: summarizeProgress(progressUpdates),
      ...flags("progress"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestProgressUpdateScheduleCard
            agreement={buyerVisibleAgreement}
            updates={progressUpdates}
          />

          <ListingRequestProgressUpdateTimeline
            updates={progressUpdates}
            isLoading={progressUpdatesQuery.isLoading}
            error={progressUpdatesQuery.error}
          />
        </>
      ),
    },
    {
      id: "snapshot",
      title: "Listing snapshot",
      summary: "As it was when you submitted",
      ...flags("snapshot"),
      content: <ListingSnapshotDetails snapshot={snapshot} />,
    },
  ];

  const meta = [
    <span key="creator">
      With <span className="font-semibold text-zinc-900">{creatorLabel}</span>
    </span>,
    <span key="submitted">Submitted {workspaceDate(request.created_at)}</span>,
    request.status === "completed" && request.completed_at ? (
      <span key="completed">Completed {workspaceDate(request.completed_at)}</span>
    ) : (
      <span key="updated">Updated {workspaceDate(request.updated_at)}</span>
    ),
  ];

  const manageMenu =
    request.status === "submitted" ? (
      <ActionMenu>
        <p className={classes.text}>
          Archive this request if you no longer want the creator to review it. You can
          submit a new request for this listing after archiving.
        </p>

        {archiveRequestMutation.error && (
          <div className={classes.errorBox}>
            {archiveRequestMutation.error instanceof Error
              ? archiveRequestMutation.error.message
              : "This request could not be archived."}
          </div>
        )}

        {isArchiveConfirming ? (
          <FadeIn className={classes.warningBox}>
            <p>
              Are you sure you want to archive this request? The creator will no longer
              see it as an active request.
            </p>

            <div className={classes.row}>
              <button
                className={classes.btnDanger}
                type="button"
                disabled={archiveRequestMutation.isPending}
                onClick={() => void handleArchiveRequest()}
              >
                {archiveRequestMutation.isPending ? "Archiving request…" : "Confirm archive"}
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
          </FadeIn>
        ) : (
          <button
            className={classes.btnDanger}
            type="button"
            disabled={archiveRequestMutation.isPending}
            onClick={() => setIsArchiveConfirming(true)}
          >
            Archive request
          </button>
        )}
      </ActionMenu>
    ) : undefined;

  return (
    <RequestWorkspace
      header={
        <StatusHeader
          backTo={backTo}
          backLabel="Back to my requests"
          eyebrow="My request"
          title={snapshot.title}
          meta={meta}
          statusLabel={getListingRequestStatusLabel(request.status, request)}
          statusTone={getListingRequestStatusTone(request.status)}
          stages={getRequestStages(workspaceInput)}
          actions={manageMenu}
          notice={
            (request.status === "declined" || request.status === "archived") &&
            <RequestStatusNotice
              status={request.status}
              reason={request.creator_status_reason}
              archiveContext={request}
            />
          }
        />
      }
      nextStep={
        <RequestNextStepCard
          step={nextStep}
          viewer="buyer"
          isLoading={workspaceLoading}
          buyerLabel="You"
          creatorLabel={creatorLabel}
        />
      }
      conversation={
        <RequestConversationThread
          requestId={request.id}
          buyerLabel="You"
          creatorLabel={creatorLabel}
          viewer="buyer"
          requestReadOnly={requestReadOnly}
          requestReadOnlyMessage={requestReadOnlyMessage}
        />
      }
      sections={<WorkspaceSectionList requestStatus={request.status} sections={sections} />}
    />
  );
};

export default BuyerRequestDetails;
