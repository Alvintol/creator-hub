import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { creators, type Creator, type PlatformName } from "../data/mock";
import { CATEGORIES, type CategoryKey } from "../domain/catalog";
import { useHubActions, useHubState } from "../providers/HubProvider";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";

type PlatformFilter = "all" | PlatformName;

const REFRESH_MS = 60_000;
const FOCUS_COOLDOWN_MS = 15_000;

const classes = {
  page: "space-y-5",

  headerWrap: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  subtitle: "text-sm text-zinc-600",

  filtersGrid: "grid gap-3 md:grid-cols-3",
  input: "searchInput md:col-span-2",
  select: "searchInput",

  emptyCard: "card p-6",
  emptyTitle: "text-base font-extrabold tracking-tight",
  emptyText: "mt-2 text-sm text-zinc-600",
  emptyActions: "mt-4 flex flex-wrap gap-3",
  btnOutline: "btnOutline",
  btnPrimary: "btnPrimary",

  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  card: "card p-4",

  topRow: "flex flex-wrap items-center gap-2",
  name: "text-base font-extrabold tracking-tight",

  badgeLive: "badge badgeLive",

  title: "mt-2 text-sm text-zinc-600",
  meta: "mt-2 text-xs text-zinc-500",

  specialtiesRow: "mt-3 flex flex-wrap gap-2",
  specPill: "chip px-2 py-0.5 text-xs",
} as const;

const categoryLabel = (key: CategoryKey): string =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

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

const Live = () => {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { streams } = useHubState();
  const { setTwitchStreams } = useHubActions();

  const twitchLogins = useMemo(() => {
    const set = new Set<string>();

    creators.forEach((c) => {
      const login = c.platforms?.twitch?.login;
      if (!login) return;
      set.add(normalizeTwitchLogin(login));
    });

    return Array.from(set).sort();
  }, []);

  useEffect(() => {
    if (twitchLogins.length === 0) return;

    const ctrl = new AbortController();
    const lastRefreshRef = { current: 0 };
    const inFlightRef = { current: false };

    const refresh = async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;
      const now = Date.now();

      if (!force) {
        if (inFlightRef.current) return;
        if (now - lastRefreshRef.current < FOCUS_COOLDOWN_MS) return;
      }

      inFlightRef.current = true;
      lastRefreshRef.current = now;

      try {
        setError(null);
        setLoading(true);

        const url = `/api/twitch/streams?logins=${encodeURIComponent(
          twitchLogins.join(","),
        )}`;

        const r = await fetch(url, { signal: ctrl.signal });
        const json = (await r.json()) as { data: TwitchStream[]; error?: string };

        if (!r.ok) {
          setError(json?.error || "Failed to load Twitch live status.");
          setTwitchStreams({});
          return;
        }

        const map: Record<string, TwitchStream> = {};
        (json.data ?? []).forEach((s) => {
          map[normalizeTwitchLogin(s.login)] = s;
        });

        setTwitchStreams(map);
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === "AbortError") return;
        setError("Failed to load Twitch live status.");
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    };

    refresh({ force: true });

    const intervalId = window.setInterval(() => {
      refresh();
    }, REFRESH_MS);

    const onFocus = () => {
      refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      ctrl.abort();
    };
  }, [twitchLogins, setTwitchStreams]);

  const liveNow = useMemo(() => {
    const s = q.trim().toLowerCase();

    return creators
      .map((c) => {
        const login = c.platforms?.twitch?.login
          ? normalizeTwitchLogin(c.platforms.twitch.login)
          : undefined;

        const stream = login ? streams.twitchByLogin[login] : undefined;

        return { creator: c, stream };
      })
      .filter(({ stream }) => !!stream)
      .filter(() => (platform === "all" ? true : platform === "twitch"))
      .filter(({ creator, stream }) =>
        s ? getSearchHaystack(creator, stream).includes(s) : true,
      );
  }, [q, platform, streams.twitchByLogin]);

  const onPlatformChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setPlatform(e.currentTarget.value as PlatformFilter);

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Live now</h1>
        <p className={classes.subtitle}>
          Real-time Twitch live status. {loading ? "Refreshing…" : ""}
        </p>
      </div>

      <div className={classes.filtersGrid}>
        <input
          className={classes.input}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search live creators (name, tags, title, specialties...)"
        />

        <select className={classes.select} value={platform} onChange={onPlatformChange}>
          <option value="all">All platforms</option>
          <option value="twitch">Twitch</option>
          <option value="youtube" disabled>
            YouTube (next)
          </option>
        </select>
      </div>

      {error && (
        <div className="card p-4 border border-[rgb(var(--ink)/0.18)] bg-[rgb(var(--accent)/0.20)]">
          <div className="text-sm font-semibold text-zinc-900">Live status unavailable</div>
          <div className="mt-1 text-sm text-zinc-700">{error}</div>
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
              stream?.thumbnailUrl?.replace("{width}", "640").replace("{height}", "360") ??
              "";

            return (
              <Link key={creator.handle} to={`/creator/${creator.handle}`} className={classes.card}>
                {!!thumb && (
                  <img
                    src={thumb}
                    alt=""
                    className="mb-3 h-40 w-full rounded-2xl object-cover"
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

                {!!creator.specialties?.length && (
                  <div className={classes.specialtiesRow}>
                    {creator.specialties.slice(0, 4).map((k) => (
                      <span key={k} className={classes.specPill}>
                        {categoryLabel(k)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Live;