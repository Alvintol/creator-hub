import { Link, useParams } from "react-router-dom";
import { creators, listings, type Creator, type Listing } from "../data/mock";
import { normalizeTwitchLogin } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";

const classes = {
  container: "space-y-8",

  backLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  notFoundWrap: "space-y-4",
  h1: "text-2xl font-extrabold tracking-tight",
  h2: "text-xl font-extrabold tracking-tight",

  card: "card p-6",

  titleRow: "flex flex-wrap items-center gap-2",
  bio: "mt-2 text-zinc-600",

  badgeBase: "badge",
  badgeVerified: "badge",
  badgeLive: "badge badgeLive",

  linksRow: "mt-4 flex flex-wrap gap-2",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  liveLine: "mt-4 text-sm text-zinc-600",
  liveLabel: "font-semibold",

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
} as const;

const getCreatorByHandle = (handle: string): Creator | undefined => {
  return creators.find((c) => c.handle === handle);
};

const getListingsByCreatorHandle = (handle: string): Listing[] => {
  return listings.filter((l) => l.creatorHandle === handle);
};

type CreatorLinkButtonProps = {
  href: string;
  label: string;
  variant?: "primary" | "outline";
};

const CreatorLinkButton = (props: CreatorLinkButtonProps) => {
  const { href, label, variant = "outline" } = props;
  const className = variant === "primary" ? classes.btnPrimary : classes.btnOutline;

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

const CreatorNotFound = () => {
  return (
    <div className={classes.notFoundWrap}>
      <h1 className={classes.h1}>Creator not found</h1>
      <Link to="/creators" className={classes.btnOutline}>
        Back to creators
      </Link>
    </div>
  );
};

const CreatorProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const { twitchByLogin } = useTwitchStreams();

  if (!handle) return <CreatorNotFound />;

  const creator = getCreatorByHandle(handle);
  if (!creator) return <CreatorNotFound />;

  const creatorListings = getListingsByCreatorHandle(handle);

  const twitchLoginRaw = creator.platforms?.twitch?.login;
  const twitchLogin = twitchLoginRaw ? normalizeTwitchLogin(twitchLoginRaw) : null;
  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = !!stream;

  const watchUrl =
    creator.links?.twitch ??
    (twitchLogin ? `https://twitch.tv/${encodeURIComponent(twitchLogin)}` : undefined);

  return (
    <div className={classes.container}>
      <Link to="/creators" className={classes.backLink}>
        ← Back
      </Link>

      <section className={classes.card}>
        <div className={classes.titleRow}>
          <h1 className={classes.h1}>{creator.displayName}</h1>

          {!!creator.verified && <span className={classes.badgeVerified}>Verified</span>}

          {isLive && <span className={classes.badgeLive}>Live</span>}
        </div>

        <p className={classes.bio}>{creator.bio}</p>

        <div className={classes.linksRow}>
          {watchUrl && (
            <CreatorLinkButton
              href={watchUrl}
              label={isLive ? "Watch live on Twitch" : "Twitch"}
              variant="primary"
            />
          )}

          {creator.links?.youtube && (
            <CreatorLinkButton href={creator.links.youtube} label="YouTube" />
          )}
          {creator.links?.discord && (
            <CreatorLinkButton href={creator.links.discord} label="Discord" />
          )}
          {creator.links?.website && (
            <CreatorLinkButton href={creator.links.website} label="Website" />
          )}
        </div>

        {isLive && (
          <p className={classes.liveLine}>
            <span className={classes.liveLabel}>Live:</span> {stream?.title ?? ""}{" "}
            <span className="text-zinc-400">•</span> {stream?.gameName ?? ""}{" "}
            <span className="text-zinc-400">•</span> {stream?.viewerCount ?? 0} viewers
          </p>
        )}
      </section>

      <section className={classes.listingsSection}>
        <h2 className={classes.h2}>Listings</h2>

        {creatorListings.length === 0 ? (
          <p className={classes.emptyText}>No listings yet.</p>
        ) : (
          <div className={classes.grid}>
            {creatorListings.map((l) => (
              <CreatorListingLink key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CreatorProfile;