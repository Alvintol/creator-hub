import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";

type TwitchStreamsResponse = { data?: TwitchStream[]; error?: string };

type TwitchLoginRow = {
  platform_login: string | null;
};

const fetchPublicTwitchLogins = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("profile_platform_accounts")
    .select("platform_login")
    .eq("platform", "twitch")
    .not("platform_login", "is", null);

  if (error) throw error;

  return Array.from(
    new Set(
      ((data ?? []) as TwitchLoginRow[])
        .map((row) => row.platform_login)
        .filter((login): login is string => Boolean(login?.trim()))
        .map((login) => normalizeTwitchLogin(login))
    )
  ).sort();
};

const fetchTwitchStreams = async (logins: string[]): Promise<TwitchStream[]> => {
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
};

export const useTwitchStreams = () => {
  const loginsQuery = useQuery<string[]>({
    queryKey: ["publicTwitchLogins"],
    queryFn: fetchPublicTwitchLogins,
    staleTime: 5 * 60_000,
  });

  const logins = loginsQuery.data ?? [];

  const streamsQuery = useQuery<TwitchStream[]>({
    queryKey: ["twitchStreams", logins],
    enabled: loginsQuery.isSuccess && logins.length > 0,
    queryFn: () => fetchTwitchStreams(logins),

    // Poll every 60s to keep stream status up-to-date.
    refetchInterval: 60_000,

    // Don’t poll when tab is hidden
    refetchIntervalInBackground: false,
  });

  const twitchByLogin = useMemo(() => {
    const map: Record<string, TwitchStream> = {};

    (streamsQuery.data ?? []).forEach((stream) => {
      map[normalizeTwitchLogin(stream.login)] = stream;
    });

    return map;
  }, [streamsQuery.data]);

  return {
    ...streamsQuery,
    twitchByLogin,
    logins,
    isLoading: loginsQuery.isLoading || streamsQuery.isLoading,
    error: loginsQuery.error ?? streamsQuery.error,
  };
};