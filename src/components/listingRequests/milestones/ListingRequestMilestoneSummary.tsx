import {
  getListingRequestMilestoneStatusLabel,
  getListingRequestMilestoneStatusSummary,
  getListingRequestMilestoneStatusTone,
} from "../../../domain/listings/listingRequestMilestones";
import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import type { ListingRequestMilestoneSubmissionRow } from "../../../hooks/creatorRequests/useListingRequestMilestoneSubmissions";

type ListingRequestMilestoneViewer =
  | "buyer"
  | "creator"
  | "admin";

type ListingRequestMilestoneSummaryProps = {
  milestones: ListingRequestMilestoneRow[];
  submissions: ListingRequestMilestoneSubmissionRow[];
  viewer: ListingRequestMilestoneViewer;
  isLoading?: boolean;
  error?: unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  loading:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  empty:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600",
  error:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700",
  list: "space-y-4",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemHeading: "space-y-1",
  itemTitle: "text-sm font-extrabold text-zinc-900",
  itemVersion: "text-xs text-zinc-500",
  status:
    "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
  statusMuted:
    "border-zinc-200 bg-zinc-100 text-zinc-700",
  statusReview:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusSuccess:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusDanger:
    "border-red-200 bg-red-50 text-red-700",
  statusSummary: "mt-2 text-sm text-zinc-600",
  body: "mt-4 whitespace-pre-wrap text-sm text-zinc-700",
  metaGrid: "mt-4 grid gap-4 sm:grid-cols-3",
  metaBlock: "space-y-1",
  metaLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm font-semibold text-zinc-900",
  links: "mt-4 space-y-2",
  link:
    "block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100",
  noSubmission:
    "mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600",
  revision:
    "mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Milestones could not be loaded.";

const formatDate = (
  value?: string | null
): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
    }).format(new Date(value))
    : "Not submitted";

const formatMoney = (
  amount: number,
  currency: string
): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);

const getStatusClass = (
  milestone: ListingRequestMilestoneRow
): string => {
  const tone =
    getListingRequestMilestoneStatusTone(
      milestone.status
    );

  return tone === "review"
    ? `${classes.status} ${classes.statusReview}`
    : tone === "success"
      ? `${classes.status} ${classes.statusSuccess}`
      : tone === "danger"
        ? `${classes.status} ${classes.statusDanger}`
        : `${classes.status} ${classes.statusMuted}`;
};

const getLatestSubmissionByMilestoneId = (
  submissions: ListingRequestMilestoneSubmissionRow[]
): Map<
  string,
  ListingRequestMilestoneSubmissionRow
> => {
  const latestByMilestoneId = new Map<
    string,
    ListingRequestMilestoneSubmissionRow
  >();

  submissions.forEach((submission) => {
    const current = latestByMilestoneId.get(
      submission.milestone_id
    );

    if (
      !current ||
      submission.version_number >
      current.version_number
    ) {
      latestByMilestoneId.set(
        submission.milestone_id,
        submission
      );
    }
  });

  return latestByMilestoneId;
};

type ListingRequestMilestoneSummaryViewer =
  | "creator"
  | "buyer"
  | "admin";

const getEmptyMilestoneMessage = (
  viewer: ListingRequestMilestoneSummaryViewer
): string => {
  if (viewer === "creator") {
    return "No milestones are available yet. They will appear here once the buyer accepts a milestone-based agreement.";
  }

  if (viewer === "buyer") {
    return "No milestones are available yet. They will appear here once the agreement is ready for milestone work.";
  }

  return "No milestones are available for this request yet.";
};

const getCompletedMilestoneMessage = (
  viewer: ListingRequestMilestoneSummaryViewer
): string => {
  if (viewer === "creator") {
    return "All milestones have been paid. You can now prepare the final delivery when the project is ready.";
  }

  if (viewer === "buyer") {
    return "All milestones have been paid. The creator can now prepare the final delivery.";
  }

  return "All milestones have been paid for this request.";
};

const getMilestonesAreComplete = (
  milestones: Array<{ status: string }>
): boolean =>
  milestones.length > 0 &&
  milestones.every(
    (milestone) =>
      milestone.status === "paid" ||
      milestone.status === "cancelled"
  );

