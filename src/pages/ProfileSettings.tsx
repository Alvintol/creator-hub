import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useMyProfile, type ProfileRow } from "../hooks/useMyProfile";

type PlatformKey = "twitch" | "youtube";

type ProfilePlatformAccountRow = {
  id: string;
  profile_user_id: string;

  platform: PlatformKey;
  platform_user_id: string;

  platform_login: string | null;
  platform_display_name: string | null;
  profile_url: string | null;

  account_created_at: string | null;
  connected_at: string;

  last_activity_at: string | null;
  activity_checked_at: string | null;
  is_active_recently: boolean | null;

  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
};

type SellerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "suspended";

type SellerApplicationRow = {
  id: string;
  profile_user_id: string;

  status: SellerApplicationStatus;

  submitted_at: string | null;
  reviewed_at: string | null;

  reviewer_notes: string | null;
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;
};

const classes = {
  page: "space-y-6",
  header: "space-y-1",
  h1: "text-2xl font-extrabold tracking-tight",
  sub: "text-sm text-zinc-600",

  card: "card p-6",
  title: "text-base font-extrabold tracking-tight",
  help: "mt-1 text-sm text-zinc-600",

  grid: "mt-4 grid gap-4 md:grid-cols-2",
  field: "space-y-2",
  fieldWide: "space-y-2 md:col-span-2",
  label: "text-sm font-extrabold text-zinc-800",
  input: "searchInput",
  textarea:
    "w-full rounded-xl bg-white px-4 py-3 text-sm outline-none transition ring-1 ring-zinc-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70",
  fieldHelp: "text-xs text-zinc-500",

  row: "mt-5 flex flex-wrap items-center gap-3",
  btnPrimary:
    "inline-flex items-center justify-center rounded-full border border-[rgb(var(--brand))] bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",
  btnOutline:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  bannerInfo: "card border border-sky-200 bg-sky-50 p-4 text-sky-900",
  bannerOk: "card border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  bannerErr: "card border border-rose-200 bg-rose-50 p-4 text-rose-900",
  bannerTitle: "text-sm font-extrabold",
  bannerText: "mt-1 text-sm",

  platformGrid: "mt-4 grid gap-4",
  platformCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  platformHeader: "space-y-1",
  platformTitle: "text-sm font-extrabold text-zinc-900",
  platformHelp: "text-sm text-zinc-600",
  platformStatus: "mt-3 space-y-1",
  platformName: "text-sm font-semibold text-zinc-900",
  platformValue: "text-sm text-zinc-700",
  platformMuted: "text-sm text-zinc-500",
  platformActions: "mt-4 flex flex-wrap gap-2",

  applicationCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  applicationTitle: "text-sm font-extrabold text-zinc-900",
  applicationText: "mt-1 text-sm text-zinc-600",
  applicationList: "mt-3 space-y-2 text-sm text-zinc-700",
  applicationStatus: "mt-3 text-sm font-semibold text-zinc-900",

  pills: "mt-3 flex flex-wrap gap-2",
  pill: "chip",

  loadingText: "text-sm text-zinc-600",
} as const;

// Pulls a readable error message from an unknown thrown value
const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// Validates a public handle
const isValidHandle = (value: string): boolean =>
  /^[a-z0-9][a-z0-9_-]{2,24}$/i.test(value);

// Maps seller application state into a readable label
const getSellerStatusLabel = (
  sellerApplication: SellerApplicationRow | null | undefined
): string =>
  !sellerApplication
    ? "Not started"
    : sellerApplication.status === "approved"
      ? "Approved seller"
      : sellerApplication.status === "under_review"
        ? "Under review"
        : sellerApplication.status === "submitted"
          ? "Submitted"
          : sellerApplication.status === "needs_changes"
            ? "Needs changes"
            : sellerApplication.status === "rejected"
              ? "Rejected"
              : sellerApplication.status === "suspended"
                ? "Suspended"
                : "Draft";

