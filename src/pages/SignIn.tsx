import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

const classes = {
  page: "space-y-6",
  card: "card mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.06)]",

  h1: "text-2xl font-extrabold tracking-tight",
  p: "mt-2 text-sm text-zinc-600",
  signedInEmail: "font-semibold",

  authStack: "mt-5 space-y-5",
  providerStack: "space-y-4",

  socialBtnBase:
    "relative flex w-full items-center justify-center overflow-hidden rounded-full border px-6 py-5 text-base font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",

  socialBtnGoogle:
    "border-zinc-400 bg-white text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:border-zinc-500 hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]",

  socialBtnTwitch:
    "border-[#7c3aed] bg-gradient-to-r from-[#7c3aed] via-[#9146FF] to-[#a855f7] text-white shadow-[0_6px_20px_rgba(145,70,255,0.35)] hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_10px_28px_rgba(145,70,255,0.42)]",

  socialBtnContent: "pointer-events-none flex items-center justify-center",
  socialBtnIconWrap:
    "absolute left-5 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full",
  socialBtnLabel: "text-[clamp(1rem,2vw,1.125rem)] font-bold tracking-tight",

  googleIconWrap:
    "border border-zinc-300 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]",

  twitchIconWrap:
    "border border-white/20 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm",

  socialImg: "h-7 w-7 object-contain",

  dividerRow: "flex items-center gap-3",
  dividerLine: "h-px flex-1 bg-zinc-300",
  dividerText: "text-xs font-semibold uppercase tracking-wide text-zinc-500",

  form: "space-y-3",
  field: "space-y-2",
  label: "text-sm font-extrabold text-zinc-800",
  input: "searchInput",

  row: "flex flex-wrap items-center gap-3",
  rowTop: "mt-5 flex flex-wrap items-center gap-3",

  btn:
    "inline-flex items-center justify-center rounded-full border border-zinc-400 bg-[rgb(var(--brand))] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,92,44,0.28)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 hover:shadow-[0_8px_22px_rgba(244,92,44,0.34)] disabled:cursor-not-allowed disabled:opacity-60",

  btnAlt:
    "inline-flex items-center justify-center rounded-full border border-zinc-600 bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_10px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-[1px] hover:border-zinc-500 hover:bg-zinc-50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.11)] disabled:cursor-not-allowed disabled:opacity-60",

  msgOk: "text-sm font-semibold text-emerald-700",
  msgErr: "text-sm font-semibold text-rose-700",
  msgErrTop: "mt-3 text-sm font-semibold text-rose-700",
} as const;

// Pulls a readable message from an unknown thrown value
const getErrorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : fallback;

// Standard post-auth redirect back into the app
const getRedirectTo = (): string => `${window.location.origin}/`;

// Google logo drawn as inline SVG so there is no external asset dependency
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v4.1h5.9c-.3 1.4-1.9 4.1-5.9 4.1-3.5 0-6.4-2.9-6.4-6.4s2.9-6.4 6.4-6.4c2 0 3.3.8 4.1 1.6l2.8-2.7C17.1 2.9 14.8 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.3-.2-1.8H12Z"
    />
    <path
      fill="#34A853"
      d="M2 12c0 1.6.4 3.2 1.3 4.5l3.4-2.6c-.2-.5-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.3 7.5C2.4 8.8 2 10.4 2 12Z"
    />
    <path
      fill="#FBBC05"
      d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.5 2.7C4.6 19.8 8 22 12 22Z"
    />
    <path
      fill="#4285F4"
      d="M21.6 10.2H12v4.1h5.9c-.3 1.2-1.1 2.2-2.3 2.9l3.2 2.5c1.9-1.8 2.8-4.3 2.8-7.5 0-.7-.1-1.3-.2-2Z"
    />
  </svg>
);

const TwitchIcon = () => (
  <img
    src="/twitch-logo.png"
    alt=""
    className={classes.socialImg}
    aria-hidden="true"
    draggable={false}
  />
);

type SocialButtonProps = {
  label: string;
  provider: "google" | "twitch";
  onClick: () => void;
  disabled?: boolean;
};

// Shared social button used by Google and Twitch
const SocialButton = (props: SocialButtonProps) => {
  const { label, provider, onClick, disabled = false } = props;

  const isGoogle = provider === "google";

  const buttonClassName = [
    classes.socialBtnBase,
    isGoogle ? classes.socialBtnGoogle : classes.socialBtnTwitch,
  ].join(" ");

  const iconWrapClassName = [
    classes.socialBtnIconWrap,
    isGoogle ? classes.googleIconWrap : classes.twitchIconWrap,
  ].join(" ");

  return (
    <button
      className={buttonClassName}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className={iconWrapClassName}>
        {isGoogle ? <GoogleIcon /> : <TwitchIcon />}
      </span>

      <span className={classes.socialBtnContent}>
        <span className={classes.socialBtnLabel}>{label}</span>
      </span>
    </button>
  );
};

const SignIn = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Starts OAuth sign-in with the selected provider
  const onOAuthSignIn = async (provider: "twitch" | "google") => {
    setErr(null);
    setSent(false);

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectTo(),
        },
      });

      if (error) throw error;
    } catch (error) {
      setErr(
        getErrorMessage(
          error,
          `Could not start ${provider} sign-in.`
        )
      );
      setBusy(false);
    }
  };

  // Sends an email magic-link sign-in
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr(null);
    setSent(false);

    const value = email.trim();

    if (!value) {
      setErr("Please enter your email.");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          emailRedirectTo: getRedirectTo(),
        },
      });

      if (error) throw error;

      setSent(true);
    } catch (error) {
      setErr(getErrorMessage(error, "Could not send sign-in link."));
    } finally {
      setBusy(false);
    }
  };

  // Signs the current user out
  const onSignOut = async () => {
    setErr(null);

    try {
      setBusy(true);

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      navigate("/");
    } catch (error) {
      setErr(getErrorMessage(error, "Could not sign out."));
    } finally {
      setBusy(false);
    }
  };

  if (!loading && user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <h1 className={classes.h1}>You’re signed in</h1>

          <p className={classes.p}>
            Signed in as{" "}
            <span className={classes.signedInEmail}>
              {user.email ?? "your account"}
            </span>.
          </p>

          <div className={classes.rowTop}>
            <button
              className={classes.btnAlt}
              onClick={onSignOut}
              type="button"
              disabled={busy}
            >
              Sign out
            </button>

            <Link className={classes.btnAlt} to="/creators">
              Browse creators
            </Link>
          </div>

          {err && <div className={classes.msgErrTop}>{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        <h1 className={classes.h1}>Sign in</h1>

        <p className={classes.p}>
          Continue with a sign-in method that fits you best. Twitch is a great
          option for creator-to-creator trust, while Google and email keep
          things simple for everyone.
        </p>

        <div className={classes.authStack}>
          <div className={classes.providerStack}>
            <SocialButton
              provider="twitch"
              label="Sign in with Twitch"
              onClick={() => void onOAuthSignIn("twitch")}
              disabled={busy}
            />

            <SocialButton
              provider="google"
              label="Sign in with Google"
              onClick={() => void onOAuthSignIn("google")}
              disabled={busy}
            />
          </div>

          <div className={classes.dividerRow}>
            <div className={classes.dividerLine} />
            <div className={classes.dividerText}>or continue with email</div>
            <div className={classes.dividerLine} />
          </div>

          <form className={classes.form} onSubmit={onSubmit}>
            <div className={classes.field}>
              <div className={classes.label}>Email</div>

              <input
                className={classes.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className={classes.row}>
              <button className={classes.btn} type="submit" disabled={busy}>
                {busy ? "Working…" : "Send sign-in link"}
              </button>

              <Link className={classes.btnAlt} to="/">
                Back home
              </Link>
            </div>

            {sent && !err && (
              <div className={classes.msgOk}>
                Link sent — check your inbox and spam folder.
              </div>
            )}

            {err && <div className={classes.msgErr}>{err}</div>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignIn;