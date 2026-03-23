import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { creators } from "../data/mock";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";

type TwitchStreamsResponse = { data?: TwitchStream[]; error?: string };

export const useTwitchStreams = () => {
  const logins = useMemo(() => {
    const set = new Set<string>();

    creators.forEach((c) => {
      const login = c.platforms?.twitch?.login;
      if (!login) return;
      set.add(normalizeTwitchLogin(login));
    });

    return Array.from(set).sort();
  }, []);

  const query = useQuery({
    queryKey: ["twitchStreams", logins],
    enabled: logins.length > 0,

    queryFn: async () => {
      // If VITE_API_BASE is set, we hit the API server directly (no proxy required).
      // Otherwise we rely on Vite proxy + same-origin.
      const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
      const origin = base && base.length > 0 ? base : window.location.origin;

      const u = new URL("/api/twitch/streams", origin);
      u.searchParams.set("logins", logins.join(","));

      const r = await fetch(u.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const text = await r.text();

      let json: TwitchStreamsResponse;
      try {
        json = JSON.parse(text) as TwitchStreamsResponse;
      } catch {
        const preview = text.slice(0, 140).replace(/\s+/g, " ");
        throw new Error(
          `API returned non-JSON (${r.status}). Starts with: ${preview}`
        );
      }

      if (!r.ok) {
        throw new Error(json?.error || `Request failed (${r.status})`);
      }

      return json.data ?? [];
    },

    // Poll every 60s to keep stream status up-to-date.
    refetchInterval: 60_000,

    // Don’t poll when tab is hidden
    refetchIntervalInBackground: false,
  });

  const twitchByLogin = useMemo(() => {
    const map: Record<string, TwitchStream> = {};
    (query.data ?? []).forEach((s) => {
      map[normalizeTwitchLogin(s.login)] = s;
    });
    return map;
  }, [query.data]);

  return { ...query, twitchByLogin, logins };
};