const ListingRequestMilestoneSummary = ({
  milestones,
  submissions,
  viewer,
  isLoading = false,
  error,
}: ListingRequestMilestoneSummaryProps) => {
  const hasError = Boolean(error);

  const sortedMilestones = [...milestones].sort(
    (firstMilestone, secondMilestone) =>
      firstMilestone.sort_order -
      secondMilestone.sort_order
  );

  const latestSubmissions =
    getLatestSubmissionByMilestoneId(submissions);

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Project milestones
          </h2>

          <p className={classes.text}>
            Milestone checkpoints, buyer review status,
            and payment readiness for this agreement.
          </p>
        </div>

        {isLoading && (
          <div className={classes.loading}>
            Loading milestones…
          </div>
        )}

        {!isLoading && hasError && (
          <div className={classes.error}>
            {getErrorMessage(error)}
          </div>
        )}

        {!isLoading &&
          !hasError &&
          sortedMilestones.length === 0 && (
            <div className={classes.empty}>
              No project milestones have been created
              for this agreement.
            </div>
          )}

        {!isLoading &&
          !hasError &&
          sortedMilestones.length > 0 && (
            <div className={classes.list}>
              {sortedMilestones.map((milestone) => {
                const latestSubmission =
                  latestSubmissions.get(
                    milestone.id
                  );

                return (
                  <article
                    className={classes.item}
                    key={milestone.id}
                  >
                    <div
                      className={classes.itemHeader}
                    >
                      <div
                        className={
                          classes.itemHeading
                        }
                      >
                        <h3
                          className={
                            classes.itemTitle
                          }
                        >
                          {milestone.title}
                        </h3>

                        <div
                          className={
                            classes.itemVersion
                          }
                        >
                          Milestone{" "}
                          {milestone.sort_order + 1}
                        </div>
                      </div>

                      <span
                        className={getStatusClass(
                          milestone
                        )}
                      >
                        {getListingRequestMilestoneStatusLabel(
                          milestone.status
                        )}
                      </span>
                    </div>

                    <p
                      className={
                        classes.statusSummary
                      }
                    >
                      {getListingRequestMilestoneStatusSummary(
                        milestone.status
                      )}
                    </p>

                    {milestone.description && (
                      <p className={classes.body}>
                        {milestone.description}
                      </p>
                    )}

                    <div className={classes.metaGrid}>
                      <div
                        className={classes.metaBlock}
                      >
                        <div
                          className={
                            classes.metaLabel
                          }
                        >
                          Amount
                        </div>

                        <div
                          className={
                            classes.metaValue
                          }
                        >
                          {formatMoney(
                            milestone.amount,
                            milestone.currency
                          )}
                        </div>
                      </div>

                      <div
                        className={classes.metaBlock}
                      >
                        <div
                          className={
                            classes.metaLabel
                          }
                        >
                          Submitted
                        </div>

                        <div
                          className={
                            classes.metaValue
                          }
                        >
                          {formatDate(
                            milestone.latest_submitted_at
                          )}
                        </div>
                      </div>

                      <div
                        className={classes.metaBlock}
                      >
                        <div
                          className={
                            classes.metaLabel
                          }
                        >
                          Viewer
                        </div>

                        <div
                          className={
                            classes.metaValue
                          }
                        >
                          {viewer}
                        </div>
                      </div>
                    </div>

                    {latestSubmission ? (
                      <>
                        <p className={classes.body}>
                          {latestSubmission.summary}
                        </p>

                        {latestSubmission.delivery_links.length >
                          0 && (
                            <div className={classes.links}>
                              {latestSubmission.delivery_links.map(
                                (
                                  deliveryLink,
                                  index
                                ) => (
                                  <a
                                    className={
                                      classes.link
                                    }
                                    href={deliveryLink}
                                    key={`${latestSubmission.id}-${index}`}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    Milestone delivery link{" "}
                                    {index + 1}
                                  </a>
                                )
                              )}
                            </div>
                          )}

                        {latestSubmission.revision_request_reason && (
                          <div
                            className={
                              classes.revision
                            }
                          >
                            <strong>
                              Revision requested:
                            </strong>{" "}
                            {
                              latestSubmission.revision_request_reason
                            }
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className={classes.noSubmission}
                      >
                        No submission has been made for
                        this milestone yet.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestMilestoneSummary;