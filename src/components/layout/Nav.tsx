import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../../domain/catalog";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { useSellerAccess } from '../../hooks/creatorApplication/useSellerAccess';
import { useMyAdminAccess } from '../../hooks/admin/useMyAdminAccess';
import { useMessagesInbox } from '../../hooks/conversations/useMessagesInbox';
import ThemeToggle from "./ThemeToggle";

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

  topRow: "container mx-auto flex h-12 items-center gap-3 px-4 py-0 sm:px-6",
  brandLink: "shrink-0 text-lg font-black tracking-tight",
  brandWrap: "inline-flex items-center gap-2",
  brandImg: "brandMark h-7 w-7 shrink-0",
  brandText: "font-display text-base font-extrabold tracking-tight",
  brandAccent: "text-[rgb(var(--brand))]",

  form: "flex w-full items-center gap-2",
  searchInput: "searchInput h-8 py-0",
  searchButton: "btnOutline btnSm h-8 hidden sm:inline-flex",

  nav: "hidden items-center gap-1 md:flex",
  navPillBase: "navPill",
  navPillActive: "navPillActive",
  navPillHot: "navPillHot",
  navPillIdle: "navPillIdle",
  navPillAuth: "navPill inline-flex items-center justify-center whitespace-nowrap",
  navPillCount: "navPillCount",
  navPillDot: "navPillDot animate-pulse",
  navLabelWrap: "inline-flex items-center gap-2",
  navPillButton:
    "navPill inline-flex items-center justify-center whitespace-nowrap",
  signInButton: "btnPrimary btnSm h-8 ml-1 whitespace-nowrap",
  settingsPill:
    "navPill inline-flex h-8 w-8 items-center justify-center whitespace-nowrap px-0",

  statementWrap: "flex shrink-0 items-center gap-3 border-l border-[var(--hairline)] pl-4",
  statement: "hidden text-xs font-medium text-zinc-500 xl:inline",
  aboutLink: "linkPill whitespace-nowrap py-0.5",

  categoryWrap: "categoryBar",
  categoryInner: "categoryBarInner flex items-center gap-2",
  categoryRow: "categoryRow min-w-0 flex-1",
  categoryTitle: "categoryTitle hidden 2xl:inline",
  categoryScrollBtn: "categoryScrollBtn flex md:hidden",

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
  const { pathname, search } = useLocation();
  const [q, setQ] = useState("");
  const categoryRowRef = useRef<HTMLDivElement | null>(null);

  const { twitchByLogin, isFetching } = useTwitchStreams();
  const { user, loading } = useAuth();
  const { isLoading: isSellerAccessLoading, canAccessCreatorRoutes } =
    useSellerAccess();
  const { data: isAdmin = false, isLoading: isAdminLoading } = useMyAdminAccess();
  const { data: messagesInbox } = useMessagesInbox();

  const liveCount = useMemo(
    () => Object.keys(twitchByLogin).length,
    [twitchByLogin]
  );

  const unreadMessageCount = messagesInbox?.totalUnreadCount ?? 0;

  const unreadMessageLabel =
    unreadMessageCount > 99 ? "99+" : String(unreadMessageCount);

  const isFreeRoute = pathname === "/free";

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

  // Category chips only reflect the ?cat= param while on /market — on /free
  // (its own route, not a category filter) none of them should read as active.
  const chipClass = (key: string | null): string => {
    if (isFreeRoute) return classes.chip;
    const isAll = key === null;
    const isActive = isAll ? !activeCat : activeCat === key;
    return isActive ? classes.chipActive : classes.chip;
  };

  const freeChipClass = isFreeRoute ? classes.chipActive : classes.chip;

  // Scrolls the category rail by ~60% of its visible width per tap —
  // primarily for small screens where the rail can't show every chip at once.
  const scrollCategories = (direction: "left" | "right") => {
    const node = categoryRowRef.current;
    if (!node) return;
    const amount = Math.round(node.clientWidth * 0.6) || 160;
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
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
              to="/messages"
              aria-label={
                unreadMessageCount > 0
                  ? `Inbox, ${unreadMessageCount} unread message${unreadMessageCount === 1 ? "" : "s"}`
                  : "Inbox"
              }
              title={
                unreadMessageCount > 0
                  ? `${unreadMessageCount} unread message${unreadMessageCount === 1 ? "" : "s"}`
                  : "Inbox"
              }
              className={({ isActive }) => getAuthPillClass(isActive)}
            >
              <span className={classes.navLabelWrap}>
                <span>Inbox</span>

                {unreadMessageCount > 0 && (
                  <span className={classes.navPillCount}>
                    {unreadMessageLabel}
                  </span>
                )}
              </span>
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
            <NavLink to="/signin" className={classes.signInButton}>
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

        <ThemeToggle />
      </div>

      <div className={classes.categoryWrap}>
        <div className={classes.categoryInner}>
          <button
            type="button"
            aria-label="Scroll categories left"
            className={classes.categoryScrollBtn}
            onClick={() => scrollCategories("left")}
          >
            ‹
          </button>

          <div className={classes.categoryRow} ref={categoryRowRef}>
            <span className={classes.categoryTitle}>Browse categories</span>

            <Link to="/market" className={chipClass(null)}>
              All
            </Link>

            <Link to="/free" className={freeChipClass}>
              Free
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

          <button
            type="button"
            aria-label="Scroll categories right"
            className={classes.categoryScrollBtn}
            onClick={() => scrollCategories("right")}
          >
            ›
          </button>

          <div className={classes.statementWrap}>
            <span className={classes.statement}>
              Human-made • No generative AI
            </span>

            <Link to="/about" className={classes.aboutLink}>
              Learn more →
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Nav;