import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { useMarketListings, type MarketListingItem } from "../hooks/listings/useMarketListings";
import { usePublicCreators, type PublicCreatorItem } from "../hooks/usePublicCreators";
import { useTwitchStreams } from "../hooks/useTwitchStreams";

const classes = {
  page: "space-y-10",

  section: "space-y-3",
  headerRow: "flex items-baseline justify-between gap-4",
  h2: "text-xl font-extrabold tracking-tight",
  linkSubtle: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  cardLg: "card flex flex-col items-center rounded-3xl p-6",
  card: "card p-4",
  cardLink: "card group overflow-hidden",

  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",
  chip: "chip",

  badgeBase: "rounded-full border bg-white px-2 py-0.5 text-xs font-semibold",
  badgeDefault: "border-zinc-200",
  badgeFeatured: "border-amber-200 bg-amber-50 text-amber-800",
  badgeLive: "border-rose-200 bg-rose-50 text-rose-700",

  heroMax: "max-w-3xl",
  heroH1: "text-3xl font-extrabold tracking-tight",
  heroP: "mt-2 text-zinc-600",
  heroActions: "mt-5 flex flex-wrap gap-3",
  heroChips: "mt-6 flex flex-wrap items-center gap-2",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",

  featuredMedia: "relative",
  featuredImg: "h-40 w-full object-cover bg-zinc-100",
  featuredBadges: "absolute left-3 top-3 flex gap-2",

  featuredBody: "p-4",
  featuredTop: "flex items-start justify-between gap-3",
  featuredTitleWrap: "min-w-0",
  featuredTitle: "truncate text-base font-extrabold tracking-tight",
  featuredMeta: "mt-1 text-sm text-zinc-600",
  featuredPrice: "shrink-0 text-sm font-extrabold",
  featuredShort: "mt-2 line-clamp-2 text-sm text-zinc-600",
  featuredBy: "mt-3 text-sm text-zinc-600",
  featuredByName: "font-semibold text-zinc-900",

  liveCardImg: "mb-3 h-40 w-full rounded-2xl object-cover",
  liveRow: "flex flex-wrap items-center gap-2",
  liveTitle: "text-base font-extrabold tracking-tight",
  liveDesc: "mt-2 text-sm text-zinc-600",
  liveMeta: "mt-2 text-xs text-zinc-500",

  liveErrorCard:
    "card border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.20)] p-4",
  liveErrorTitle: "text-sm font-semibold text-zinc-900",
  liveErrorBody: "mt-1 text-sm text-zinc-700",

  loadingText: "text-sm text-zinc-600",
  emptyText: "text-sm text-zinc-600",
} as const;

// Fast lookup map for category labels by key
const categoryLabels = Object.fromEntries(
  CATEGORIES.map((category) => [category.key, category.label])
) as Record<string, string>;

// Converts a category key into its display label
const categoryLabel = (key: string): string => categoryLabels[key] ?? key;

// Converts offering type into a small display pill label
const offeringPill = (offeringType: string): string =>
  offeringType === "digital"
    ? "Digital"
    : offeringType === "commission"
      ? "Commission"
      : offeringType === "service"
        ? "Service"
        : offeringType;

// Formats listing price text for display
const priceText = (item: MarketListingItem["listing"]): string =>
  item.price_type === "fixed"
    ? `$${item.price_min}`
    : item.price_type === "starting_at"
      ? `From $${item.price_min}`
      : item.price_type === "range"
        ? `$${item.price_min}–$${item.price_max ?? item.price_min}`
        : "";

// Builds a badge class string from the chosen badge variant
const getBadgeClassName = (variant: "default" | "featured" | "live"): string =>
  variant === "featured"
    ? `${classes.badgeBase} ${classes.badgeFeatured}`
    : variant === "live"
      ? `${classes.badgeBase} ${classes.badgeLive}`
      : `${classes.badgeBase} ${classes.badgeDefault}`;

