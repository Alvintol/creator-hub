import { Link, useParams } from "react-router-dom";
import { creators, listings, type Creator, type Listing } from "../data/mock";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { usePublicCreatorProfile } from '../hooks/usePublicCreatorProfile';

const classes = {
  container: "space-y-8",

  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  notFoundWrap: "space-y-4",
  h1: "text-2xl font-extrabold tracking-tight",
  h2: "text-xl font-extrabold tracking-tight",

  card: "card p-6",

  titleRow: "flex flex-wrap items-center gap-2",
  bio: "mt-2 text-zinc-600",

  badgeVerified: "badge",
  badgeLive: "badge badgeLive",

  linksRow: "mt-4 flex flex-wrap gap-2",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  listingsSection: "space-y-3",
  emptyText: "text-sm text-zinc-600",
  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",

  listingCard: "card overflow-hidden",
  listingImg: "h-40 w-full object-cover",
  listingBody: "p-4",
  listingTitle: "text-base font-extrabold tracking-tight",
  listingDesc: "mt-1 text-sm text-zinc-600",
  listingMeta: "mt-3 flex items-center justify-between text-sm",
  listingMetaLeft: "font-extrabold",
  listingMetaRight: "text-zinc-600",

  liveCard: "mt-4 overflow-hidden rounded-3xl border border-zinc-200 bg-white",
  liveImg: "h-56 w-full object-cover",
  liveBody: "p-4",
  liveMeta: "text-sm font-extrabold text-zinc-900",
  liveDot: "text-zinc-400",
  liveTitle: "mt-1 text-sm text-zinc-600",
} as const;

// Finds a creator by their public route handle
const getCreatorByHandle = (handle: string): Creator | undefined =>
  creators.find((creator) => creator.handle === handle);

// Finds all listings owned by a creator using the stable internal creator id
const getListingsByCreatorId = (creatorId: string): Listing[] =>
  listings.filter((listing) => listing.creatorId === creatorId);

type CreatorLinkButtonProps = {
  href: string;
  label: string;
  variant?: "primary" | "outline";
};

const CreatorLinkButton = (props: CreatorLinkButtonProps) => {
  const { href, label, variant = "outline" } = props;

  const className =
    variant === "primary" ? classes.btnPrimary : classes.btnOutline;

  return (
    <a className={className} target="_blank" rel="noreferrer" href={href}>
      {label}
    </a>
  );
};

type CreatorListingLinkProps = {
  listing: Listing;
};

const CreatorListingLink = (props: CreatorListingLinkProps) => {
  const { listing } = props;

  return (
    <Link to={`/listing/${listing.id}`} className={classes.listingCard}>
      <img src={listing.preview} alt="" className={classes.listingImg} />

      <div className={classes.listingBody}>
        <div className={classes.listingTitle}>{listing.title}</div>
        <p className={classes.listingDesc}>{listing.short}</p>

        <div className={classes.listingMeta}>
          <span className={classes.listingMetaLeft}>{listing.offeringType}</span>
          <span className={classes.listingMetaRight}>{listing.category}</span>
        </div>
      </div>
    </Link>
  );
};

const CreatorNotFound = () => (
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Creator not found</h1>

    <Link to="/creators" className={classes.btnOutline}>
      Back to creators
    </Link>
  </div>
);

const CreatorProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const { twitchByLogin } = useTwitchStreams();

  const {
    data,
    isLoading,
    error,
  } = usePublicCreatorProfile(handle ?? null);

  if (!handle) return <CreatorNotFound />;
  if (isLoading) return <div className={classes.container}>Loading…</div>;
  if (error || !data?.profile) return <CreatorNotFound />;

  const { profile, platformAccounts, listings } = data;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const youtubeAccount =
    platformAccounts.find((account) => account.platform === "youtube") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw ? normalizeTwitchLogin(twitchLoginRaw) : null;
  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = Boolean(stream);

  const watchUrl =
    twitchAccount?.profile_url ??
    (twitchLogin
      ? `https://twitch.tv/${encodeURIComponent(twitchLogin)}`
      : undefined);

  return (
    <div className={classes.container}>
      <Link to="/creators" className={classes.backLink}>
        ← Back
      </Link>

      <section className={classes.card}>
        <div className={classes.titleRow}>
          <h1 className={classes.h1}>
            {profile.display_name || profile.handle || "Creator"}
          </h1>

          {isLive && <span className={classes.badgeLive}>Live</span>}
        </div>

        {profile.bio && <p className={classes.bio}>{profile.bio}</p>}

        <div className={classes.linksRow}>
          {watchUrl && (
            <CreatorLinkButton
              href={watchUrl}
              label={isLive ? "Watch live on Twitch" : "Twitch"}
              variant="primary"
            />
          )}

          {youtubeAccount?.profile_url && (
            <CreatorLinkButton
              href={youtubeAccount.profile_url}
              label="YouTube"
            />
          )}
        </div>

        {isLive && (
          <div className={classes.liveCard}>
            <img
              src={(stream?.thumbnailUrl ?? "")
                .replace("{width}", "960")
                .replace("{height}", "540")}
              alt=""
              className={classes.liveImg}
              loading="lazy"
            />

            <div className={classes.liveBody}>
              <div className={classes.liveMeta}>
                {stream?.gameName ?? ""}
                <span className={classes.liveDot}> • </span>
                {stream?.viewerCount ?? 0} viewers
              </div>

              {stream?.title && (
                <p className={classes.liveTitle}>{stream.title}</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={classes.listingsSection}>
        <h2 className={classes.h2}>Listings</h2>

        {listings.length === 0 ? (
          <p className={classes.emptyText}>No listings yet.</p>
        ) : (
          <div className={classes.grid}>
            {listings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listing/${listing.id}`}
                className={classes.listingCard}
              >
                {listing.preview_url && (
                  <img src={listing.preview_url} alt="" className={classes.listingImg} />
                )}

                <div className={classes.listingBody}>
                  <div className={classes.listingTitle}>{listing.title}</div>
                  <p className={classes.listingDesc}>
                    {listing.short_description ?? ""}
                  </p>

                  <div className={classes.listingMeta}>
                    <span className={classes.listingMetaLeft}>
                      {listing.offering_type ?? ""}
                    </span>

                    <span className={classes.listingMetaRight}>
                      {listing.category ?? ""}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CreatorProfile;