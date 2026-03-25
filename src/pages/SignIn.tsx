import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProviders";

const classes = {
  page: "space-y-6",
  card: "card p-6 max-w-xl",
  h1: "text-2xl font-extrabold tracking-tight",
  p: "mt-2 text-sm text-zinc-600",

  form: "mt-5 space-y-3",
  label: "text-sm font-extrabold text-zinc-800",
  input: "searchInput",
  btn: "btnPrimary",
  btnAlt: "btnOutline",

  row: "flex flex-wrap gap-3 items-center",
  msgOk: "text-sm font-semibold text-emerald-700",
  msgErr: "text-sm font-semibold text-rose-700",
} as const;

const SignIn = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    return window.location.origin + "/"; // after click link, land home
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);

    const v = email.trim();
    if (!v) {
      setErr("Please enter your email.");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: v,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setSent(true);
    } catch (e2) {
      const msg =
        e2 && typeof e2 === "object" && "message" in e2
          ? String((e2 as { message: unknown }).message)
          : "Could not send sign-in link.";
      setErr(msg);
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
    } catch (e2) {
      const msg =
        e2 && typeof e2 === "object" && "message" in e2
          ? String((e2 as { message: unknown }).message)
          : "Could not sign out.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!loading && user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <h1 className={classes.h1}>You’re signed in</h1>
          <p className={classes.p}>Signed in as <span className="font-semibold">{user.email}</span>.</p>

          <div className={`${classes.row} mt-5`}>
            <button className={classes.btnAlt} onClick={onSignOut} type="button" disabled={busy}>
              Sign out
            </button>
            <Link className={classes.btnAlt} to="/creators">
              Browse creators
            </Link>
          </div>

          {err && <div className={`${classes.msgErr} mt-3`}>{err}</div>}
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
          <div className="space-y-2">
            <div className={classes.label}>Email</div>
            <input
              className={classes.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
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