type SectionHeaderProps = {
  title: string;
  to: string;
  linkText: string;
};

const SectionHeader = ({ title, to, linkText }: SectionHeaderProps) => (
  <div className={classes.headerRow}>
    <h2 className={classes.h2}>{title}</h2>

    <Link to={to} className={classes.linkSubtle}>
      {linkText}
    </Link>
  </div>
);

const HeroSection = () => (
  <section className={classes.cardLg}>
    <div className={classes.heroMax}>
      <h1 className={classes.heroH1}>
        CreatorHub — assets & services, in one trusted place.
      </h1>

      <p className={classes.heroP}>
        Find emote artists, overlay designers, PNG/VTuber creators, riggers,
        editors, and audio help — with clear categories and “Live now”
        discovery.
      </p>
    </div>

    <div className={classes.heroActions}>
      <Link to="/market" className={classes.btnPrimary}>
        Browse market
      </Link>

      <Link to="/creators" className={classes.btnOutline}>
        Find creators
      </Link>

      <Link to="/live" className={classes.btnOutline}>
        Live now
      </Link>
    </div>

    <div className={classes.heroChips}>
      <Link to="/market?cat=video-editing&video=long-form" className={classes.chip}>
        Long form edits
      </Link>

      <Link to="/market?cat=video-editing&video=short-form" className={classes.chip}>
        Short form edits
      </Link>

      <Link to="/market?cat=vtuber-rigging" className={classes.chip}>
        PNG/VTuber rigging help
      </Link>

      <Link to="/market?cat=audio-tech-help" className={classes.chip}>
        Audio tech help
      </Link>
    </div>
  </section>
);

type FeaturedListingCardProps = {
  item: MarketListingItem;
};

const FeaturedListingCard = ({ item }: FeaturedListingCardProps) => {
  const { listing, creator } = item;

  const videoSuffix =
    listing.category === "video-editing" && listing.video_subtype
      ? ` • ${listing.video_subtype === "long-form" ? "Long Form" : "Short Form"}`
      : "";

  const creatorName = creator?.display_name ?? creator?.handle ?? "Unknown creator";

  return (
    <Link to={`/listing/${listing.id}`} className={classes.cardLink}>
      <div className={classes.featuredMedia}>
        {listing.preview_url ? (
          <img
            src={listing.preview_url}
            alt=""
            className={classes.featuredImg}
            loading="lazy"
          />
        ) : (
          <div className={classes.featuredImg} />
        )}

        <div className={classes.featuredBadges}>
          <span className={getBadgeClassName("default")}>
            {offeringPill(listing.offering_type)}
          </span>

          <span className={getBadgeClassName("featured")}>Featured</span>
        </div>
      </div>

      <div className={classes.featuredBody}>
        <div className={classes.featuredTop}>
          <div className={classes.featuredTitleWrap}>
            <div className={classes.featuredTitle}>{listing.title}</div>

            <div className={classes.featuredMeta}>
              {categoryLabel(listing.category)}
              {videoSuffix}
            </div>
          </div>

          <div className={classes.featuredPrice}>{priceText(listing)}</div>
        </div>

        <p className={classes.featuredShort}>{listing.short}</p>

        <div className={classes.featuredBy}>
          by <span className={classes.featuredByName}>{creatorName}</span>
        </div>
      </div>
    </Link>
  );
};

type FeaturedSectionProps = {
  featuredListings: MarketListingItem[];
  isLoading: boolean;
};

const FeaturedSection = ({ featuredListings, isLoading }: FeaturedSectionProps) => (
  <section className={classes.section}>
    <SectionHeader title="Featured" to="/market" linkText="Browse market →" />

    {isLoading ? (
      <p className={classes.loadingText}>Loading featured listings…</p>
    ) : featuredListings.length === 0 ? (
      <p className={classes.emptyText}>No listings available yet.</p>
    ) : (
      <div className={classes.grid}>
        {featuredListings.map((item) => (
          <FeaturedListingCard key={item.listing.id} item={item} />
        ))}
      </div>
    )}
  </section>
);

