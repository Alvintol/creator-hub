import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

export const useEnsureProfile = () => {
  const { user, loading } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (ranRef.current) return;

    ranRef.current = true;

    const run = async () => {
      const { data: existing, error: selErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (selErr) return;
      if (existing?.user_id) return;

      await supabase.from("profiles").insert({
        user_id: user.id,
        display_name: user.email?.split("@")[0] ?? "Creator",
      });
    };

    run();
  }, [loading, user]);
};