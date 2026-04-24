import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useInfiniteListingRevisions,
  type ListingRevisionRow,
} from "../hooks/useListingRevisions";
import { useMyListing } from "../hooks/useMyListing";
import { getListingRevisionChanges } from '../lib/listings/listingRevisionDiff';

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  revisionList: "space-y-3",
  revisionItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  revisionTop: "flex flex-wrap items-center justify-between gap-3",
  revisionTitle: "text-sm font-bold text-zinc-900",
  revisionMeta: "text-xs text-zinc-500",
  revisionBody: "mt-3 space-y-2",
  revisionText: "text-sm text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  changeList: "mt-3 space-y-2",
  changeItem:
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700",
} as const;

const revisionEventLabel = (eventType: ListingRevisionRow["event_type"]) =>
  eventType === "created"
    ? "Created"
    : eventType === "updated"
      ? "Updated"
      : eventType === "published"
        ? "Published"
        : eventType === "deactivated"
          ? "Deactivated"
          : eventType === "reactivated"
            ? "Reactivated"
            : "Moved to draft";

const revisionDateText = (value: string) => {
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

const revisionPriceText = (
  priceType: "fixed" | "starting_at" | "range",
  priceMin: number,
  priceMax: number | null
) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `From $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

const CreatorListingRevisions = () => {
  const { id } = useParams<{ id: string }>();

  const { data: listing, isLoading: isLoadingListing, error: listingError } =
    useMyListing(id ?? null);

  const {
    data,
    isLoading: isLoadingRevisions,
    error: revisionsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteListingRevisions(id ?? null, 3);

  const revisionRows = useMemo(
    () => data?.pages.flatMap((page) => page.rows) ?? [],
    [data]
  );

  if (isLoadingListing) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (listingError || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← Back to my listings
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Listing not found</h1>
          <p className={classes.sub}>
            This listing could not be loaded from your creator account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <Link to={`/creator/listings/${listing.id}`} className={classes.backLink}>
        ← Back to listing details
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Revision history</h1>

        <p className={classes.sub}>
          Private creator-side revision history for {listing.title}.
        </p>
      </div>

      <div className={classes.card}>
        {revisionsError && (
          <div className={classes.errorCard}>
            Revision history could not be loaded right now.
          </div>
        )}

        {isLoadingRevisions && revisionRows.length === 0 && (
          <div className={classes.loadingText}>Loading revision history…</div>
        )}

        {!isLoadingRevisions && !revisionsError && revisionRows.length === 0 && (
          <p className={classes.text}>No revisions have been recorded yet.</p>
        )}

        {revisionRows.length > 0 && (
          <div className={classes.section}>
            <div className={classes.revisionList}>
              {revisionRows.map((revision, index) => {
                const previousRevision = revisionRows[index + 1] ?? null;
                const changes = getListingRevisionChanges(revision, previousRevision);

                return (
                  <div key={revision.id} className={classes.revisionItem}>
                    <div className={classes.revisionTop}>
                      <div className={classes.revisionTitle}>
                        {revisionEventLabel(revision.event_type)}
                      </div>

                      <div className={classes.revisionMeta}>
                        {revisionDateText(revision.created_at)}
                      </div>
                    </div>

                    <div className={classes.revisionBody}>
                      <div className={classes.revisionText}>
                        <strong>Title:</strong> {revision.snapshot.title}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>Price:</strong>{" "}
                        {revisionPriceText(
                          revision.snapshot.price_type,
                          revision.snapshot.price_min,
                          revision.snapshot.price_max
                        )}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>Status:</strong> {revision.snapshot.status}
                        {revision.snapshot.is_active ? " • Active" : " • Inactive"}
                      </div>

                      <div className={classes.revisionText}>
                        <strong>Category:</strong> {revision.snapshot.category}
                      </div>

                      <div className={classes.changeList}>
                        {changes.map((change) => (
                          <div
                            key={`${revision.id}-${change.key}-${change.label}`}
                            className={classes.changeItem}
                          >
                            {change.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={classes.row}>
              {hasNextPage && (
                <button
                  className={classes.btnPrimary}
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading…" : "Load 3 more"}
                </button>
              )}

              <Link
                className={classes.btnOutline}
                to={`/creator/listings/${listing.id}`}
              >
                Back to listing details
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorListingRevisions;