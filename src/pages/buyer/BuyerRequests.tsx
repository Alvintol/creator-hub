import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMyBuyerRequests } from "../../hooks/creatorRequests/useMyBuyerRequests";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";

type BuyerRequestsProps = {
  archived?: boolean;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  grid: "grid gap-4 lg:grid-cols-2",
  card: "card p-5",

  title: "text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  pills: "flex flex-wrap gap-2",
  pill: "chip",

  statusPillBase:
    "rounded-full border px-3 py-1 text-xs font-semibold",
  statusPillReview:
    "border-amber-200 bg-amber-50 text-amber-800",
  statusPillSuccess:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  statusPillDanger:
    "border-red-200 bg-red-50 text-red-800",
  statusPillMuted:
    "border-zinc-200 bg-zinc-100 text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  pagerText: "text-sm text-zinc-600",
} as const;

const pageSize = 12;

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

// Formats request timestamps for buyer cards
const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const getStatusPillClass = (
  status: "submitted" | "accepted" | "declined" | "archived"
) => {
  const tone = getListingRequestStatusTone(status);

  return tone === "review"
    ? `${classes.statusPillBase} ${classes.statusPillReview}`
    : tone === "success"
      ? `${classes.statusPillBase} ${classes.statusPillSuccess}`
      : tone === "danger"
        ? `${classes.statusPillBase} ${classes.statusPillDanger}`
        : `${classes.statusPillBase} ${classes.statusPillMuted}`;
};

const BuyerRequests = (props: BuyerRequestsProps) => {
  const { archived = false } = props;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [archived]);

  const { data, isLoading, error } = useMyBuyerRequests({
    archived,
    page,
    pageSize,
  });

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>
          {archived ? "Archived requests" : "My requests"}
        </h1>

        <p className={classes.sub}>
          {archived
            ? "Review archived requests you previously submitted to creators."
            : "Review the requests you have submitted to creators and track their current status."}
        </p>
      </div>

      <div className={classes.row}>
        <Link
          className={archived ? classes.btnOutline : classes.btnPrimary}
          to="/requests"
        >
          Active requests
        </Link>

        <Link
          className={archived ? classes.btnPrimary : classes.btnOutline}
          to="/requests/archived"
        >
          Archived requests
        </Link>

        <div className={classes.pagerText}>
          {isLoading ? "Loading…" : `${totalCount} request(s) found`}
        </div>

        {pageCount > 0 && (
          <div className={classes.pagerText}>
            Page {page} of {pageCount}
          </div>
        )}
      </div>

      {error && (
        <div className={classes.errorCard}>
          Your requests could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading requests…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>
            {archived
              ? "You do not have any archived requests."
              : "You have not submitted any active requests."}
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.request.id} className={classes.card}>
                <h2 className={classes.title}>
                  {item.request.listing_snapshot.title}
                </h2>

                <p className={classes.text}>
                  Creator: {creatorText(item.creator, item.request.creator_user_id)}
                </p>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Status</div>
                    <div className={getStatusPillClass(item.request.status)}>
                      {getListingRequestStatusLabel(item.request.status)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Submitted</div>
                    <div className={classes.metaValue}>
                      {dateText(item.request.created_at)}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Purchase flow</div>
                    <div className={classes.metaValue}>
                      {item.request.listing_snapshot.fulfilment_mode}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Price snapshot</div>
                    <div className={classes.metaValue}>
                      {item.request.listing_snapshot.price_type === "fixed"
                        ? `$${item.request.listing_snapshot.price_min}`
                        : item.request.listing_snapshot.price_type === "starting_at"
                          ? `From $${item.request.listing_snapshot.price_min}`
                          : `$${item.request.listing_snapshot.price_min}–$${item.request.listing_snapshot.price_max ?? item.request.listing_snapshot.price_min}`}
                    </div>
                  </div>
                </div>

                <div className={classes.pills}>
                  <span className={classes.pill}>
                    {item.request.listing_snapshot.offering_type}
                  </span>
                  <span className={classes.pill}>
                    {item.request.listing_snapshot.category}
                  </span>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/requests/${item.request.id}`}
                  >
                    View request
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>

            <button
              className={classes.btnOutline}
              type="button"
              disabled={pageCount === 0 || page >= pageCount}
              onClick={() =>
                setPage((current) =>
                  pageCount > 0 ? Math.min(pageCount, current + 1) : current
                )
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BuyerRequests;