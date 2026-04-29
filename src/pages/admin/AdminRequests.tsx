import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminRequests,
  type AdminRequestsFilters,
  type AdminRequestItem,
} from "../../hooks/admin/useAdminRequests";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  filtersGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-5",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  grid: "grid gap-4 lg:grid-cols-2",
  requestCard: "card p-5",
  title: "text-lg font-extrabold tracking-tight",
  textMuted: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  row: "flex flex-wrap items-center gap-3",
  pagerText: "text-sm text-zinc-600",

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

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const initialFilters: AdminRequestsFilters = {
  creatorHandle: "",
  buyerHandle: "",
  createdFrom: "",
  createdTo: "",
  status: "all",
};

const pageSize = 20;

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

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

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

const priceText = (item: AdminRequestItem) => {
  const snapshot = item.request.listing_snapshot;

  return snapshot.price_type === "fixed"
    ? `$${snapshot.price_min}`
    : snapshot.price_type === "starting_at"
      ? `From $${snapshot.price_min}`
      : `$${snapshot.price_min}–$${snapshot.price_max ?? snapshot.price_min}`;
};

const AdminRequests = () => {
  const [filters, setFilters] = useState<AdminRequestsFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminRequests({
    filters,
    page,
    pageSize,
  });

  const setField = <Key extends keyof AdminRequestsFilters>(
    key: Key,
    value: AdminRequestsFilters[Key]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  };

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;

  return (
    <div className={classes.page}>
      <Link to="/admin/dashboard" className={classes.backLink}>
        ← Back to admin dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>Admin requests</h1>

        <p className={classes.sub}>
          Review buyer requests, creator responses, decline reasons, and frozen
          listing snapshots for dispute support.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="creatorHandle">
                Creator username
              </label>

              <input
                id="creatorHandle"
                className={classes.input}
                type="text"
                value={filters.creatorHandle}
                onChange={(event) => setField("creatorHandle", event.target.value)}
                placeholder="@creatorname"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="buyerHandle">
                Buyer username
              </label>

              <input
                id="buyerHandle"
                className={classes.input}
                type="text"
                value={filters.buyerHandle}
                onChange={(event) => setField("buyerHandle", event.target.value)}
                placeholder="@buyername"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="createdFrom">
                Submitted from
              </label>

              <input
                id="createdFrom"
                className={classes.input}
                type="date"
                value={filters.createdFrom}
                onChange={(event) => setField("createdFrom", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="createdTo">
                Submitted to
              </label>

              <input
                id="createdTo"
                className={classes.input}
                type="date"
                value={filters.createdTo}
                onChange={(event) => setField("createdTo", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="status">
                Status
              </label>

              <select
                id="status"
                className={classes.select}
                value={filters.status}
                onChange={(event) =>
                  setField(
                    "status",
                    event.target.value as AdminRequestsFilters["status"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="submitted">Under review</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className={classes.row}>
            <button
              className={classes.btnOutline}
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setPage(1);
              }}
            >
              Reset filters
            </button>

            <div className={classes.pagerText}>
              {isLoading ? "Loading…" : `${totalCount} request(s) found`}
            </div>

            {pageCount > 0 && (
              <div className={classes.pagerText}>
                Page {page} of {pageCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Requests could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading requests…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>No requests matched the current filters.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.request.id} className={classes.requestCard}>
                <h2 className={classes.title}>
                  {item.request.listing_snapshot.title}
                </h2>

                <p className={classes.textMuted}>
                  Buyer: {profileText(item.buyer, item.request.buyer_user_id)}
                </p>

                <p className={classes.textMuted}>
                  Creator: {profileText(item.creator, item.request.creator_user_id)}
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
                    <div className={classes.metaValue}>{priceText(item)}</div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/requests/${item.request.id}`}
                  >
                    View request
                  </Link>

                  <Link
                    className={classes.btnOutline}
                    to={`/admin/listing-revisions/${item.request.listing_id}`}
                  >
                    Listing revisions
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

export default AdminRequests;