// Loads linked platform accounts for the signed-in user
const fetchProfilePlatformAccounts = async (
  userId: string
): Promise<ProfilePlatformAccountRow[]> => {
  const { data, error } = await supabase
    .from("profile_platform_accounts")
    .select(`
      id,
      profile_user_id,
      platform,
      platform_user_id,
      platform_login,
      platform_display_name,
      profile_url,
      account_created_at,
      connected_at,
      last_activity_at,
      activity_checked_at,
      is_active_recently,
      metadata,
      created_at,
      updated_at
    `)
    .eq("profile_user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as ProfilePlatformAccountRow[];
};

// Loads the signed-in user's seller application
const fetchMySellerApplication = async (
  userId: string
): Promise<SellerApplicationRow | null> => {
  const { data, error } = await supabase
    .from("seller_applications")
    .select(`
      id,
      profile_user_id,
      status,
      submitted_at,
      reviewed_at,
      reviewer_notes,
      rejection_reason,
      created_at,
      updated_at
    `)
    .eq("profile_user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as SellerApplicationRow | null) ?? null;
};

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { search } = useLocation();

  const { user, session, loading } = useAuth();
  const { data: profile, isLoading, error, refetch } = useMyProfile();

  const {
    data: platformAccounts = [],
    isLoading: isLoadingPlatforms,
    error: platformAccountsError,
    refetch: refetchPlatformAccounts,
  } = useQuery<ProfilePlatformAccountRow[]>({
    queryKey: ["profilePlatformAccounts", user?.id],
    enabled: !loading && Boolean(user?.id),
    staleTime: 30_000,
    queryFn: () =>
      user?.id
        ? fetchProfilePlatformAccounts(user.id)
        : Promise.resolve([]),
  });

  const {
    data: sellerApplication,
    isLoading: isLoadingSellerApplication,
    error: sellerApplicationError,
  } = useQuery<SellerApplicationRow | null>({
    queryKey: ["mySellerApplication", user?.id],
    enabled: !loading && Boolean(user?.id),
    staleTime: 30_000,
    queryFn: () =>
      user?.id
        ? fetchMySellerApplication(user.id)
        : Promise.resolve(null),
  });

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Shows Twitch callback banners when redirected back to this page
  useEffect(() => {
    const params = new URLSearchParams(search);
    const twitch = params.get("twitch");

    if (!twitch) return;

    if (twitch === "connected") {
      setOkMsg("Twitch connected successfully.");
      setErrMsg(null);
      void refetchPlatformAccounts();
    }

    if (twitch === "error") {
      setErrMsg(params.get("msg") ?? "Twitch connect failed.");
      setOkMsg(null);
    }

    // Removes the query params so the banner does not reappear on refresh
    navigate({ pathname: "/settings/profile", search: "" }, { replace: true });
  }, [search, navigate, refetchPlatformAccounts]);

  // Syncs form state from the latest profile response
  useEffect(() => {
    if (!profile) return;

    setHandle(profile.handle ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
  }, [profile]);

  // Marks the first profile-settings visit as seen
  useEffect(() => {
    if (!user?.id || !profile || profile.profile_setup_seen) return;

    const markProfileSetupSeen = async () => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_setup_seen: true })
        .eq("user_id", user.id);

      if (!updateError) {
        setInfoMsg(
          "Welcome to CreatorHub. Set up anything you want here, then continue when ready."
        );
        await refetch();
      }
    };

    void markProfileSetupSeen();
  }, [user?.id, profile, refetch]);

  const errText = useMemo(() => {
    const messages = [
      error ? getErrorMessage(error) : null,
      platformAccountsError ? getErrorMessage(platformAccountsError) : null,
      sellerApplicationError ? getErrorMessage(sellerApplicationError) : null,
    ].filter(Boolean);

    return messages.length ? messages.join(" ") : null;
  }, [error, platformAccountsError, sellerApplicationError]);

  const twitchAccount = useMemo(
    () =>
      platformAccounts.find((account) => account.platform === "twitch") ?? null,
    [platformAccounts]
  );

  const youtubeAccount = useMemo(
    () =>
      platformAccounts.find((account) => account.platform === "youtube") ?? null,
    [platformAccounts]
  );

  const twitchStatus = useMemo(
    () => (twitchAccount ? "Connected" : "Not connected"),
    [twitchAccount]
  );

  const youtubeStatus = useMemo(
    () => (youtubeAccount ? "Connected" : "Not connected"),
    [youtubeAccount]
  );

  const sellerStatus = useMemo(
    () => getSellerStatusLabel(sellerApplication),
    [sellerApplication]
  );

  const myProfileLink = useMemo(() => {
    const nextHandle = (profile?.handle ?? "").trim();
    return nextHandle ? `/creator/${nextHandle}` : "/creators";
  }, [profile]);

  const onSave = async () => {
    if (!user?.id) return;

    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);

    const nextHandle = handle.trim();
    const nextDisplayName = displayName.trim();
    const nextBio = bio.trim();

    if (nextHandle && !isValidHandle(nextHandle)) {
      setErrMsg("Handle must be 3–25 chars (letters, numbers, _ or -).");
      return;
    }

    try {
      setBusy(true);

      const patch: Partial<ProfileRow> & Record<string, unknown> = {
        handle: nextHandle || null,
        display_name: nextDisplayName || null,
        bio: nextBio || null,
        profile_setup_seen: true,
        profile_setup_completed_at:
          profile?.profile_setup_completed_at ?? new Date().toISOString(),
      };

      // If the user manually sets a display name, stop auto-syncing from email
      if ((profile?.display_name_auto ?? true) && nextDisplayName) {
        patch.display_name_auto = false;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setOkMsg("Profile saved.");
      await refetch();
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Starts Twitch account linking for trust / profile enrichment
  const onConnectTwitch = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);

    const token = session?.access_token;

    if (!token) {
      setErrMsg("You must be signed in to connect Twitch.");
      return;
    }

    try {
      setBusy(true);

      const apiBase =
        (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";
      const startUrl = `${apiBase}/api/twitch/connect/start`;

      const response = await fetch(startUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !json.url) {
        throw new Error(json.error || `Twitch connect failed (${response.status})`);
      }

      window.location.assign(json.url);
    } catch (error) {
      setErrMsg(getErrorMessage(error));
      setBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <div className={classes.title}>You’re not signed in</div>

          <p className={classes.help}>
            Sign in to edit your profile and connected platforms.
          </p>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/signin">
              Sign in
            </Link>

            <Link className={classes.btnOutline} to="/">
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.h1}>Profile settings</h1>

        <p className={classes.sub}>
          Set up your account, connect platforms, and prepare for future seller application steps.
        </p>
      </div>

      {infoMsg && (
        <div className={classes.bannerInfo}>
          <div className={classes.bannerTitle}>Welcome</div>
          <div className={classes.bannerText}>{infoMsg}</div>
        </div>
      )}

      {okMsg && (
        <div className={classes.bannerOk}>
          <div className={classes.bannerTitle}>Success</div>
          <div className={classes.bannerText}>{okMsg}</div>
        </div>
      )}

      {(errMsg || errText) && (
        <div className={classes.bannerErr}>
          <div className={classes.bannerTitle}>Action needed</div>
          <div className={classes.bannerText}>{errMsg ?? errText}</div>
        </div>
      )}

      <div className={classes.card}>
        <div className={classes.title}>Public profile</div>

        <p className={classes.help}>
          These fields help other users recognise you and build trust.
        </p>

        <div className={classes.grid}>
          <div className={classes.field}>
            <div className={classes.label}>Handle</div>

            <input
              className={classes.input}
              value={handle}
              onChange={(event) => setHandle(event.currentTarget.value)}
              placeholder="your-handle"
              autoComplete="off"
            />

            <div className={classes.fieldHelp}>3–25 chars, letters/numbers/_/-</div>
          </div>

          <div className={classes.field}>
            <div className={classes.label}>Display name</div>

            <input
              className={classes.input}
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder="Your name"
              autoComplete="name"
            />

            <div className={classes.fieldHelp}>
              Editing this disables email-based auto naming.
            </div>
          </div>

          <div className={classes.fieldWide}>
            <div className={classes.label}>Bio</div>

            <textarea
              className={classes.textarea}
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.currentTarget.value)}
              placeholder="What do you make, what do you stream, and what are you looking for on CreatorHub?"
            />
          </div>
        </div>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            onClick={onSave}
            disabled={busy || isLoading}
          >
            {busy ? "Saving…" : "Save profile"}
          </button>

          <Link className={classes.btnOutline} to={myProfileLink}>
            View my profile
          </Link>

          <Link className={classes.btnOutline} to="/creators">
            Back to creators
          </Link>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.title}>Connected platforms</div>

        <p className={classes.help}>
          Linking platforms is optional, but it helps with trust, profile richness, and future seller review.
        </p>

        <div className={classes.platformGrid}>
          <div className={classes.platformCard}>
            <div className={classes.platformHeader}>
              <div className={classes.platformTitle}>Twitch</div>
              <div className={classes.platformHelp}>
                Useful for community trust, live status, and future seller review.
              </div>
            </div>

            <div className={classes.platformStatus}>
              <div className={classes.platformName}>Status</div>
              <div className={classes.platformValue}>{twitchStatus}</div>

              {twitchAccount?.platform_login && (
                <div className={classes.platformMuted}>
                  @{twitchAccount.platform_login}
                </div>
              )}
            </div>

            <div className={classes.platformActions}>
              <button
                className={classes.btnOutline}
                type="button"
                onClick={onConnectTwitch}
                disabled={busy || isLoading || isLoadingPlatforms}
              >
                {twitchAccount ? "Reconnect Twitch" : "Connect Twitch"}
              </button>
            </div>
          </div>

          <div className={classes.platformCard}>
            <div className={classes.platformHeader}>
              <div className={classes.platformTitle}>YouTube</div>
              <div className={classes.platformHelp}>
                YouTube linking will be added next so users can show creator activity outside Twitch.
              </div>
            </div>

            <div className={classes.platformStatus}>
              <div className={classes.platformName}>Status</div>
              <div className={classes.platformValue}>{youtubeStatus}</div>

              {youtubeAccount?.platform_login && (
                <div className={classes.platformMuted}>
                  @{youtubeAccount.platform_login}
                </div>
              )}
            </div>

            <div className={classes.platformActions}>
              <button
                className={classes.btnOutline}
                type="button"
                disabled
              >
                YouTube linking soon
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.title}>Seller application</div>

        <p className={classes.help}>
          Selling will be reviewed manually. Linking platforms and keeping your profile complete now will make that process easier later.
        </p>

        <div className={classes.applicationCard}>
          <div className={classes.applicationTitle}>Current status</div>
          <div className={classes.applicationStatus}>{sellerStatus}</div>

          <div className={classes.applicationText}>
            Seller access will not be self-serve. Applications will be reviewed manually to reduce spam, stolen work, and low-trust accounts.
          </div>

          <div className={classes.applicationList}>
            <div>• At least one linked creator platform</div>
            <div>• Recent public activity on Twitch or YouTube</div>
            <div>• Profile and identity that appear consistent and human-made</div>
          </div>

          <div className={classes.pills}>
            <span className={classes.pill}>Human-made only</span>
            <span className={classes.pill}>Manual review</span>
            <span className={classes.pill}>No instant seller activation</span>
          </div>

          <div className={classes.row}>
            <button className={classes.btnOutline} type="button" disabled>
              Applications coming soon
            </button>
          </div>
        </div>
      </div>

      {(loading || isLoading || isLoadingPlatforms || isLoadingSellerApplication) && (
        <div className={classes.loadingText}>Loading…</div>
      )}
    </div>
  );
};

export default ProfileSettings;