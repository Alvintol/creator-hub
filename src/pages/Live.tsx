import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { creators, type Creator, type PlatformName } from "../data/mock";
import { CATEGORIES, type CategoryKey } from "../domain/catalog";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { useTwitchStreams } from "../hooks/useTwitchStreams";

type PlatformFilter = "all" | PlatformName;

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
const categoryLabel = (key: CategoryKey): string =>
  CATEGORIES.find((category) => category.key === key)?.label ?? key;

// Builds a search haystack for live creator filtering
const getSearchHaystack = (creator: Creator, stream?: TwitchStream): string =>
  [
    creator.displayName,
    creator.handle,
    creator.bio,
    ...(creator.tags ?? []),
    ...(creator.specialties ?? []).map(categoryLabel),
    stream?.title ?? "",
    stream?.gameName ?? "",
  ]
    .join(" ")
    .toLowerCase();

// Builds a Twitch watch URL when possible
const getTwitchWatchUrl = (creator: Creator): string =>
  creator.links?.twitch ??
  (creator.platforms?.twitch?.login
    ? `https://twitch.tv/${encodeURIComponent(
      normalizeTwitchLogin(creator.platforms.twitch.login)
    )}`
    : "#");

// Checks whether a creator has enough Twitch data for a live watch link
const canWatchTwitchLive = (creator: Creator): boolean =>
  Boolean(creator.links?.twitch || creator.platforms?.twitch?.login);

const Live = () => {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const { twitchByLogin, isFetching, error } = useTwitchStreams();

  const liveNow = useMemo(() => {
    const searchValue = q.trim().toLowerCase();

    return creators
      .map((creator) => {
        const loginRaw = creator.platforms?.twitch?.login;
        const login = loginRaw ? normalizeTwitchLogin(loginRaw) : undefined;
        const stream = login ? twitchByLogin[login] : undefined;

        return { creator, stream };
      })
      .filter(({ stream }) => Boolean(stream))
      .filter(() => platform === "all" || platform === "twitch")
      .filter(({ creator, stream }) =>
        searchValue ? getSearchHaystack(creator, stream).includes(searchValue) : true
      );
  }, [q, platform, twitchByLogin]);

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
            Add creator.platforms.twitch.login values and/or wait until they go live.
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
          {liveNow.map(({ creator, stream }) => {
            const thumb =
              stream?.thumbnailUrl
                ?.replace("{width}", "640")
                .replace("{height}", "360") ?? "";

            return (
              <div key={creator.id} className={classes.card}>
                <Link to={`/creator/${creator.handle}`} className={classes.cardLink}>
                  {Boolean(thumb) && (
                    <img
                      src={thumb}
                      alt=""
                      className={classes.thumb}
                      loading="lazy"
                    />
                  )}

                  <div className={classes.topRow}>
                    <div className={classes.name}>{creator.displayName}</div>
                    <span className={classes.badgeLive}>Live</span>
                  </div>

                  <p className={classes.title}>{stream?.title ?? ""}</p>

                  <p className={classes.meta}>
                    {stream?.gameName ?? ""} • {stream?.viewerCount ?? 0} viewers
                  </p>

                  {Boolean(creator.specialties?.length) && (
                    <div className={classes.specialtiesRow}>
                      {creator.specialties?.slice(0, 4).map((specialty) => (
                        <span key={specialty} className={classes.specPill}>
                          {categoryLabel(specialty)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className={classes.actionsRow}>
                  <Link to={`/creator/${creator.handle}`} className={classes.btnOutline}>
                    View profile
                  </Link>

                  <a
                    className={classes.btnPrimary}
                    href={getTwitchWatchUrl(creator)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Watch ${creator.displayName} live on Twitch`}
                    onClick={(event) => {
                      if (!canWatchTwitchLive(creator)) {
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