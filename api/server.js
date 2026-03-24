import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";

// Allow local dev. If you use Vite proxy, CORS won’t matter much.
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

let cachedToken = null;
let cachedTokenExpMs = 0;

// Cache config
const STREAMS_CACHE_TTL_MS = 15_000;
const STREAMS_CACHE_MAX = 250;

const USERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const USERS_CACHE_MAX = 500;

const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

// Caches
const streamsCache = new Map(); // key -> { expMs, value }
const streamsInflight = new Map(); // key -> Promise<value>

const usersCache = new Map();
const usersInflight = new Map();

const nowMs = () => Date.now();

const normalizeLogins = (loginsParam) => {
  return String(loginsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .slice(0, 100);
};

const pruneOldest = (cache, maxEntries) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

const cleanupExpired = (cache) => {
  const now = nowMs();
  for (const [key, entry] of cache.entries()) {
    if (!entry || typeof entry.expMs !== "number" || now > entry.expMs) {
      cache.delete(key);
    }
  }
};

// Touch-on-hit: moves the entry to the end of the Map so hot keys are kept longer
const getCached = (cache, key) => {
  const hit = cache.get(key);
  if (!hit) return null;

  if (nowMs() > hit.expMs) {
    cache.delete(key);
    return null;
  }

  // LRU-ish behavior: reinsert to refresh insertion order
  cache.delete(key);
  cache.set(key, hit);

  return hit.value;
};

const setCached = (cache, key, value, ttlMs, maxEntries) => {
  cache.set(key, { expMs: nowMs() + ttlMs, value });
  pruneOldest(cache, maxEntries);
};

const getOrSetInflight = async (cache, inflight, key, ttlMs, maxEntries, fetcher) => {
  const cached = getCached(cache, key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const value = await fetcher();
    setCached(cache, key, value, ttlMs, maxEntries);
    return value;
  })();

  inflight.set(key, p);

  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
};

const getAppAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpMs - 30_000) return cachedToken; // 30s buffer

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const r = await fetch(url.toString(), { method: "POST" });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Token request failed (${r.status}): ${text}`);
  }

  const json = await r.json();
  cachedToken = json.access_token;
  cachedTokenExpMs = now + json.expires_in * 1000;
  return cachedToken;
};

// Periodic cleanup + size enforcement
const cleanupTick = () => {
  cleanupExpired(streamsCache);
  cleanupExpired(usersCache);

  // Safety: enforce hard caps even if lots of non-expired keys exist
  pruneOldest(streamsCache, STREAMS_CACHE_MAX);
  pruneOldest(usersCache, USERS_CACHE_MAX);
};

// run once on boot
cleanupTick();

// run periodically (won’t keep Node alive if nothing else is running)
const cleanupInterval = setInterval(cleanupTick, CACHE_CLEANUP_INTERVAL_MS);
if (typeof cleanupInterval.unref === "function") cleanupInterval.unref();

// GET /api/twitch/streams?logins=a,b,c
app.get("/api/twitch/streams", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `streams:${logins.join(",")}`;

    const data = await getOrSetInflight(
      streamsCache,
      streamsInflight,
      cacheKey,
      STREAMS_CACHE_TTL_MS,
      STREAMS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/streams");
        logins.forEach((login) => url.searchParams.append("user_login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch streams failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((s) => ({
          login: s.user_login,
          displayName: s.user_name,
          isLive: true,
          title: s.title,
          gameName: s.game_name,
          viewerCount: s.viewer_count,
          startedAt: s.started_at,
          thumbnailUrl: s.thumbnail_url,
        }));
      }
    );

    res.setHeader("Cache-Control", "public, max-age=15");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/users?logins=a,b,c
app.get("/api/twitch/users", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `users:${logins.join(",")}`;

    const data = await getOrSetInflight(
      usersCache,
      usersInflight,
      cacheKey,
      USERS_CACHE_TTL_MS,
      USERS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/users");
        logins.forEach((login) => url.searchParams.append("login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch users failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((u) => ({
          id: u.id,
          login: u.login,
          displayName: u.display_name,
          profileImageUrl: u.profile_image_url,
        }));
      }
    );

    // short browser cache; server cache is the main benefit
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});