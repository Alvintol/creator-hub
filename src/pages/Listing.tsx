import { Link, useParams } from "react-router-dom";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import {
  usePublicListing,
  type PublicListingRow,
} from "../hooks/usePublicListing";

const classes = {
  notFoundWrap: "space-y-4",
  h1: "text-2xl font-extrabold tracking-tight",
  backBtn: "btnOutline",

  page: "space-y-6",
  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",
  loadingText: "text-sm text-zinc-600",

  grid: "grid gap-6 lg:grid-cols-2",
  img: "w-full rounded-3xl border border-zinc-200 object-cover bg-zinc-100",

  rightCol: "space-y-4",
  titleRow: "flex flex-wrap items-center gap-2",
  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",
  liveBadge: "badge badgeLive",
  desc: "text-zinc-600",

  priceRow: "flex items-center justify-between gap-3",
  price: "text-xl font-extrabold",
  creatorLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  chips: "flex flex-wrap gap-2",
  chip: "chip",

  ctaBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  ctaTitle: "font-semibold",
  ctaText: "mt-1 text-sm text-zinc-600",
  ctaLink: "btnPrimary mt-3 inline-flex",

  liveCard: "overflow-hidden rounded-3xl border border-zinc-200 bg-white",
  liveImg: "h-48 w-full object-cover",
  liveBody: "p-4",
  liveMeta: "text-sm font-extrabold text-zinc-900",
  liveDot: "text-zinc-400",
  liveTitle: "mt-1 text-sm text-zinc-600",
} as const;

// Formats the listing price for display
const priceText = (listing: PublicListingRow): string =>
  listing.price_type === "fixed"
    ? `$${listing.price_min}`
    : listing.price_type === "starting_at"
      ? `From $${listing.price_min}`
      : listing.price_type === "range"
        ? `$${listing.price_min}–$${listing.price_max ?? listing.price_min}`
        : "";

const ListingNotFound = () => (
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Listing not found</h1>

    <Link to="/market" className={classes.backBtn}>
      Back to market
    </Link>
  </div>
);

const ListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { twitchByLogin } = useTwitchStreams();

  const { data, isLoading, error } = usePublicListing(id ?? null);

  if (!id) return <ListingNotFound />;

  if (isLoading) {
    return (
      <div className={classes.page}>
        <div className={classes.loadingText}>Loading…</div>
      </div>
    );
  }

  if (error || !data?.listing) return <ListingNotFound />;

  const { listing, creator, platformAccounts } = data;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw
    ? normalizeTwitchLogin(twitchLoginRaw)
    : null;

  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = Boolean(stream);

  const creatorName = creator?.display_name ?? creator?.handle ?? "Creator";
  const creatorLink = creator?.handle ? `/creator/${creator.handle}` : null;

  return (
    <div className={classes.page}>
      <Link to="/market" className={classes.backLink}>
        ← Back
      </Link>

      <div className={classes.grid}>
        <img
          src={listing.preview_url ?? ""}
          alt=""
          className={classes.img}
          loading="lazy"
        />

        <div className={classes.rightCol}>
          <div className={classes.titleRow}>
            <h1 className={classes.h1}>{listing.title}</h1>

            <span className={classes.badge}>{listing.offering_type}</span>

            {isLive && <span className={classes.liveBadge}>Live</span>}
          </div>

          <p className={classes.desc}>{listing.short}</p>

          <div className={classes.priceRow}>
            <div className={classes.price}>{priceText(listing)}</div>

            {creatorLink ? (
              <Link to={creatorLink} className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""} →
              </Link>
            ) : (
              <span className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""}
              </span>
            )}
          </div>

          <div className={classes.chips}>
            <span className={classes.chip}>{listing.category}</span>

            {listing.video_subtype && (
              <span className={classes.chip}>{listing.video_subtype}</span>
            )}

            {listing.deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>

          {isLive && stream?.thumbnailUrl && (
            <div className={classes.liveCard}>
              <img
                src={stream.thumbnailUrl
                  .replace("{width}", "960")
                  .replace("{height}", "540")}
                alt=""
                className={classes.liveImg}
                loading="lazy"
              />

              <div className={classes.liveBody}>
                <div className={classes.liveMeta}>
                  {stream.gameName ?? ""}
                  <span className={classes.liveDot}> • </span>
                  {stream.viewerCount ?? 0} viewers
                </div>

                {stream.title && (
                  <p className={classes.liveTitle}>{stream.title}</p>
                )}
              </div>
            </div>
          )}

          <div className={classes.ctaBox}>
            <div className={classes.ctaTitle}>Checkout coming soon</div>

            <p className={classes.ctaText}>
              v0 focuses on discovery. Payments + safe delivery will come after.
            </p>

            {creatorLink && (
              <Link to={creatorLink} className={classes.ctaLink}>
                Contact creator
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPage;