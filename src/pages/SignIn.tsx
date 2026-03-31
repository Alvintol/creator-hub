import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

const classes = {
  page: "space-y-6",
  card: "card max-w-xl p-6",
  h1: "text-2xl font-extrabold tracking-tight",
  p: "mt-2 text-sm text-zinc-600",
  signedInEmail: "font-semibold",

  form: "mt-5 space-y-3",
  field: "space-y-2",
  label: "text-sm font-extrabold text-zinc-800",
  input: "searchInput",
  btn: "btnPrimary",
  btnAlt: "btnOutline",

  row: "flex flex-wrap items-center gap-3",
  rowTop: "mt-5 flex flex-wrap items-center gap-3",

  msgOk: "text-sm font-semibold text-emerald-700",
  msgErr: "text-sm font-semibold text-rose-700",
  msgErrTop: "mt-3 text-sm font-semibold text-rose-700",
} as const;

// Pulls a readable error message from an unknown thrown value
const getErrorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : fallback;

const SignIn = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // After email-link sign-in, send the user back to the home page
  const redirectTo = `${window.location.origin}/`;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr(null);

    const value = email.trim();

    if (!value) {
      setErr("Please enter your email.");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setSent(true);
    } catch (error) {
      setErr(getErrorMessage(error, "Could not send sign-in link."));
    } finally {
      setBusy(false);
    }
  };

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
            Signed in as <span className={classes.signedInEmail}>{user.email}</span>.
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
          We’ll email you a secure sign-in link. No password needed.
        </p>

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
              {busy ? "Sending…" : "Send sign-in link"}
            </button>

            <Link className={classes.btnAlt} to="/">
              Back home
            </Link>
          </div>

          {sent && !err && (
            <div className={classes.msgOk}>
              Link sent — check your inbox (and spam folder).
            </div>
          )}

          {err && <div className={classes.msgErr}>{err}</div>}
        </form>
      </div>
    </div>
  );
};

export default SignIn;