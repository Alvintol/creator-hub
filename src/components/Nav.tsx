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
import { useMyAdminAccess } from '../hooks/admin/useMyAdminAccess';

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
  settingsPill:
    "navPill inline-flex h-9 w-9 items-center justify-center whitespace-nowrap px-0",

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

// Builds the icon-only settings pill class
const getSettingsPillClass = (isActive: boolean): string =>
  `${classes.settingsPill} ${isActive ? classes.navPillActive : classes.navPillIdle}`.trim();

const SettingsIcon = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 0 1 7.04 4.3l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2.4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.61.77 1 1.41 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
  </svg>
);

const Nav = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState("");

  const { twitchByLogin, isFetching } = useTwitchStreams();
  const { user, loading } = useAuth();
  const { isLoading: isSellerAccessLoading, canAccessCreatorRoutes } =
    useSellerAccess();
  const { data: isAdmin = false, isLoading: isAdminLoading } = useMyAdminAccess();

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

          {!loading && user && !isAdminLoading && isAdmin && (
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              Admin
            </NavLink>
          )}

          {!loading && user && (
            <NavLink
              to="/requests"
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              Requests
            </NavLink>
          )}
          {!loading && user && (
            <NavLink
              to="/settings/profile"
              aria-label="Settings"
              title="Settings"
              className={({ isActive }) => getSettingsPillClass(isActive)}
            >
              <SettingsIcon />
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