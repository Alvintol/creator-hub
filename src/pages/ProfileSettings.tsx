import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useMyProfile, type ProfileRow } from "../hooks/useMyProfile";

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
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  bannerOk: "card border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  bannerErr: "card border-rose-200 bg-rose-50 p-4 text-rose-900",
  bannerTitle: "text-sm font-extrabold",
  bannerText: "mt-1 text-sm",

  toggleRow:
    "mt-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4",
  toggleInfo: "flex flex-wrap gap-2",
  toggleTitle: "text-sm font-extrabold text-zinc-900",
  toggleDesc: "mt-1 text-sm text-zinc-600",
  toggleStrong: "font-semibold",
  toggleMuted: "text-zinc-400",
  toggleActions: "flex flex-wrap gap-2",

  pills: "mt-3 flex flex-wrap gap-2",
  pill: "chip",

  lockedText: "mt-3 text-sm text-zinc-600",
  loadingText: "text-sm text-zinc-600",
} as const;

// Pulls a readable error message from an unknown thrown value
const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// Validates a public handle
// 3–25 chars
// letters, numbers, underscores, dashes
// must start with a letter or number
const isValidHandle = (value: string): boolean =>
  /^[a-z0-9][a-z0-9_-]{2,24}$/i.test(value);

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { search } = useLocation();

  const { user, session, loading } = useAuth();
  const { data: profile, isLoading, error, refetch } = useMyProfile();

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Shows Twitch callback banners when redirected back to this page
  useEffect(() => {
    const params = new URLSearchParams(search);
    const twitch = params.get("twitch");

    if (!twitch) return;

    if (twitch === "connected") {
      const ageOk = params.get("age_ok") === "1";

      setOkMsg(
        ageOk
          ? "Twitch connected. You’re eligible for creator mode."
          : "Twitch connected. Account must be 1+ year old to enable creator mode."
      );
      setErrMsg(null);
    }

    if (twitch === "error") {
      const message = params.get("msg") ?? "Twitch connect failed.";
      setErrMsg(message);
      setOkMsg(null);
    }

    // Removes the query params so the banner does not reappear on refresh
    navigate({ pathname: "/settings/profile", search: "" }, { replace: true });
  }, [search, navigate]);

  // Syncs form state from the latest profile response
  useEffect(() => {
    if (!profile) return;

    setHandle(profile.handle ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
  }, [profile]);

  const errText = useMemo(
    () => (error ? getErrorMessage(error) : null),
    [error]
  );

  const twitchStatus = useMemo(
    () =>
      !profile?.twitch_login
        ? "Not connected"
        : profile.twitch_age_ok
          ? "Connected (eligible)"
          : "Connected (account too new)",
    [profile]
  );

  const canEnableCreator = useMemo(
    () => Boolean(profile?.twitch_age_ok),
    [profile]
  );

  const myProfileLink = useMemo(() => {
    const nextHandle = (profile?.handle ?? "").trim();
    return nextHandle ? `/creator/${nextHandle}` : "/creators";
  }, [profile]);

  const onSave = async () => {
    if (!user?.id) return;

    setOkMsg(null);
    setErrMsg(null);

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

  const onToggleCreator = async () => {
    if (!user?.id || !profile) return;

    setOkMsg(null);
    setErrMsg(null);

    const nextEnabled = !profile.creator_enabled;

    try {
      setBusy(true);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ creator_enabled: nextEnabled })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setOkMsg(nextEnabled ? "Creator mode enabled." : "Creator mode disabled.");
      await refetch();
    } catch (error) {
      // If Twitch age gating is active, this can fail with an RLS error
      setErrMsg(
        canEnableCreator
          ? getErrorMessage(error)
          : "To enable creator mode, connect a Twitch account that is 1+ year old."
      );
    } finally {
      setBusy(false);
    }
  };

  const onConnectTwitch = async () => {
    setOkMsg(null);
    setErrMsg(null);

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
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <div className={classes.title}>You’re not signed in</div>

          <p className={classes.help}>
            Sign in to edit your profile and creator settings.
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
          Update your public profile. Creator mode will require Twitch
          eligibility (1+ year account).
        </p>
      </div>

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
          These fields show on your creator page and in search.
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
              placeholder="What do you make? What’s your turnaround like?"
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
            {busy ? "Saving…" : "Save"}
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
        <div className={classes.title}>Creator mode</div>

        <p className={classes.help}>
          Enable this to create listings later. Requires a Twitch account that
          is 1+ year old.
        </p>

        <div className={classes.toggleRow}>
          <div>
            <div className={classes.toggleTitle}>
              Creator mode: {profile?.creator_enabled ? "Enabled" : "Disabled"}
            </div>

            <div className={classes.toggleDesc}>
              Twitch: <span className={classes.toggleStrong}>{twitchStatus}</span>

              {profile?.twitch_login && (
                <span className={classes.toggleMuted}> • @{profile.twitch_login}</span>
              )}
            </div>

            <div className={classes.pills}>
              <span className={classes.pill}>Human-made only</span>
              <span className={classes.pill}>No generative AI listings</span>
              <span className={classes.pill}>Clear deliverables</span>
            </div>
          </div>

          <div className={classes.toggleActions}>
            {!profile?.twitch_login && (
              <button
                className={classes.btnOutline}
                type="button"
                onClick={onConnectTwitch}
                disabled={busy || isLoading}
              >
                Connect Twitch
              </button>
            )}

            {profile?.twitch_login && !profile.twitch_age_ok && (
              <button
                className={classes.btnOutline}
                type="button"
                onClick={onConnectTwitch}
                disabled={busy || isLoading}
                title="Reconnect after your account meets the age requirement"
              >
                Re-check Twitch
              </button>
            )}

            <button
              className={classes.btnOutline}
              type="button"
              onClick={onToggleCreator}
              disabled={busy || isLoading}
            >
              {profile?.creator_enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        {!canEnableCreator && (
          <div className={classes.lockedText}>
            Creator mode stays locked until Twitch is connected and your account
            is 1+ year old.
          </div>
        )}
      </div>

      {(loading || isLoading) && (
        <div className={classes.loadingText}>Loading…</div>
      )}
    </div>
  );
};

export default ProfileSettings;