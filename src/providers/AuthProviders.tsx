import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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