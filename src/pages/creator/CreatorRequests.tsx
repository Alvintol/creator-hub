import { Link } from "react-router-dom";
import { useMyCreatorRequests } from "../../hooks/creatorRequests/useMyCreatorRequests";

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  row: "flex flex-wrap items-center gap-3",
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

  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
} as const;

// Prefers handle for buyer display, then display name, then user id
const buyerText = (
  buyer: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  buyer?.handle ? `@${buyer.handle}` : buyer?.display_name ?? fallbackUserId;

// Formats timestamps for creator request cards
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

const CreatorRequests = () => {
  const { data, isLoading, error } = useMyCreatorRequests();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Creator requests</h1>

        <p className={classes.sub}>
          Review incoming buyer requests tied to your request-based listings.
        </p>
      </div>

      {error && (
        <div className={classes.errorCard}>
          Requests could not be loaded right now.
        </div>
      )}

      {isLoading && <div className={classes.loadingText}>Loading requests…</div>}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <div className={classes.card}>
          <p className={classes.text}>
            You do not have any listing requests yet.
          </p>
        </div>
      )}

      {!isLoading && !error && (data?.length ?? 0) > 0 && (
        <div className={classes.grid}>
          {data?.map((item) => (
            <div key={item.request.id} className={classes.card}>
              <h2 className={classes.title}>
                {item.request.listing_snapshot.title}
              </h2>

              <p className={classes.text}>
                Buyer: {buyerText(item.buyer, item.request.buyer_user_id)}
              </p>

              <div className={classes.metaGrid}>
                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Status</div>
                  <div className={classes.metaValue}>{item.request.status}</div>
                </div>

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Received</div>
                  <div className={classes.metaValue}>
                    {dateText(item.request.created_at)}
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

                <div className={classes.metaBlock}>
                  <div className={classes.metaLabel}>Category</div>
                  <div className={classes.metaValue}>
                    {item.request.listing_snapshot.category}
                  </div>
                </div>
              </div>

              <div className={classes.pills}>
                <span className={classes.pill}>
                  {item.request.listing_snapshot.fulfilment_mode}
                </span>
                <span className={classes.pill}>
                  {item.request.listing_snapshot.offering_type}
                </span>
              </div>

              <div className={classes.row}>
                <Link
                  className={classes.btnPrimary}
                  to={`/creator/requests/${item.request.id}`}
                >
                  View request
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorRequests;