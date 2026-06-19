import { Link, useParams } from "react-router-dom";
import { useAdminRequest } from "../../hooks/admin/useAdminRequest";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestStatusCard from '../../components/listingRequests/core/ListingRequestStatusCard';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestAgreementAdminPaymentActions from '../../components/listingRequests/payments/ListingRequestAgreementAdminPaymentActions';
import ListingRequestChangeOrderPaymentAdminActions from '../../components/listingRequests/payments/ListingRequestChangeOrderPaymentAdminActions';
import ListingRequestFinalBalancePaymentAdminActions from '../../components/listingRequests/payments/ListingRequestFinalBalancePaymentAdminActions';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import { useAdminConfirmListingRequestChangeOrderPayment } from '../../hooks/admin/useAdminConfirmListingRequestChangeOrderPayment';
import { useAdminConfirmListingRequestFinalBalancePayment } from '../../hooks/admin/useAdminConfirmListingRequestFinalBalancePayment';
import { useAdminConfirmListingRequestStartingPayment } from '../../hooks/admin/useAdminConfirmListingRequestStartingPayment';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';

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

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

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

const AdminRequestDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useAdminRequest(id ?? null);

  const request = data?.request ?? null;
  const buyer = data?.buyer ?? null;
  const creator = data?.creator ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);

  const confirmStartingPaymentMutation =
    useAdminConfirmListingRequestStartingPayment();
  const confirmChangeOrderPaymentMutation =
    useAdminConfirmListingRequestChangeOrderPayment();
  const confirmFinalBalancePaymentMutation =
    useAdminConfirmListingRequestFinalBalancePayment();

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

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

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

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;


  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/admin/requests" className={classes.backLink}>
          ← Back to admin requests
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Request not found</h1>
          <p className={classes.sub}>
            This request could not be loaded for admin review.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;

  return (
    <div className={classes.page}>
      <Link to="/admin/requests" className={classes.backLink}>
        ← Back to admin requests
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Admin request review</h1>

        <p className={classes.sub}>
          Read-only request review for dispute support.
        </p>
      </div>

      <div className={classes.grid}>
        <div className={classes.card}>
          <ListingRequestSubmissionDetails
            heading="Request summary"
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
            agreement={agreement}
            isLoading={agreementQuery.isLoading}
          />

          <ListingRequestAgreementAdminPaymentActions
            agreement={agreement}
            isPending={confirmStartingPaymentMutation.isPending}
            error={confirmStartingPaymentMutation.error}
            onConfirmPayment={(agreementId) =>
              confirmStartingPaymentMutation.mutateAsync({ agreementId })
            }
          />

          <ListingRequestChangeOrderPaymentAdminActions
            agreement={agreement}
            isPending={confirmChangeOrderPaymentMutation.isPending}
            error={confirmChangeOrderPaymentMutation.error}
            onConfirmPayment={(paymentScheduleItemId) =>
              confirmChangeOrderPaymentMutation.mutateAsync({
                paymentScheduleItemId,
              })
            }
          />

          <ListingRequestFinalBalancePaymentAdminActions
            agreement={agreement}
            isPending={
              confirmFinalBalancePaymentMutation.isPending
            }
            error={confirmFinalBalancePaymentMutation.error}
            onConfirmPayment={(paymentScheduleItemId) =>
              confirmFinalBalancePaymentMutation.mutateAsync({
                paymentScheduleItemId,
              })
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
                {profileText(buyer, request.buyer_user_id)}
              </div>
            </div>

            <div className={classes.metaBlock}>
              <div className={classes.metaLabel}>Creator</div>
              <div className={classes.metaValue}>
                {profileText(creator, request.creator_user_id)}
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
            <h2 className={classes.sectionTitle}>Frozen listing snapshot</h2>
            <p className={classes.text}>
              This is the listing state captured when the buyer submitted the request.
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

      {agreement?.status === "buyer_accepted" && (
        <>
          {agreement.payment_structure === "milestone_payments" && (
            <ListingRequestMilestoneSummary
              milestones={milestones}
              submissions={milestoneSubmissions}
              viewer="admin"
              isLoading={milestonesAreLoading}
              error={milestoneError}
            />
          )}

          <ListingRequestChangeOrderSummary
            changeOrders={changeOrdersQuery.data ?? []}
            viewer="admin"
            isLoading={changeOrdersQuery.isLoading}
            error={changeOrdersQuery.error}
          />

          <ListingRequestFinalDeliverySummary
            finalDeliveries={finalDeliveries}
            viewer="admin"
            isLoading={finalDeliveriesQuery.isLoading}
            error={finalDeliveriesQuery.error}
          />

          <ListingRequestProgressUpdateScheduleCard
            agreement={agreement}
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
        buyerLabel={profileText(buyer, request.buyer_user_id)}
        creatorLabel={profileText(creator, request.creator_user_id)}
        viewer="admin"
        requestReadOnly={
          request.status === "archived" || request.status === "declined"
        }
        requestReadOnlyMessage={
          request.status === "archived"
            ? "Archived requests are read-only."
            : "Declined requests are read-only because the conversation has been ended."
        }
      />

      <div className={classes.row}>
        <Link className={classes.btnPrimary} to={`/admin/listing-revisions/${request.listing_id}`}>
          View listing revisions
        </Link>

        <Link className={classes.btnOutline} to="/admin/requests">
          Back to admin requests
        </Link>
      </div>
    </div>
  );
};

export default AdminRequestDetails;