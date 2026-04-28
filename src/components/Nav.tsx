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
import { useSellerAccess } from '../hooks/creatorApplication/useSellerAccess';

type CategoryLink = {
  key: string;
  label: string;
};

const brand = {
  markSrc: "/logo-mark.png",
  alt: "CreatorHub",
} as const;

const classes = {
  header: "topbar",

  topRow: "mx-auto flex max-w-6xl items-center gap-3 px-4 py-2",
  brandLink: "shrink-0 text-lg font-black tracking-tight",
  brandWrap: "inline-flex items-center gap-2",
  brandImg: "h-8 w-8 shrink-0",
  brandText: "text-lg font-black tracking-tight",
  brandAccent: "text-[rgb(var(--brand))]",

  form: "flex w-full items-center gap-2",
  searchInput: "searchInput",
  searchButton: "btnPrimary hidden sm:inline-flex",

  nav: "hidden items-center gap-1 md:flex",
  navPillBase: "navPill",
  navPillActive: "navPillActive",
  navPillHot: "navPillHot",
  navPillIdle: "navPillIdle",
  navPillAuth: "navPill inline-flex items-center justify-center whitespace-nowrap px-3 py-1",
  navPillCount: "navPillCount",
  navPillDot: "navPillDot animate-pulse",
  navLabelWrap: "inline-flex items-center gap-2",
  navPillButton:
    "navPill inline-flex items-center justify-center whitespace-nowrap",

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

// Builds a market search URL from the current nav search field
const getMarketUrl = (query: string): string =>
  query.trim() ? `/market?q=${encodeURIComponent(query.trim())}` : "/market";

// Builds a standard nav pill class for normal nav links
const getPillClass = (isActive: boolean): string =>
  `${classes.navPillBase} ${isActive ? classes.navPillActive : ""}`.trim();

// Builds the live nav pill class
// Adds a "hot" state when someone is live
const getLivePillClass = (isActive: boolean, liveCount: number): string =>
  isActive
    ? `${classes.navPillBase} ${classes.navPillActive}`
    : `${classes.navPillBase} ${liveCount > 0 ? classes.navPillHot : ""}`.trim();

// Builds the auth/settings pill class
const getAuthPillClass = (isActive: boolean): string =>
  `${classes.navPillAuth} ${isActive ? classes.navPillActive : classes.navPillIdle}`.trim();

const Nav = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState("");

  const { twitchByLogin, isFetching } = useTwitchStreams();
  const { user, loading } = useAuth();
  const { isLoading: isSellerAccessLoading, canAccessCreatorRoutes } =
    useSellerAccess();

  const liveCount = useMemo(
    () => Object.keys(twitchByLogin).length,
    [twitchByLogin]
  );

  const activeCat = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("cat") ?? "";
  }, [search]);

  const categoryLinks = useMemo<CategoryLink[]>(
    () =>
      CATEGORIES.map((category) => ({
        key: String(category.key),
        label: String(category.label),
      })),
    []
  );

  const chipClass = (key: string | null): string => {
    const isAll = key === null;
    const isActive = isAll ? !activeCat : activeCat === key;
    return isActive ? classes.chipActive : classes.chip;
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    navigate(getMarketUrl(q));
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className={classes.header}>
      <div className={classes.topRow}>
        <Link to="/" className={classes.brandLink}>
          <span className={classes.brandWrap}>
            <img
              src={brand.markSrc}
              alt={brand.alt}
              className={classes.brandImg}
              draggable={false}
            />

            <span className={classes.brandText}>
              <span className={classes.brandAccent}>Creator</span>Hub
            </span>
          </span>
        </Link>

        <form className={classes.form} onSubmit={onSubmit}>
          <input
            className={classes.searchInput}
            aria-label="Search marketplace"
            value={q}
            onChange={(event) => setQ(event.currentTarget.value)}
            placeholder="Search emotes, overlays, VTuber models, editors, riggers…"
          />

          <button type="submit" className={classes.searchButton}>
            Search
          </button>
        </form>

        <nav className={classes.nav}>
          <NavLink to="/market" className={({ isActive }) => getPillClass(isActive)}>
            Market
          </NavLink>

          <NavLink to="/creators" className={({ isActive }) => getPillClass(isActive)}>
            Creators
          </NavLink>

          <NavLink
            to="/live"
            className={({ isActive }) => getLivePillClass(isActive, liveCount)}
          >
            <span className={classes.navLabelWrap}>
              <span>Live</span>

              {liveCount > 0 && (
                <span className={classes.navPillCount}>{liveCount}</span>
              )}

              {isFetching && <span className={classes.navPillDot} />}
            </span>
          </NavLink>

          {!loading && user && !isSellerAccessLoading && canAccessCreatorRoutes && (
            <NavLink
              to="/creator/dashboard"
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              Dashboard
            </NavLink>
          )}

          {!loading && user && (
            <NavLink
              to="/settings/profile"
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              Settings
            </NavLink>
          )}

          {!loading && !user && (
            <NavLink
              to="/signin"
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              Sign in
            </NavLink>
          )}

          {!loading && user && (
            <button
              type="button"
              className={`${classes.navPillButton} ${classes.navPillIdle}`}
              onClick={onSignOut}
            >
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

            <Link to="/market" className={chipClass(null)}>
              All
            </Link>

            {categoryLinks.map((category) => (
              <Link
                key={category.key}
                to={`/market?cat=${encodeURIComponent(category.key)}`}
                className={chipClass(category.key)}
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Nav;