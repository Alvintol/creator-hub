import { Link, useParams } from "react-router-dom";
import { useAdminRequest } from "../../hooks/admin/useAdminRequest";
import { getListingRequestStatusLabel } from "../../domain/listings/listingRequests";
import ListingRequestStatusCard from "../../components/ListingRequestStatusCard";

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
          <div className={classes.section}>
            <h2 className={classes.sectionTitle}>Request summary</h2>
            <p className={classes.text}>{request.message}</p>
          </div>

          <ListingRequestStatusCard
            status={request.status}
            reason={request.creator_status_reason}
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
                {getListingRequestStatusLabel(request.status)}
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