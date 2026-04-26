import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminListings,
  type AdminListingsFilters,
  type AdminListingItem,
} from "../hooks/useAdminListings";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  filtersGrid: "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
  field: "space-y-2",
  label: "text-sm font-bold text-zinc-900",
  input:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  select:
    "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",

  row: "flex flex-wrap items-center gap-3",
  countText: "text-sm text-zinc-600",
  pagerText: "text-sm text-zinc-600",

  grid: "grid gap-4 lg:grid-cols-2",
  listingCard: "card p-5",
  listingTop: "flex flex-wrap items-start justify-between gap-3",
  listingTitleWrap: "space-y-1",
  listingTitle: "text-lg font-extrabold tracking-tight",
  listingText: "text-sm text-zinc-600",

  metaGrid: "grid gap-3 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  metaValue: "text-sm text-zinc-900",

  pills: "flex flex-wrap gap-2",
  pill: "chip",
  draftPill:
    "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  activePill:
    "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  inactivePill:
    "rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

const initialFilters: AdminListingsFilters = {
  q: "",
  creatorHandle: "",
  updatedFrom: "",
  updatedTo: "",
  offeringType: "all",
  priceType: "all",
  minPrice: "",
  maxPrice: "",
  status: "all",
  activeState: "all",
};

const pageSize = 25;

// Keeps only digits for price filter inputs
const normaliseIntegerInput = (value: string) =>
  value.replace(/[^\d]/g, "");

// Formats a listing price for admin display
const priceText = (listing: AdminListingItem["listing"]) =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : `$${listing.price_min}–$${listing.price_max ?? listing.price_min}`;

// Formats updated timestamps into a readable local date
const updatedText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

// Prefers handle for admin username display, then display name, then user id
const creatorText = (item: AdminListingItem) =>
  item.creator?.handle
    ? `@${item.creator.handle}`
    : item.creator?.display_name ?? item.listing.user_id;

const AdminListings = () => {
  const [filters, setFilters] = useState<AdminListingsFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useAdminListings({
    filters,
    page,
    pageSize,
  });

  const setField = <Key extends keyof AdminListingsFilters>(
    key: Key,
    value: AdminListingsFilters[Key]
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
  };

  const totalCount = data?.totalCount ?? 0;
  const pageCount = data?.pageCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Admin listings</h1>

        <p className={classes.sub}>
          Search creator listings by username, dates, listing type, prices,
          status, and visibility.
        </p>
      </div>

      <div className={classes.card}>
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Filters</h2>

          <div className={classes.filtersGrid}>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="q">
                Search
              </label>

              <input
                id="q"
                className={classes.input}
                type="text"
                value={filters.q}
                onChange={(event) => setField("q", event.target.value)}
                placeholder="Title, short description, or category"
              />
            </div>

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
              <label className={classes.label} htmlFor="updatedFrom">
                Updated from
              </label>

              <input
                id="updatedFrom"
                className={classes.input}
                type="date"
                value={filters.updatedFrom}
                onChange={(event) => setField("updatedFrom", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="updatedTo">
                Updated to
              </label>

              <input
                id="updatedTo"
                className={classes.input}
                type="date"
                value={filters.updatedTo}
                onChange={(event) => setField("updatedTo", event.target.value)}
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="offeringType">
                Offering type
              </label>

              <select
                id="offeringType"
                className={classes.select}
                value={filters.offeringType}
                onChange={(event) =>
                  setField(
                    "offeringType",
                    event.target.value as AdminListingsFilters["offeringType"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="digital">Digital</option>
                <option value="commission">Commission</option>
                <option value="service">Service</option>
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="priceType">
                Price type
              </label>

              <select
                id="priceType"
                className={classes.select}
                value={filters.priceType}
                onChange={(event) =>
                  setField(
                    "priceType",
                    event.target.value as AdminListingsFilters["priceType"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="fixed">Fixed</option>
                <option value="starting_at">Starting at</option>
                <option value="range">Range</option>
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="minPrice">
                Min price
              </label>

              <input
                id="minPrice"
                className={classes.input}
                type="text"
                inputMode="numeric"
                value={filters.minPrice}
                onChange={(event) =>
                  setField("minPrice", normaliseIntegerInput(event.target.value))
                }
                placeholder="0"
              />
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="maxPrice">
                Max price
              </label>

              <input
                id="maxPrice"
                className={classes.input}
                type="text"
                inputMode="numeric"
                value={filters.maxPrice}
                onChange={(event) =>
                  setField("maxPrice", normaliseIntegerInput(event.target.value))
                }
                placeholder="100"
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
                    event.target.value as AdminListingsFilters["status"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className={classes.field}>
              <label className={classes.label} htmlFor="activeState">
                Visibility
              </label>

              <select
                id="activeState"
                className={classes.select}
                value={filters.activeState}
                onChange={(event) =>
                  setField(
                    "activeState",
                    event.target.value as AdminListingsFilters["activeState"]
                  )
                }
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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

            <div className={classes.countText}>
              {isLoading ? "Loading…" : `${totalCount} listing(s) found`}
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
          Listings could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading listings…</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>No listings matched the current filters.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className={classes.grid}>
            {items.map((item) => (
              <div key={item.listing.id} className={classes.listingCard}>
                <div className={classes.listingTop}>
                  <div className={classes.listingTitleWrap}>
                    <h2 className={classes.listingTitle}>{item.listing.title}</h2>
                    <p className={classes.listingText}>
                      Creator: {creatorText(item)}
                    </p>
                  </div>

                  <div className={classes.pills}>
                    {item.listing.status === "draft" ? (
                      <span className={classes.draftPill}>Draft</span>
                    ) : (
                      <span className={classes.pill}>Published</span>
                    )}

                    {item.listing.is_active ? (
                      <span className={classes.activePill}>Active</span>
                    ) : (
                      <span className={classes.inactivePill}>Inactive</span>
                    )}
                  </div>
                </div>

                <div className={classes.metaGrid}>
                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Price</div>
                    <div className={classes.metaValue}>{priceText(item.listing)}</div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Offering type</div>
                    <div className={classes.metaValue}>
                      {item.listing.offering_type}
                    </div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Category</div>
                    <div className={classes.metaValue}>{item.listing.category}</div>
                  </div>

                  <div className={classes.metaBlock}>
                    <div className={classes.metaLabel}>Last updated</div>
                    <div className={classes.metaValue}>
                      {updatedText(item.listing.updated_at)}
                    </div>
                  </div>
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnPrimary}
                    to={`/admin/listing-revisions/${item.listing.id}`}
                  >
                    View revisions
                  </Link>

                  {item.listing.status === "published" && item.listing.is_active && (
                    <Link
                      className={classes.btnOutline}
                      to={`/listing/${item.listing.id}`}
                    >
                      View public page
                    </Link>
                  )}
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

export default AdminListings;