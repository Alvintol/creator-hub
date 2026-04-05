import { Link, useParams } from "react-router-dom";
import { normalizeTwitchLogin } from "../domain/twitch";
import { usePublicCreatorProfile } from "../hooks/usePublicCreatorProfile";
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

  badgeLive: "badge badgeLive",

  linksRow: "mt-4 flex flex-wrap gap-2",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  listingsSection: "space-y-3",
  emptyText: "text-sm text-zinc-600",
  loadingText: "text-sm text-zinc-600",
  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",

  listingCard: "card overflow-hidden",
  listingImg: "h-40 w-full object-cover bg-zinc-100",
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

  platformSection: "mt-6 space-y-3",
  platformSectionTitle: "text-sm font-extrabold text-zinc-900",
  platformList: "space-y-2",
  platformItem:
    "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3",
  platformItemLeft: "space-y-1",
  platformItemTitle: "text-sm font-semibold text-zinc-900",
  platformItemValue: "text-sm text-zinc-600",
  platformItemLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",
  platformBtnBase:
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-[1px]",
  platformBtnTwitch:
    "border-[#9146FF] bg-[#9146FF] text-white hover:brightness-110 hover:shadow-[0_8px_22px_rgba(145,70,255,0.30)]",
  platformBtnYouTube:
    "border-[#FF0000] bg-[#FF0000] text-white hover:brightness-105 hover:shadow-[0_8px_22px_rgba(255,0,0,0.24)]",
  platformBtnGeneric:
    "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:border-zinc-400",
  platformBtnIcon: "h-4 w-4 shrink-0",
} as const;

type CreatorLinkButtonProps = {
  href: string;
  label: string;
  platform?: "twitch" | "youtube" | "generic";
};

const TwitchLogo = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={classes.platformBtnIcon}
    fill="currentColor"
  >
    <path d="M4 3h16v11l-4 4h-4l-2 2H7v-2H4V3Zm14 10V5H6v11h3v2l2-2h4l3-3Z" />
    <path d="M10 8h2v5h-2V8Zm5 0h2v5h-2V8Z" />
  </svg>
);

const YouTubeLogo = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={classes.platformBtnIcon}
    fill="currentColor"
  >
    <path d="M23 12.001s0-3.068-.389-4.548a2.965 2.965 0 0 0-2.084-2.1C18.691 4.85 12 4.85 12 4.85s-6.691 0-8.527.503a2.965 2.965 0 0 0-2.084 2.1C1 8.933 1 12.001 1 12.001s0 3.068.389 4.548a2.965 2.965 0 0 0 2.084 2.1c1.836.503 8.527.503 8.527.503s6.691 0 8.527-.503a2.965 2.965 0 0 0 2.084-2.1c.389-1.48.389-4.548.389-4.548ZM10 15.5v-7l6 3.5-6 3.5Z" />
  </svg>
);

const getPlatformButtonClass = (
  platform: CreatorLinkButtonProps["platform"]
): string =>
  platform === "twitch"
    ? `${classes.platformBtnBase} ${classes.platformBtnTwitch}`
    : platform === "youtube"
      ? `${classes.platformBtnBase} ${classes.platformBtnYouTube}`
      : `${classes.platformBtnBase} ${classes.platformBtnGeneric}`;

const CreatorLinkButton = ({
  href,
  label,
  platform = "generic",
}: CreatorLinkButtonProps) => (
  <a
    className={getPlatformButtonClass(platform)}
    target="_blank"
    rel="noreferrer"
    href={href}
  >
    {platform === "twitch" && <TwitchLogo />}
    {platform === "youtube" && <YouTubeLogo />}
    <span>{label}</span>
  </a>
);

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

  const { data, isLoading, error } = usePublicCreatorProfile(handle ?? null);

  if (!handle) return <CreatorNotFound />;

  if (isLoading) {
    return (
      <div className={classes.container}>
        <div className={classes.loadingText}>Loading…</div>
      </div>
    );
  }

  if (error || !data?.profile) return <CreatorNotFound />;

  const { profile, platformAccounts, listings } = data;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const youtubeAccount =
    platformAccounts.find((account) => account.platform === "youtube") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw
    ? normalizeTwitchLogin(twitchLoginRaw)
    : null;

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
            {profile.display_name ?? profile.handle ?? "Creator"}
          </h1>

          {isLive && <span className={classes.badgeLive}>Live</span>}
        </div>

        {profile.bio && <p className={classes.bio}>{profile.bio}</p>}

        <div className={classes.linksRow}>
          {watchUrl && (
            <CreatorLinkButton
              href={watchUrl}
              label={isLive ? "Watch live on Twitch" : "Twitch"}
              platform="twitch"
            />
          )}

          {youtubeAccount?.profile_url && (
            <CreatorLinkButton
              href={youtubeAccount.profile_url}
              label="YouTube"
              platform="youtube"
            />
          )}
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
                {listing.preview_url ? (
                  <img
                    src={listing.preview_url}
                    alt=""
                    className={classes.listingImg}
                    loading="lazy"
                  />
                ) : (
                  <div className={classes.listingImg} />
                )}

                <div className={classes.listingBody}>
                  <div className={classes.listingTitle}>{listing.title}</div>
                  <p className={classes.listingDesc}>{listing.short}</p>

                  <div className={classes.listingMeta}>
                    <span className={classes.listingMetaLeft}>
                      {listing.offering_type}
                    </span>

                    <span className={classes.listingMetaRight}>
                      {listing.category}
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