import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
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

  const queryClient = useQueryClient();

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
      setLoading(false);
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
      let profileChanged = false;

      // Ensure profile exists once per user
      if (ensuredUserIdRef.current !== userId) {
        ensuredUserIdRef.current = userId;

        const { data: existing, error: selectError } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (selectError) {
          console.warn("[profiles] select failed:", selectError.message);
          return;
        }

        if (!existing?.user_id) {
          const displayName = email ? email.split("@")[0] : "Creator";

          const { error: insertError } = await supabase.from("profiles").insert({
            user_id: userId,
            display_name: displayName,
            display_name_auto: true,
            profile_setup_seen: false,
            auth_provider_last_used: session?.user?.app_metadata?.provider ?? null,
          });

          if (insertError) {
            console.warn("[profiles] insert failed:", insertError.message);
            return;
          }

          profileChanged = true;
        }
      }

      // Sync display name from email only if it is still auto-managed
      if (email && lastEmailRef.current !== email) {
        lastEmailRef.current = email;

        const nextDisplayName = email.split("@")[0] || "Creator";

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ display_name: nextDisplayName })
          .eq("user_id", userId)
          .eq("display_name_auto", true);

        if (updateError) {
          console.warn("[profiles] display_name sync failed:", updateError.message);
        } else {
          profileChanged = true;
        }
      }

      // Track the last auth provider used
      const provider = session?.user?.app_metadata?.provider ?? null;

      if (provider) {
        const { error: providerUpdateError } = await supabase
          .from("profiles")
          .update({ auth_provider_last_used: provider })
          .eq("user_id", userId);

        if (providerUpdateError) {
          console.warn(
            "[profiles] auth_provider_last_used sync failed:",
            providerUpdateError.message
          );
        } else {
          profileChanged = true;
        }
      }

      // Refresh the profile query so first-login redirect can see the new row immediately
      if (profileChanged) {
        await queryClient.invalidateQueries({
          queryKey: ["myProfile", userId],
        });
      }
    };

    void run();
  }, [loading, session, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};

export default AuthProvider;