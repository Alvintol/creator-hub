import { Link, NavLink, Outlet } from "react-router-dom";
import { getProfileAvatarUrl } from "../../domain/profileMedia";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";
import { useMyModerationReports } from "../../hooks/moderation/useMyModerationReports";
import { useMyProfile } from "../../hooks/profile/useMyProfile";
import { useProfilePlatformAccounts } from "../../hooks/profile/useProfilePlatformAccounts";

const classes = {
  page: "space-y-4",
  header: "card px-4 pt-3 hover:shadow-[var(--shadow-md)] sm:px-5",
  identity: "flex items-center gap-3",
  avatar:
    "h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--hairline-strong)] bg-zinc-100",
  avatarImage: "h-full w-full object-cover",
  avatarFallback:
    "flex h-full w-full items-center justify-center font-display text-sm font-bold text-zinc-600",
  names: "min-w-0 flex-1",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  nameRow: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5",
  name: "truncate font-display text-lg font-bold leading-tight tracking-tight text-zinc-900",
  handle: "block truncate text-xs text-zinc-500 hover:text-zinc-800",
  status: "inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11px] font-semibold",
  statusCreator:
    "border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-text))]",
  statusMember: "border-zinc-200 bg-zinc-100 text-zinc-700",
  // Phones reach the public profile through the @handle link instead.
  profileLink: "btnOutline btnSm hidden shrink-0 sm:inline-flex",

  tabs: "-mx-1 mt-3 flex gap-1 overflow-x-auto",
  tab: "relative inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition",
  tabActive: "border-[rgb(var(--brand))] text-zinc-900",
  tabIdle: "border-transparent text-zinc-500 hover:text-zinc-800",
  count:
    "rounded-full bg-[rgb(var(--accent-soft))] px-1.5 py-px text-[10px] font-bold text-[rgb(var(--accent-text))]",
} as const;

const tabs = [
  { to: "/settings/profile", label: "Account" },
  { to: "/settings/reports", label: "My reports" },
] as const;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

// Shared frame for settings pages: a compact identity card with section tabs.
const SettingsLayout = () => {
  const { data: profile } = useMyProfile();
  const { data: platformAccounts = [] } = useProfilePlatformAccounts();
  const { data: reports = [] } = useMyModerationReports();
  const { isCreatorApproved } = useSellerAccess();

  const twitchAccount = platformAccounts.find((account) => account.platform === "twitch") ?? null;
  const avatarUrl = getProfileAvatarUrl(profile, twitchAccount);
  const handle = profile?.handle?.trim() ?? "";
  const displayName = profile?.display_name?.trim() || handle || "Your account";
  const unreadReports = reports.filter((report) => report.has_unread_update).length;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.identity}>
          <div className={classes.avatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={classes.avatarImage} />
            ) : (
              <div className={classes.avatarFallback} aria-hidden="true">
                {initials(displayName)}
              </div>
            )}
          </div>

          <div className={classes.names}>
            <div className={classes.eyebrow}>Settings</div>
            <div className={classes.nameRow}>
              <span className={classes.name}>{displayName}</span>
              <span
                className={`${classes.status} ${isCreatorApproved ? classes.statusCreator : classes.statusMember}`}
              >
                {isCreatorApproved ? "Creator" : "Member"}
              </span>
            </div>
            {handle && (
              <Link className={classes.handle} to={`/creator/${handle}`}>
                @{handle}
              </Link>
            )}
          </div>

          {handle && (
            <Link className={classes.profileLink} to={`/creator/${handle}`}>
              View profile
            </Link>
          )}
        </div>

        <nav className={classes.tabs} aria-label="Settings sections">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `${classes.tab} ${isActive ? classes.tabActive : classes.tabIdle}`
              }
            >
              {tab.label}
              {tab.to === "/settings/reports" && unreadReports > 0 && (
                <span className={classes.count}>
                  {unreadReports}
                  <span className="sr-only"> new updates</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <Outlet />
    </div>
  );
};

export default SettingsLayout;
