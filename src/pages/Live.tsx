import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { creators, type Creator, type Platform } from "../data/mock";
import { CATEGORIES, CategoryKey } from "../domain/catalog";

type PlatformFilter = "all" | Platform;

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

  badgeBase: "rounded-full border bg-white px-2 py-0.5 text-xs font-semibold",
  badgeDefault: "border-zinc-200",
  badgeLive: "border-[rgb(var(--ink)/0.22)] bg-[rgb(var(--brand)/0.26)] text-zinc-900",
  badgePlatform: "border-[rgb(var(--ink)/0.18)] text-zinc-700",

  title: "mt-2 text-sm text-zinc-600",

  specialtiesRow: "mt-3 flex flex-wrap gap-2",
  specPill: "chip px-2 py-0.5 text-xs",
} as const;

const categoryLabel = (key: CategoryKey): string => {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

const getLiveSearchHaystack = (c: Creator): string => {
  return [
    c.displayName,
    c.handle,
    c.bio,
    ...(c.tags ?? []),
    ...(c.specialties ?? []).map(categoryLabel),
    c.live?.title ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

const sortVerifiedFirst = (a: Creator, b: Creator): number => {
  if (a.verified === b.verified) return 0;
  return a.verified ? -1 : 1;
}

const getBadgeClassName = (variant: "default" | "live" | "platform"): string => {
  if (variant === "live") return `${classes.badgeBase} ${classes.badgeLive}`;
  if (variant === "platform") return `${classes.badgeBase} ${classes.badgePlatform}`;
  return `${classes.badgeBase} ${classes.badgeDefault}`;
}

const Live = () => {
  const [q, setQ] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const liveNow = useMemo<Creator[]>(() => {
    const s = q.trim().toLowerCase();

    return creators
      .filter((c) => !!c.live?.isLive)
      .filter((c) => (platform === "all" ? true : c.live?.platform === platform))
      .filter((c) => (s ? getLiveSearchHaystack(c).includes(s) : true))
      .sort(sortVerifiedFirst);
  }, [q, platform]);

  const onPlatformChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setPlatform(e.currentTarget.value as PlatformFilter);
  }

  return (
    <div className={classes.page}>
      <div className={classes.headerWrap}>
        <h1 className={classes.h1}>Live now</h1>
        <p className={classes.subtitle}>
          Creators currently live on their channels. (Mock data for now.)
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
          <option value="youtube">YouTube</option>
        </select>
      </div>

      {liveNow.length === 0 ? (
        <div className={classes.emptyCard}>
          <div className={classes.emptyTitle}>No one is live right now</div>
          <p className={classes.emptyText}>
            Once Twitch/YouTube integrations are added, this will update in real time.
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
          {liveNow.map((c) => (
            <Link key={c.handle} to={`/creator/${c.handle}`} className={classes.card}>
              <div className={classes.topRow}>
                <div className={classes.name}>{c.displayName}</div>

                {c.verified && (
                  <span className={getBadgeClassName("default")}>Verified</span>
                )}

                <span className={getBadgeClassName("live")}>Live</span>

                {!!c.live?.platform && (
                  <span className={getBadgeClassName("platform")}>{c.live.platform}</span>
                )}
              </div>

              <p className={classes.title}>{c.live?.title ?? ""}</p>

              {!!c.specialties?.length && (
                <div className={classes.specialtiesRow}>
                  {c.specialties.slice(0, 4).map((k) => (
                    <span key={k} className={classes.specPill}>
                      {categoryLabel(k)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Live;