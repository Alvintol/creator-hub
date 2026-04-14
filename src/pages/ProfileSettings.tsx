import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useMyProfile, type ProfileRow } from "../hooks/useMyProfile";
import { useProfilePlatformAccounts } from "../hooks/useProfilePlatformAccounts";
import { useSellerAccess } from "../hooks/useSellerAccess";
import { getProfileAvatarUrl } from "../domain/profileMedia";

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

  avatarSection: "flex items-start gap-4",
  avatarPreview:
    "h-16 w-16 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100",
  avatarImage: "h-full w-full object-cover",
  avatarFallback:
    "flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500",
  avatarActions: "flex min-w-[220px] flex-col items-start gap-2",
  avatarHelp: "text-xs text-zinc-500",

  mediaGrid: "mt-4 grid items-stretch gap-4 md:grid-cols-2",
  mediaCard: "rounded-2xl border border-zinc-200 bg-white p-4",
  mediaTitle: "text-sm font-extrabold text-zinc-900",
  mediaBody: "mt-3 min-h-[92px]",
  mediaHelp: "mt-2 text-xs text-zinc-500",
} as const;

// Pulls a readable error message from an unknown thrown value
const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// Validates a public handle
const isValidHandle = (value: string): boolean =>
  /^[a-z0-9][a-z0-9_-]{2,24}$/i.test(value);

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
  } = useProfilePlatformAccounts();

  const {
    isLoading: isSellerAccessLoading,
    sellerApplication,
    creatorStatusLabel,
    canStartApplication,
  } = useSellerAccess();

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
      void Promise.all([refetch(), refetchPlatformAccounts()]);
    }

    if (twitch === "error") {
      setErrMsg(params.get("msg") ?? "Twitch connect failed.");
      setOkMsg(null);
    }

    // Removes the query params so the banner does not reappear on refresh
    navigate({ pathname: "/settings/profile", search: "" }, { replace: true });
  }, [search, navigate, refetch, refetchPlatformAccounts]);

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
    ].filter(Boolean);

    return messages.length ? messages.join(" ") : null;
  }, [error, platformAccountsError]);

  const twitchAccount = useMemo(
    () => platformAccounts.find((account) => account.platform === "twitch") ?? null,
    [platformAccounts]
  );

  const youtubeAccount = useMemo(
    () => platformAccounts.find((account) => account.platform === "youtube") ?? null,
    [platformAccounts]
  );

  const twitchStatus = useMemo(
    () => (twitchAccount ? "Connected" : "Not connected"),
    [twitchAccount]
  );

  const isTwitchConnected = useMemo(
    () => Boolean(twitchAccount?.platform_user_id),
    [twitchAccount]
  );

  const youtubeStatus = useMemo(
    () => (youtubeAccount ? "Connected" : "Not connected"),
    [youtubeAccount]
  );

  const myProfileLink = useMemo(() => {
    const nextHandle = (profile?.handle ?? "").trim();
    return nextHandle ? `/creator/${nextHandle}` : "/creators";
  }, [profile]);

  const avatarUrl = useMemo(() => {
    const profileAvatarUrl = getProfileAvatarUrl(profile);

    if (typeof profileAvatarUrl === "string" && profileAvatarUrl.trim()) {
      return profileAvatarUrl;
    }

    const twitchProfileImageUrl = twitchAccount?.metadata?.profile_image_url;

    return typeof twitchProfileImageUrl === "string" &&
      twitchProfileImageUrl.trim()
      ? twitchProfileImageUrl
      : null;
  }, [profile, twitchAccount]);

  const creatorApplicationCtaLabel = useMemo(() => {
    if (!sellerApplication) return "Start Creator application";

    if (
      sellerApplication.status === "draft" ||
      sellerApplication.status === "needs_changes"
    ) {
      return "Continue Creator application";
    }

    if (
      sellerApplication.status === "submitted" ||
      sellerApplication.status === "under_review"
    ) {
      return "View application";
    }

    if (sellerApplication.status === "approved") {
      return "View creator access";
    }

    if (
      sellerApplication.status === "rejected" ||
      sellerApplication.status === "suspended"
    ) {
      return "View application status";
    }

    return "Open application";
  }, [sellerApplication]);

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

    if (isTwitchConnected) {
      setInfoMsg("Your Twitch account is already connected.");
      return;
    }

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
        throw new Error(
          json.error || `Twitch connect failed (${response.status})`
        );
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
          Set up your account, connect platforms, and prepare for creator access.
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

        <div className={classes.mediaGrid}>
          <div className={classes.mediaCard}>
            <div className={classes.mediaTitle}>Profile image</div>

            <div className={classes.mediaBody}>
              <div className={classes.avatarSection}>
                <div className={classes.avatarPreview}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={classes.avatarImage} />
                  ) : (
                    <div className={classes.avatarFallback}>No avatar</div>
                  )}
                </div>

                <div className={classes.avatarActions}>
                  <button className={classes.btnOutline} type="button" disabled>
                    Upload profile image soon
                  </button>

                  <div className={classes.avatarHelp}>
                    For now, CreatorHub uses your linked Twitch profile image when available.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={classes.mediaCard}>
            <div className={classes.mediaTitle}>Profile banner</div>

            <div className={classes.mediaBody}>
              <button className={classes.btnOutline} type="button" disabled>
                Banner uploads coming soon
              </button>

              <div className={classes.mediaHelp}>
                Custom image uploads will open once media storage is expanded.
              </div>
            </div>
          </div>
        </div>

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

            <div className={classes.fieldHelp}>
              3–25 chars, letters/numbers/_/-
            </div>
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
          Linking platforms is optional, but it helps with trust, profile
          richness, and future creator review.
        </p>

        <div className={classes.platformGrid}>
          <div className={classes.platformCard}>
            <div className={classes.platformHeader}>
              <div className={classes.platformTitle}>Twitch</div>
              <div className={classes.platformHelp}>
                Useful for community trust, live status, and future creator review.
              </div>
            </div>

            <div className={classes.platformStatus}>
              <div className={classes.platformName}>Status</div>
              <div className={classes.platformValue}>{twitchStatus}</div>

              {twitchAccount?.platform_login && (
                <div className={classes.platformMuted}>@{twitchAccount.platform_login}</div>
              )}

              {twitchAccount?.profile_url && (
                <a
                  href={twitchAccount.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className={classes.platformMuted}
                >
                  View Twitch profile
                </a>
              )}
            </div>

            <div className={classes.platformActions}>
              <button
                className={classes.btnOutline}
                type="button"
                onClick={onConnectTwitch}
                disabled={busy || isLoading || isLoadingPlatforms || isTwitchConnected}
              >
                {isLoadingPlatforms
                  ? "Checking Twitch…"
                  : isTwitchConnected
                    ? "Connected"
                    : "Connect Twitch"}
              </button>
            </div>
          </div>

          <div className={classes.platformCard}>
            <div className={classes.platformHeader}>
              <div className={classes.platformTitle}>YouTube</div>
              <div className={classes.platformHelp}>
                YouTube linking will be added next so users can show creator
                activity outside Twitch.
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
              <button className={classes.btnOutline} type="button" disabled>
                YouTube linking soon
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={classes.card}>
        <div className={classes.title}>Creator application</div>

        <p className={classes.help}>
          Creator access is reviewed manually. The full application now lives in
          its own dedicated flow.
        </p>

        <div className={classes.applicationCard}>
          <div className={classes.applicationTitle}>Current status</div>
          <div className={classes.applicationStatus}>{creatorStatusLabel}</div>

          <div className={classes.applicationText}>
            Creator applications are reviewed manually to reduce spam, bots, and
            low-trust accounts.
          </div>

          <div className={classes.applicationList}>
            <div>• Complete your public profile</div>
            <div>• Link at least one creator platform</div>
            <div>• Link your Most Recent Upload/Vod from the last 30 days</div>
            <div>• Add work samples in the Creator application flow</div>
            <div>• Pass manual CreatorHub review</div>
          </div>

          <div className={classes.pills}>
            <span className={classes.pill}>Human-made only</span>
            <span className={classes.pill}>Manual review</span>
            <span className={classes.pill}>No instant activation</span>
          </div>

          <div className={classes.row}>
            <Link className={classes.btnPrimary} to="/apply/creator">
              {creatorApplicationCtaLabel}
            </Link>
          </div>

          {!canStartApplication && (
            <div className={classes.fieldHelp}>
              Add a display name and handle before starting your application.
            </div>
          )}

          {sellerApplication?.reviewer_notes && (
            <div className={classes.fieldHelp}>
              Reviewer notes are available in the Creator application page.
            </div>
          )}
        </div>
      </div>

      {(loading ||
        isLoading ||
        isLoadingPlatforms ||
        isSellerAccessLoading) && (
          <div className={classes.loadingText}>Loading…</div>
        )}
    </div>
  );
};

export default ProfileSettings;