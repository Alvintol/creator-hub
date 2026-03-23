import { useEffect, useMemo, useRef } from "react";
import { creators } from "../data/mock";
import { normalizeTwitchLogin, type TwitchStream } from "../domain/twitch";
import { useHubActions } from "../providers/HubProvider";

type Options = {
  refreshMs?: number;
  focusCooldownMs?: number;
};

const DEFAULT_REFRESH_MS = 60_000;
const DEFAULT_FOCUS_COOLDOWN_MS = 15_000;

export const useTwitchStreamsRefresh = (opts?: Options) => {
  const refreshMs = opts?.refreshMs ?? DEFAULT_REFRESH_MS;
  const focusCooldownMs = opts?.focusCooldownMs ?? DEFAULT_FOCUS_COOLDOWN_MS;

  const { setTwitchStreams, setTwitchStreamsMeta } = useHubActions();

  const twitchLogins = useMemo(() => {
    const set = new Set<string>();

    creators.forEach((c) => {
      const login = c.platforms?.twitch?.login;
      if (!login) return;
      set.add(normalizeTwitchLogin(login));
    });

    return Array.from(set).sort();
  }, []);

  const inFlightRef = useRef(false);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (twitchLogins.length === 0) return;

    const ctrl = new AbortController();

    const refresh = async (opts2?: { force?: boolean }) => {
      const force = !!opts2?.force;
      const now = Date.now();

      if (!force) {
        if (inFlightRef.current) return;
        if (now - lastRefreshRef.current < focusCooldownMs) return;
      }

      inFlightRef.current = true;
      lastRefreshRef.current = now;

      try {
        setTwitchStreamsMeta({ twitchLoading: true, twitchError: null });

        const url = `/api/twitch/streams?logins=${encodeURIComponent(
          twitchLogins.join(",")
        )}`;

        const r = await fetch(url, { signal: ctrl.signal });
        const json = (await r.json()) as { data: TwitchStream[]; error?: string };

        if (!r.ok) {
          setTwitchStreams({});
          setTwitchStreamsMeta({
            twitchLoading: false,
            twitchError: json?.error || "Failed to load Twitch live status.",
            twitchUpdatedAt: Date.now(),
          });
          return;
        }

        const map: Record<string, TwitchStream> = {};
        (json.data ?? []).forEach((s) => {
          map[normalizeTwitchLogin(s.login)] = s;
        });

        setTwitchStreams(map);
        setTwitchStreamsMeta({
          twitchLoading: false,
          twitchError: null,
          twitchUpdatedAt: Date.now(),
        });
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === "AbortError") return;

        setTwitchStreamsMeta({
          twitchLoading: false,
          twitchError: "Failed to load Twitch live status.",
          twitchUpdatedAt: Date.now(),
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    refresh({ force: true });

    const intervalId = window.setInterval(() => {
      refresh();
    }, refreshMs);

    const onFocus = () => {
      refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      ctrl.abort();
    };
  }, [twitchLogins, refreshMs, focusCooldownMs, setTwitchStreams, setTwitchStreamsMeta]);
};