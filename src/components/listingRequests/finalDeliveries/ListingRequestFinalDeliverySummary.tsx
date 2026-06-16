import {
  getListingRequestFinalDeliveryStatusLabel,
  getListingRequestFinalDeliveryStatusSummary,
  getListingRequestFinalDeliveryStatusTone,
  isListingRequestFinalDeliveryBuyerVisible,
} from "../../../domain/listings/listingRequestFinalDeliveries";
import type { ListingRequestFinalDeliveryRow } from "../../../hooks/creatorRequests/useListingRequestFinalDeliveries";

type ListingRequestFinalDeliveryViewer =
  | "buyer"
  | "creator"
  | "admin";

type ListingRequestFinalDeliverySummaryProps = {
  finalDeliveries: ListingRequestFinalDeliveryRow[];
  viewer: ListingRequestFinalDeliveryViewer;
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
  metaGrid: "mt-4 grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel:
    "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm font-semibold text-zinc-900",
  links: "mt-4 space-y-2",
  link:
    "block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100",
  noLinks:
    "mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600",
  revision:
    "mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
} as const;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Final deliveries could not be loaded.";

const formatDate = (
  value?: string | null
): string =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
      }).format(new Date(value))
    : "Not submitted";

const getStatusClass = (
  finalDelivery: ListingRequestFinalDeliveryRow
): string => {
  const tone =
    getListingRequestFinalDeliveryStatusTone(
      finalDelivery.status
    );

  return tone === "review"
    ? `${classes.status} ${classes.statusReview}`
    : tone === "success"
      ? `${classes.status} ${classes.statusSuccess}`
      : tone === "danger"
        ? `${classes.status} ${classes.statusDanger}`
        : `${classes.status} ${classes.statusMuted}`;
};

const getVisibleFinalDeliveries = (
  finalDeliveries: ListingRequestFinalDeliveryRow[],
  viewer: ListingRequestFinalDeliveryViewer
): ListingRequestFinalDeliveryRow[] => {
  const visibleFinalDeliveries =
    viewer === "buyer"
      ? finalDeliveries.filter((finalDelivery) =>
          isListingRequestFinalDeliveryBuyerVisible({
            status: finalDelivery.status,
            submittedAt:
              finalDelivery.submitted_at,
          })
        )
      : finalDeliveries;

  return [...visibleFinalDeliveries].sort(
    (firstDelivery, secondDelivery) =>
      secondDelivery.version_number -
      firstDelivery.version_number
  );
};

const ListingRequestFinalDeliverySummary = ({
  finalDeliveries,
  viewer,
  isLoading = false,
  error,
}: ListingRequestFinalDeliverySummaryProps) => {
  const hasError = Boolean(error);

  const visibleFinalDeliveries =
    getVisibleFinalDeliveries(
      finalDeliveries,
      viewer
    );

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Final project delivery
          </h2>

          <p className={classes.text}>
            Final delivery versions submitted for buyer
            review and approval.
          </p>
        </div>

        {isLoading && (
          <div className={classes.loading}>
            Loading final deliveries…
          </div>
        )}

        {!isLoading && hasError && (
          <div className={classes.error}>
            {getErrorMessage(error)}
          </div>
        )}

        {!isLoading &&
          !hasError &&
          visibleFinalDeliveries.length === 0 && (
            <div className={classes.empty}>
              No final project delivery has been created
              yet.
            </div>
          )}

        {!isLoading &&
          !hasError &&
          visibleFinalDeliveries.length > 0 && (
            <div className={classes.list}>
              {visibleFinalDeliveries.map(
                (finalDelivery) => (
                  <article
                    className={classes.item}
                    key={finalDelivery.id}
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
                          {finalDelivery.title}
                        </h3>

                        <div
                          className={
                            classes.itemVersion
                          }
                        >
                          Delivery version{" "}
                          {
                            finalDelivery.version_number
                          }
                        </div>
                      </div>

                      <span
                        className={getStatusClass(
                          finalDelivery
                        )}
                      >
                        {getListingRequestFinalDeliveryStatusLabel(
                          finalDelivery.status
                        )}
                      </span>
                    </div>

                    <p
                      className={
                        classes.statusSummary
                      }
                    >
                      {getListingRequestFinalDeliveryStatusSummary(
                        finalDelivery.status
                      )}
                    </p>

                    <p className={classes.body}>
                      {finalDelivery.summary}
                    </p>

                    <div className={classes.metaGrid}>
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
                            finalDelivery.submitted_at
                          )}
                        </div>
                      </div>

                      {finalDelivery.buyer_approved_at && (
                        <div
                          className={
                            classes.metaBlock
                          }
                        >
                          <div
                            className={
                              classes.metaLabel
                            }
                          >
                            Buyer approved
                          </div>

                          <div
                            className={
                              classes.metaValue
                            }
                          >
                            {formatDate(
                              finalDelivery.buyer_approved_at
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {finalDelivery.delivery_links.length >
                    0 ? (
                      <div className={classes.links}>
                        {finalDelivery.delivery_links.map(
                          (deliveryLink, index) => (
                            <a
                              className={classes.link}
                              href={deliveryLink}
                              key={`${finalDelivery.id}-${index}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Delivery link {index + 1}
                            </a>
                          )
                        )}
                      </div>
                    ) : (
                      <div className={classes.noLinks}>
                        No external delivery links were
                        provided.
                      </div>
                    )}

                    {finalDelivery.revision_request_reason && (
                      <div className={classes.revision}>
                        <strong>
                          Revision requested:
                        </strong>{" "}
                        {
                          finalDelivery.revision_request_reason
                        }
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default ListingRequestFinalDeliverySummary;