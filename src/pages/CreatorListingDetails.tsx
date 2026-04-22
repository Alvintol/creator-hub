import { Link, useNavigate, useParams } from "react-router-dom";
import { useMyListing } from "../hooks/useMyListing";
import { useDeleteListingDraft } from "../hooks/useDeleteListingDraft";
import { getListingPublishReadiness } from '../lib/listings/listingPublishReadiness';
import { usePublishListing } from '../hooks/usePublishListing';

const classes = {
  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  grid: "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]",
  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",

  preview:
    "w-full rounded-3xl border border-zinc-200 bg-zinc-100 object-cover",
  previewEmpty:
    "flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-500",

  metaGrid: "grid gap-4 sm:grid-cols-2",
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

  list: "space-y-2",
  listItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-bold text-red-700 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-red-400 hover:bg-red-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",

  readinessCard: "card p-6",
  checkList: "space-y-2",
  checkRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkPass:
    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700",
  checkFail:
    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700",
  checkText: "text-sm text-zinc-700",
  readyBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800",
  notReadyBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800",
  btnDisabled:
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-500",
} as const;

const priceText = (priceType: "fixed" | "starting_at" | "range", priceMin: number, priceMax: number | null) =>
  priceType === "fixed"
    ? `$${priceMin}`
    : priceType === "starting_at"
      ? `From $${priceMin}`
      : `$${priceMin}–$${priceMax ?? priceMin}`;

const dateText = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const CreatorListingDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: listing, isLoading, error } = useMyListing(id ?? null);
  const deleteDraftMutation = useDeleteListingDraft();
  const publishListingMutation = usePublishListing();

  const handleDeleteDraft = async () => {
    if (!listing) return;

    const confirmed = window.confirm(
      `Delete draft listing "${listing.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteDraftMutation.mutateAsync(listing.id);
      navigate("/creator/listings");
    } catch {
      // Error is surfaced below
    }
  };

  const handlePublishListing = async () => {
    if (!listing || !publishReadiness.isReady) return;

    const confirmed = window.confirm(
      `Publish listing "${listing.title}" now? It will become visible in the market.`
    );

    if (!confirmed) return;

    try {
      await publishListingMutation.mutateAsync(listing.id);
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !listing) {
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

  const isDraftInactive = listing.status === "draft" && !listing.is_active;

  const publishReadiness = getListingPublishReadiness(listing);

  return (
    <div className={classes.page}>
      {/* {isDraftInactive ? (
        publishReadiness.isReady ? (
          <button
            className={classes.btnPrimary}
            type="button"
            onClick={handlePublishListing}
            disabled={publishListingMutation.isPending}
          >
            {publishListingMutation.isPending ? "Publishing…" : "Publish listing"}
          </button>
        ) : (
          <span className={classes.btnDisabled}>Complete checklist to publish</span>
        )
      ) : (
        <span className={classes.btnDisabled}>Already published</span>
      )} */}

      <Link className={classes.btnOutline} to="/creator/listings">
        Back to listings
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>{listing.title}</h1>

        <p className={classes.sub}>
          Review your private listing details before broader listing management
          and publishing are added.
        </p>
      </div>

      {publishListingMutation.error && (
        <div className={classes.errorCard}>
          This listing could not be published right now.
        </div>
      )}

      {deleteDraftMutation.error && (
        <div className={classes.errorCard}>
          This draft could not be deleted right now.
        </div>
      )}

      <div className={classes.grid}>
        <div className={classes.section}>
          {listing.preview_url ? (
            <img
              src={listing.preview_url}
              alt=""
              className={classes.preview}
              loading="lazy"
            />
          ) : (
            <div className={classes.previewEmpty}>No preview image</div>
          )}

          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Summary</h2>
              <p className={classes.text}>{listing.short}</p>
            </div>

            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Deliverables</h2>

              {listing.deliverables.length > 0 ? (
                <div className={classes.list}>
                  {listing.deliverables.map((deliverable) => (
                    <div key={deliverable} className={classes.listItem}>
                      {deliverable}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={classes.text}>No deliverables added yet.</p>
              )}
            </div>

            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Tags</h2>

              {listing.tags.length > 0 ? (
                <div className={classes.pills}>
                  {listing.tags.map((tag) => (
                    <span key={tag} className={classes.pill}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={classes.text}>No tags added yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Listing status</h2>

              <div className={classes.pills}>
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

            <div className={classes.metaGrid}>
              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Price</div>
                <div className={classes.metaValue}>
                  {priceText(listing.price_type, listing.price_min, listing.price_max)}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Offering type</div>
                <div className={classes.metaValue}>{listing.offering_type}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Category</div>
                <div className={classes.metaValue}>{listing.category}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Video subtype</div>
                <div className={classes.metaValue}>
                  {listing.video_subtype ?? "None"}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Created</div>
                <div className={classes.metaValue}>{dateText(listing.created_at)}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>Last updated</div>
                <div className={classes.metaValue}>{dateText(listing.updated_at)}</div>
              </div>
            </div>
          </div>

          <div className={classes.readinessCard}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Publish readiness</h2>

              <p className={classes.text}>
                This checklist helps confirm the listing is ready before publishing is
                introduced as a separate step.
              </p>
            </div>

            <div className={classes.section}>
              {publishReadiness.isReady ? (
                <div className={classes.readyBox}>
                  This listing is ready for a future publish action.
                </div>
              ) : (
                <div className={classes.notReadyBox}>
                  This listing is not ready to publish yet.
                </div>
              )}

              <div className={classes.checkList}>
                {publishReadiness.checks.map((check) => (
                  <div key={check.key} className={classes.checkRow}>
                    <span className={check.passed ? classes.checkPass : classes.checkFail}>
                      {check.passed ? "✓" : "!"}
                    </span>

                    <div className={classes.checkText}>{check.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>Actions</h2>

              <p className={classes.text}>
                Manage this listing here. Publishing is only available for inactive drafts
                that pass the readiness checklist.
              </p>
            </div>

            <div className={classes.row}>
              {isDraftInactive ? (
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
                    onClick={handleDeleteDraft}
                    disabled={deleteDraftMutation.isPending}
                  >
                    {deleteDraftMutation.isPending ? "Deleting…" : "Delete draft"}
                  </button>

                  {publishReadiness.isReady ? (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      onClick={handlePublishListing}
                      disabled={publishListingMutation.isPending}
                    >
                      {publishListingMutation.isPending
                        ? "Publishing…"
                        : "Publish listing"}
                    </button>
                  ) : (
                    <span className={classes.btnDisabled}>
                      Complete checklist to publish
                    </span>
                  )}
                </>
              ) : (
                <span className={classes.btnDisabled}>Already published</span>
              )}

              <Link className={classes.btnOutline} to="/creator/listings">
                Back to listings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorListingDetails;