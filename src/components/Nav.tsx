import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useMemo, useState } from "react";
import { CATEGORIES } from "../domain/catalog";
import { useTwitchStreams } from "../hooks/useTwitchStreams";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

type CategoryLink = { key: string; label: string };

const brand = {
  markSrc: "/logo-mark.png",
  alt: "CreatorHub",
} as const;

const classes = {
  header: "topbar",

  topRow: "mx-auto flex max-w-6xl items-center gap-3 px-4 py-2",
  brandLink: "shrink-0 text-lg font-black tracking-tight",
  brandAccent: "text-[rgb(var(--brand))]",

  form: "flex w-full items-center gap-2",
  searchInput: "searchInput",
  searchButton: "btnPrimary hidden sm:inline-flex",

  nav: "hidden md:flex items-center gap-1",
  navLinkBase: "text-sm font-semibold",
  navLinkActive: "text-zinc-900",
  navLinkInactive: "text-zinc-700 hover:text-zinc-900",

  subbar: "subbar",
  subbarRow:
    "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2",
  statement: "text-xs font-semibold text-zinc-800",
  aboutLink: "linkPill",

  categoryWrap: "categoryBar",
  categoryInner: "categoryBarInner",
  categoryRow: "categoryRow",
  categoryTitle: "categoryTitle",

  chip: "navChip whitespace-nowrap",
  chipActive: "navChip navChipActive whitespace-nowrap",
} as const;

const getMarketUrl = (q: string) => {
  const s = q.trim();
  return s ? `/market?q=${encodeURIComponent(s)}` : "/market";
};

const Nav = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState("");

  const { twitchByLogin, isFetching } = useTwitchStreams();

  const { user, loading } = useAuth();

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  const liveCount = useMemo(() => {
    return Object.keys(twitchByLogin).length;
  }, [twitchByLogin]);

  const activeCat = useMemo(() => {
    const p = new URLSearchParams(search);
    return p.get("cat") ?? "";
  }, [search]);

  const pillClass = (isActive: boolean) => {
    return `navPill ${isActive ? "navPillActive" : ""}`.trim();
  };

  const livePillClass = (isActive: boolean) => {
    if (isActive) return "navPill navPillActive";
    return `navPill ${liveCount > 0 ? "navPillHot" : ""}`.trim();
  };

  const categoryLinks = useMemo<CategoryLink[]>(
    () => CATEGORIES.map((c: any) => ({ key: String(c.key), label: String(c.label) })),
    []
  );

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    navigate(getMarketUrl(q));
  };

  const chipClass = (key: string | null) => {
    const isAll = key === null;
    const isActive = isAll ? !activeCat : activeCat === key;
    return isActive ? classes.chipActive : classes.chip;
  };

  return (
    <header className={classes.header}>
      <div className={classes.topRow}>
        <Link to="/" className={classes.brandLink}>
          <span className="inline-flex items-center gap-2">
            <img
              src={brand.markSrc}
              alt={brand.alt}
              className="h-8 w-8 shrink-0"
              draggable={false}
            />
            <span className="text-lg font-black tracking-tight">
              <span className={classes.brandAccent}>Creator</span>Hub
            </span>
          </span>
        </Link>

        <form className={classes.form} onSubmit={onSubmit}>
          <input
            className={classes.searchInput}
            aria-label="Search marketplace"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search emotes, overlays, VTuber models, editors, riggers…"
          />
          <button type="submit" className={classes.searchButton}>
            Search
          </button>
        </form>

        <nav className={classes.nav}>
          <NavLink to="/market" className={({ isActive }) => pillClass(isActive)}>
            Market
          </NavLink>

          <NavLink to="/creators" className={({ isActive }) => pillClass(isActive)}>
            Creators
          </NavLink>

          <NavLink to="/live" className={({ isActive }) => livePillClass(isActive)}>
            <span className="inline-flex items-center gap-2">
              <span>Live</span>

              {liveCount > 0 && <span className="navPillCount">{liveCount}</span>}

              {isFetching && <span className="navPillDot animate-pulse" />}
            </span>
          </NavLink>
          {!loading && user && (
            <NavLink
              to="/settings/profile"
              className={({ isActive }) =>
                `navPill ${isActive ? "navPillActive" : "navPillIdle"}`
              }
            >
              Settings
            </NavLink>
          )}
          {!loading && !user && (
            <NavLink to="/signin" className={({ isActive }) => (isActive ? "navPill navPillActive px-3 py-1" : "navPill navPillIdle px-3 py-1")}>
              Sign in
            </NavLink>
          )}

          {!loading && user && (
            <button type="button" className="navPill navPillIdle" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </nav>
      </div>

      <div className={classes.subbar}>
        <div className={classes.subbarRow}>
          <div className={classes.statement}>
            Human-made only • No generative AI listings
          </div>
          <Link to="/about" className={classes.aboutLink}>
            Learn more →
          </Link>
        </div>
      </div>

      <div className={classes.categoryWrap}>
        <div className={classes.categoryInner}>
          <div className={classes.categoryRow}>
            <span className={classes.categoryTitle}>Browse categories</span>

            <Link to="/market" className={chipClass(null)}>All</Link>

            {categoryLinks.map((c) => (
              <Link
                key={c.key}
                to={`/market?cat=${encodeURIComponent(c.key)}`}
                className={chipClass(c.key)}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Nav;