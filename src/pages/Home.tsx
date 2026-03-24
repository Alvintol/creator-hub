import { useMemo } from "react";
import { Link } from "react-router-dom";
import { creators, listings, type Creator, type Listing } from "../data/mock";
import { CATEGORIES } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
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
  featuredImg: "h-40 w-full object-cover",
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

  liveRow: "flex flex-wrap items-center gap-2",
  liveTitle: "text-base font-extrabold tracking-tight",
  liveDesc: "mt-2 text-sm text-zinc-600",
  liveMeta: "mt-2 text-xs text-zinc-500",

  emptyText: "text-sm text-zinc-600",
} as const;

const categoryLabel = (key: string): string => {
  return CATEGORIES.find((c: any) => c.key === key)?.label ?? key;
};

const offeringPill = (offeringType: Listing["offeringType"]): string => {
  if (offeringType === "digital") return "Digital";
  if (offeringType === "commission") return "Commission";
  if (offeringType === "service") return "Service";
  return String(offeringType ?? "");
};

const priceText = (l: Listing): string => {
  if (l.priceType === "fixed") return `$${l.priceMin}`;
  if (l.priceType === "starting_at") return `From $${l.priceMin}`;
  if (l.priceType === "range") return `$${l.priceMin}–$${l.priceMax ?? l.priceMin}`;
  return "";
};

const getBadgeClassName = (variant: "default" | "featured" | "live"): string => {
  if (variant === "featured") return `${classes.badgeBase} ${classes.badgeFeatured}`;
  if (variant === "live") return `${classes.badgeBase} ${classes.badgeLive}`;
  return `${classes.badgeBase} ${classes.badgeDefault}`;
};

const byHandle = Object.fromEntries(creators.map((c) => [c.handle, c])) as Record<string, Creator>;

type SectionHeaderProps = { title: string; to: string; linkText: string };

const SectionHeader = (props: SectionHeaderProps) => {
  const { title, to, linkText } = props;

  return (
    <div className={classes.headerRow}>
      <h2 className={classes.h2}>{title}</h2>
      <Link to={to} className={classes.linkSubtle}>
        {linkText}
      </Link>
    </div>
  );
};

const HeroSection = () => {
  return (
    <section className={classes.cardLg}>
      <div className={classes.heroMax}>
        <h1 className={classes.heroH1}>CreatorHub — assets & services, in one trusted place.</h1>
        <p className={classes.heroP}>
          Find emote artists, overlay designers, PNG/VTuber creators, riggers, editors, and audio help —
          with clear categories and “Live now” discovery.
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
};

type FeaturedListingCardProps = { listing: Listing };

const FeaturedListingCard = (props: FeaturedListingCardProps) => {
  const { listing } = props;
  const c = byHandle[listing.creatorHandle];

  const videoSuffix =
    listing.category === "video-editing" && listing.videoSubtype
      ? ` • ${listing.videoSubtype === "long-form" ? "Long Form" : "Short Form"}`
      : "";

  return (
    <Link to={`/listing/${listing.id}`} className={classes.cardLink}>
      <div className={classes.featuredMedia}>
        <img src={listing.preview} alt="" className={classes.featuredImg} loading="lazy" />

        <div className={classes.featuredBadges}>
          <span className={getBadgeClassName("default")}>{offeringPill(listing.offeringType)}</span>
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
          by <span className={classes.featuredByName}>{c?.displayName ?? listing.creatorHandle}</span>
        </div>
      </div>
    </Link>
  );
};

type FeaturedSectionProps = { featuredListings: Listing[] };

const FeaturedSection = (props: FeaturedSectionProps) => {
  const { featuredListings } = props;

  return (
    <section className={classes.section}>
      <SectionHeader title="Featured" to="/market" linkText="Browse market →" />

      <div className={classes.grid}>
        {featuredListings.map((l) => (
          <FeaturedListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
};

type LiveNowItem = { creator: Creator; stream: TwitchStream };

type LiveCreatorCardProps = LiveNowItem;

const LiveCreatorCard = (props: LiveCreatorCardProps) => {
  const { creator, stream } = props;

  const thumb =
    stream.thumbnailUrl
      ?.replace("{width}", "640")
      .replace("{height}", "360") ?? "";

  return (
    <Link to={`/creator/${creator.handle}`} className={classes.card}>
      {!!thumb && (
        <img
          src={thumb}
          alt=""
          className="mb-3 h-40 w-full rounded-2xl object-cover"
          loading="lazy"
        />
      )}

      <div className={classes.liveRow}>
        <div className={classes.liveTitle}>{creator.displayName}</div>

        {!!creator.verified && <span className={getBadgeClassName("default")}>Verified</span>}
        <span className={getBadgeClassName("live")}>Live</span>
      </div>

      <p className={classes.liveDesc}>{stream.title ?? ""}</p>

      <p className={classes.liveMeta}>
        Twitch • {stream.viewerCount ?? 0} viewers{stream.gameName ? ` • ${stream.gameName}` : ""}
      </p>
    </Link>
  );
};

type LiveNowSectionProps = {
  liveNow: LiveNowItem[];
  isFetching: boolean;
  errorMsg: string | null;
};

const LiveNowSection = (props: LiveNowSectionProps) => {
  const { liveNow, isFetching, errorMsg } = props;

  return (
    <section className={classes.section}>
      <SectionHeader title="Live now" to="/live" linkText="View all →" />

      {errorMsg && (
        <div className="card p-4 border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.20)]">
          <div className="text-sm font-semibold text-zinc-900">Live status unavailable</div>
          <div className="mt-1 text-sm text-zinc-700">{errorMsg}</div>
        </div>
      )}

      {liveNow.length === 0 ? (
        <p className={classes.emptyText}>
          {isFetching ? "Checking live status…" : "No one is live right now."}
        </p>
      ) : (
        <div className={classes.grid}>
          {liveNow.slice(0, 6).map(({ creator, stream }) => (
            <LiveCreatorCard key={creator.handle} creator={creator} stream={stream} />
          ))}
        </div>
      )}
    </section>
  );
};

const Home = () => {
  const { twitchByLogin, isFetching, error } = useTwitchStreams();

  const errorMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
        ? String(error)
        : null;

  const liveNow = useMemo<LiveNowItem[]>(() => {
    return creators
      .map((creator) => {
        const loginRaw = creator.platforms?.twitch?.login;
        const login = loginRaw ? normalizeTwitchLogin(loginRaw) : null;
        const stream = login ? twitchByLogin[login] : undefined;
        return stream ? { creator, stream } : null;
      })
      .filter((v): v is LiveNowItem => !!v)
      .sort((a, b) => (b.stream.viewerCount ?? 0) - (a.stream.viewerCount ?? 0));
  }, [twitchByLogin]);

  const featured = listings.filter((l) => !!l.featured);
  const featuredListings = featured.length ? featured.slice(0, 6) : listings.slice(0, 6);

  return (
    <div className={classes.page}>
      <HeroSection />
      <FeaturedSection featuredListings={featuredListings} />
      <LiveNowSection liveNow={liveNow} isFetching={isFetching} errorMsg={errorMsg} />
    </div>
  );
};

export default Home;