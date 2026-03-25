import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

const AuthProvider = (props: AuthProviderProps) => {
  const { children } = props;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const ensuredUserIdRef = useRef<string | null>(null);
  const lastEmailRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const userId = session?.user?.id ?? null;
    const email = session?.user?.email ?? null;

    if (!userId) {
      ensuredUserIdRef.current = null;
      lastEmailRef.current = null;
      return;
    }

    const run = async () => {
      // 1) ensure profile exists (only once per userId)
      if (ensuredUserIdRef.current !== userId) {
        ensuredUserIdRef.current = userId;

        const { data: existing, error: selErr } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (selErr) {
          console.warn("[profiles] select failed:", selErr.message);
          return;
        }

        if (!existing?.user_id) {
          const displayName = email ? email.split("@")[0] : "Creator";

          const { error: insErr } = await supabase.from("profiles").insert({
            user_id: userId,
            display_name: displayName,
            display_name_auto: true,
          });

          if (insErr) {
            console.warn("[profiles] insert failed:", insErr.message);
            return;
          }
        }
      }

      // 2) if email changed, update display_name ONLY if display_name_auto = true
      if (!email) return;
      if (lastEmailRef.current === email) return;

      lastEmailRef.current = email;

      const nextDisplayName = email.split("@")[0] || "Creator";

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ display_name: nextDisplayName })
        .eq("user_id", userId)
        .eq("display_name_auto", true);

      if (updErr) {
        console.warn("[profiles] display_name sync failed:", updErr.message);
      }
    };

    run();
  }, [loading, session]);

  const value = useMemo<AuthState>(() => {
    return { session, user: session?.user ?? null, loading };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};

export default AuthProvider;