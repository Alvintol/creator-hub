import { Link } from "react-router-dom";
import { useMyListings, type MyListingRow } from "../../hooks/listings/useMyListings";
import { useDeleteListingDraft } from '../../hooks/listings/useDeleteListingDraft';

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  grid: "grid gap-4 lg:grid-cols-2",
  card: "card p-5",
  emptyCard: "card p-8 text-center",

  cardTop: "flex items-start justify-between gap-3",
  cardTitleWrap: "space-y-1",
  cardTitle: "text-lg font-extrabold tracking-tight",
  cardText: "text-sm text-zinc-600",

  thumb:
    "h-40 w-full rounded-2xl border border-zinc-200 bg-zinc-100 object-cover",
  thumbEmpty:
    "flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-500",

  metaRow: "flex flex-wrap gap-2",
  pill: "chip",
  draftPill:
    "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  activePill:
    "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  inactivePill:
    "rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",

  footer: "flex flex-wrap items-center justify-between gap-3",
  dateText: "text-xs text-zinc-500",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDisabled:
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-500",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

// Formats the listing price for creator-facing cards
const priceText = (listing: MyListingRow): string =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : `$${listing.price_min}–$${listing.price_max ?? listing.price_min}`;

// Formats the last updated date into a readable local date string
const updatedText = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const CreatorListings = () => {
  const { data, isLoading, error } = useMyListings();

  const deleteDraftMutation = useDeleteListingDraft();

  const handleDeleteDraft = async (listingId: string, title: string) => {
    const confirmed = window.confirm(
      `Delete draft listing "${title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteDraftMutation.mutateAsync(listingId);
    } catch {
      // Surface a generic message in the page instead of throwing
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  return (
    <div className={classes.page}>
      <Link to="/creator/dashboard" className={classes.backLink}>
        ← Back to creator dashboard
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>My listings</h1>

        <p className={classes.sub}>
          View your private drafts and future published listings in one place.
        </p>
      </div>

      <div className={classes.row}>
        <Link className={classes.btnPrimary} to="/creator/listings/new">
          Create listing
        </Link>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Your listings could not be loaded right now.
        </div>
      )}

      {deleteDraftMutation.error && (
        <div className={classes.errorCard}>
          This draft could not be deleted right now.
        </div>
      )}

      {!error && (data?.length ?? 0) === 0 && (
        <div className={classes.emptyCard}>
          <h2 className={classes.cardTitle}>No listings yet</h2>

          <p className={classes.cardText}>
            Your draft listings will appear here after you create them.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/creator/listings/new">
              Create your first listing
            </Link>
          </div>
        </div>
      )}

      {(data?.length ?? 0) > 0 && (
        <div className={classes.grid}>
          {data?.map((listing) => (
            <div key={listing.id} className={classes.card}>
              <div className={classes.cardTop}>
                <div className={classes.cardTitleWrap}>
                  <h2 className={classes.cardTitle}>{listing.title}</h2>
                  <p className={classes.cardText}>{priceText(listing)}</p>
                </div>

                <div className={classes.metaRow}>
                  {listing.status === "draft" ? (
                    <span className={classes.draftPill}>Draft</span>
                  ) : (
                    <span className={classes.pill}>Published</span>
                  )}

                  {listing.is_active ? (
                    <span className={classes.activePill}>Active</span>
                  ) : (
                    <span className={classes.inactivePill}>Inactive</span>
                  )}
                </div>
              </div>

              {listing.preview_url ? (
                <img
                  src={listing.preview_url}
                  alt=""
                  className={classes.thumb}
                  loading="lazy"
                />
              ) : (
                <div className={classes.thumbEmpty}>No preview image</div>
              )}

              <p className={classes.cardText}>{listing.short}</p>

              <div className={classes.metaRow}>
                <span className={classes.pill}>{listing.offering_type}</span>
                <span className={classes.pill}>{listing.category}</span>

                {listing.video_subtype && (
                  <span className={classes.pill}>{listing.video_subtype}</span>
                )}
              </div>

              <div className={classes.footer}>
                <div className={classes.dateText}>
                  Updated: {updatedText(listing.updated_at)}
                </div>

                <div className={classes.row}>
                  <Link
                    className={classes.btnOutline}
                    to={`/creator/listings/${listing.id}`}
                  >
                    View details
                  </Link>

                  {listing.status === "draft" && !listing.is_active ? (
                    <>
                      <Link
                        className={classes.btnOutline}
                        to={`/creator/listings/${listing.id}/edit`}
                      >
                        Edit draft
                      </Link>

                      <button
                        className={classes.btnDanger}
                        type="button"
                        onClick={() => handleDeleteDraft(listing.id, listing.title)}
                        disabled={deleteDraftMutation.isPending}
                      >
                        {deleteDraftMutation.isPending ? "Deleting…" : "Delete draft"}
                      </button>
                    </>
                  ) : (
                    <span className={classes.btnDisabled}>Edit later</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorListings;