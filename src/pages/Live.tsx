import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES, type CategoryKey } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { usePublicCreators, type PublicCreatorItem } from "../hooks/usePublicCreators";
import { useTwitchStreams } from "../hooks/useTwitchStreams";

type PlatformFilter = "all" | "twitch" | "youtube";

const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-2",
  select: "searchInput",

  errorCard:
    "card border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.20)] p-4",
  errorTitle: "text-sm font-semibold text-zinc-900",
  errorText: "mt-1 text-sm text-zinc-700",

  emptyCard: "card p-6",
  emptyTitle: "text-base font-extrabold tracking-tight",
  emptyText: "mt-2 text-sm text-zinc-600",
  emptyActions: "mt-4 flex flex-wrap gap-3",
  btnOutline: "btnOutline",
  btnPrimary: "btnPrimary",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  card: "card p-4",
  cardLink: "block",

  thumb: "mb-3 h-40 w-full rounded-2xl object-cover",
  topRow: "flex flex-wrap items-center gap-2",
  name: "text-base font-extrabold tracking-tight",
  badgeLive: "badge badgeLive",

  title: "mt-2 text-sm text-zinc-600",
  meta: "mt-2 text-xs text-zinc-500",

  specialtiesRow: "mt-3 flex flex-wrap gap-2",
  specPill: "chip px-2 py-0.5 text-xs",

  actionsRow: "mt-4 flex flex-wrap gap-2",
} as const;

// Converts a category key into its display label
const categoryLabel = (key: string): string =>
  CATEGORIES.find((category) => category.key === key)?.label ?? key;

const getCreatorName = (item: PublicCreatorItem): string =>
  item.profile.display_name ?? item.profile.handle ?? "Creator";

const getCreatorHandle = (item: PublicCreatorItem): string =>
  item.profile.handle ?? "";

const getCreatorSpecialties = (item: PublicCreatorItem): string[] =>
  Array.from(new Set(item.listings.map((listing) => listing.category).filter(Boolean)));

const getCreatorTags = (item: PublicCreatorItem): string[] =>
  Array.from(new Set(item.listings.flatMap((listing) => listing.tags ?? []).filter(Boolean)));

const getTwitchAccount = (item: PublicCreatorItem) =>
  item.platformAccounts.find((account) => account.platform === "twitch") ?? null;

// Builds a search haystack for live creator filtering
const getSearchHaystack = (
  item: PublicCreatorItem,
  stream?: TwitchStream
): string =>
  [
    getCreatorName(item),
    getCreatorHandle(item),
    item.profile.bio ?? "",
    ...getCreatorTags(item),
    ...getCreatorSpecialties(item).map(categoryLabel),
    stream?.title ?? "",
    stream?.gameName ?? "",
  ]
    .join(" ")
    .toLowerCase();

// Builds a Twitch watch URL when possible
const getTwitchWatchUrl = (item: PublicCreatorItem): string => {
  const twitchAccount = getTwitchAccount(item);

  return (
    twitchAccount?.profile_url ??
    (twitchAccount?.platform_login
      ? `https://twitch.tv/${encodeURIComponent(
        normalizeTwitchLogin(twitchAccount.platform_login)
      )}`
      : "#")
  );
};

// Checks whether a creator has enough Twitch data for a live watch link
const canWatchTwitchLive = (item: PublicCreatorItem): boolean => {
  const twitchAccount = getTwitchAccount(item);

  return Boolean(twitchAccount?.profile_url || twitchAccount?.platform_login);
};

type LiveNowItem = {
  item: PublicCreatorItem;
  stream: TwitchStream;
};

const Live = () => {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const { twitchByLogin, isFetching, error } = useTwitchStreams();
  const { data: creatorItems = [] } = usePublicCreators();

  const liveNow = useMemo(() => {
    const searchValue = q.trim().toLowerCase();

    return creatorItems
      .map((item) => {
        const twitchAccount = getTwitchAccount(item);
        const loginRaw = twitchAccount?.platform_login ?? null;
        const login = loginRaw ? normalizeTwitchLogin(loginRaw) : undefined;
        const stream = login ? twitchByLogin[login] : undefined;

        return stream ? { item, stream } : null;
      })
      .filter((value): value is LiveNowItem => Boolean(value))
      .filter(() => platform === "all" || platform === "twitch")
      .filter(({ item, stream }) =>
        searchValue ? getSearchHaystack(item, stream).includes(searchValue) : true
      )
      .sort((a, b) => (b.stream.viewerCount ?? 0) - (a.stream.viewerCount ?? 0));
  }, [creatorItems, platform, q, twitchByLogin]);

  const onPlatformChange = (event: ChangeEvent<HTMLSelectElement>) =>
    setPlatform(event.currentTarget.value as PlatformFilter);

  const errorMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
        ? String(error)
        : null;

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Live now</h1>

        <p className={classes.subtitle}>
          Real-time Twitch live status. {isFetching ? "Refreshing…" : ""}
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={q}
          onChange={(event) => setQ(event.currentTarget.value)}
          placeholder="Search live creators (name, tags, title, specialties...)"
        />

        <select
          className={classes.select}
          value={platform}
          onChange={onPlatformChange}
        >
          <option value="all">All platforms</option>
          <option value="twitch">Twitch</option>
          <option value="youtube" disabled>
            YouTube (next)
          </option>
        </select>
      </div>

      {errorMsg && (
        <div className={classes.errorCard}>
          <div className={classes.errorTitle}>Live status unavailable</div>
          <div className={classes.errorText}>{errorMsg}</div>
        </div>
      )}

      {liveNow.length === 0 ? (
        <div className={classes.emptyCard}>
          <div className={classes.emptyTitle}>No one is live right now</div>

          <p className={classes.emptyText}>
            No linked Twitch creators are live at the moment.
          </p>

          <div className={classes.emptyActions}>
            <Link to="/creators" className={classes.btnOutline}>
              Browse creators
            </Link>

            <Link to="/market" className={classes.btnPrimary}>
              Browse market
            </Link>
          </div>
        </div>
      ) : (
        <div className={classes.grid}>
          {liveNow.map(({ item, stream }) => {
            const thumb =
              stream.thumbnailUrl
                ?.replace("{width}", "640")
                .replace("{height}", "360") ?? "";

            const creatorName = getCreatorName(item);
            const creatorHandle = getCreatorHandle(item);
            const specialties = getCreatorSpecialties(item);

            return (
              <div key={item.profile.user_id} className={classes.card}>
                <Link to={`/creator/${creatorHandle}`} className={classes.cardLink}>
                  {Boolean(thumb) && (
                    <img
                      src={thumb}
                      alt=""
                      className={classes.thumb}
                      loading="lazy"
                    />
                  )}

                  <div className={classes.topRow}>
                    <div className={classes.name}>{creatorName}</div>
                    <span className={classes.badgeLive}>Live</span>
                  </div>

                  <p className={classes.title}>{stream.title ?? ""}</p>

                  <p className={classes.meta}>
                    {stream.gameName ?? ""} • {stream.viewerCount ?? 0} viewers
                  </p>

                  {specialties.length > 0 && (
                    <div className={classes.specialtiesRow}>
                      {specialties.slice(0, 4).map((specialty) => (
                        <span key={specialty} className={classes.specPill}>
                          {categoryLabel(specialty)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className={classes.actionsRow}>
                  <Link to={`/creator/${creatorHandle}`} className={classes.btnOutline}>
                    View profile
                  </Link>

                  <a
                    className={classes.btnPrimary}
                    href={getTwitchWatchUrl(item)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Watch ${creatorName} live on Twitch`}
                    onClick={(event) => {
                      if (!canWatchTwitchLive(item)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Watch live
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Live;