type LiveNowItem = {
  creator: PublicCreatorItem["profile"];
  verified: boolean;
  stream: TwitchStream;
};

type LiveCreatorCardProps = LiveNowItem;

const LiveCreatorCard = ({ creator, verified, stream }: LiveCreatorCardProps) => {
  const thumb =
    stream.thumbnailUrl
      ?.replace("{width}", "640")
      .replace("{height}", "360") ?? "";

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      {Boolean(thumb) && (
        <img
          src={thumb}
          alt=""
          className={classes.liveCardImg}
          loading="lazy"
        />
      )}

      <div className={classes.liveRow}>
        <div className={classes.liveTitle}>
          {creator.display_name ?? creator.handle ?? "Creator"}
        </div>

        {verified && (
          <span className={getBadgeClassName("default")}>Verified</span>
        )}

        <span className={getBadgeClassName("live")}>Live</span>
      </div>

      <p className={classes.liveDesc}>{stream.title ?? ""}</p>

      <p className={classes.liveMeta}>
        Twitch • {stream.viewerCount ?? 0} viewers
        {stream.gameName ? ` • ${stream.gameName}` : ""}
      </p>
    </Link>
  );
};

type LiveNowSectionProps = {
  liveNow: LiveNowItem[];
  isFetching: boolean;
  errorMsg: string | null;
};

const LiveNowSection = ({ liveNow, isFetching, errorMsg }: LiveNowSectionProps) => (
  <section className={classes.section}>
    <SectionHeader title="Live now" to="/live" linkText="View all →" />

    {errorMsg && (
      <div className={classes.liveErrorCard}>
        <div className={classes.liveErrorTitle}>Live status unavailable</div>
        <div className={classes.liveErrorBody}>{errorMsg}</div>
      </div>
    )}

    {liveNow.length === 0 ? (
      <p className={classes.emptyText}>
        {isFetching ? "Checking live status…" : "No one is live right now."}
      </p>
    ) : (
      <div className={classes.grid}>
        {liveNow.slice(0, 6).map(({ creator, verified, stream }) => (
          <LiveCreatorCard
            key={creator.user_id}
            creator={creator}
            verified={verified}
            stream={stream}
          />
        ))}
      </div>
    )}
  </section>
);

const Home = () => {
  const { twitchByLogin, isFetching, error } = useTwitchStreams();
  const {
    data: marketItems = [],
    isLoading: isLoadingMarket,
  } = useMarketListings();
  const {
    data: creatorItems = [],
  } = usePublicCreators();

  const errorMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
        ? String(error)
        : null;

  const liveNow = useMemo<LiveNowItem[]>(
    () =>
      creatorItems
        .map((item) => {
          const twitchAccount =
            item.platformAccounts.find((account) => account.platform === "twitch") ?? null;

          const loginRaw = twitchAccount?.platform_login ?? null;
          const login = loginRaw ? normalizeTwitchLogin(loginRaw) : null;
          const stream = login ? twitchByLogin[login] : undefined;

          return stream
            ? {
              creator: item.profile,
              verified: false,
              stream,
            }
            : null;
        })
        .filter((value): value is LiveNowItem => Boolean(value))
        .sort((a, b) => (b.stream.viewerCount ?? 0) - (a.stream.viewerCount ?? 0)),
    [creatorItems, twitchByLogin]
  );

  // Until listings have a dedicated featured flag in the db,
  // use the first public listings returned by the market query.
  const featuredListings = marketItems.slice(0, 6);

  return (
    <div className={classes.page}>
      <HeroSection />
      <FeaturedSection
        featuredListings={featuredListings}
        isLoading={isLoadingMarket}
      />
      <LiveNowSection
        liveNow={liveNow}
        isFetching={isFetching}
        errorMsg={errorMsg}
      />
    </div>
  );
};

export default Home;