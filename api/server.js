import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";

const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || "";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:5173";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Allow local dev. If you use Vite proxy, CORS won’t matter much.
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

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

const getBearerToken = (req) => {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const requireSupabaseUserId = async (req) => {
  if (!supabaseAdmin) throw new Error("Supabase admin not configured");

  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization bearer token");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid session");

  return data.user.id;
};

const signState = (payload) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${sig}`;
};

const verifyState = (state) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const [data, sig] = String(state || "").split(".");
  if (!data || !sig) throw new Error("Bad state");

  const expected = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  if (sig !== expected) throw new Error("State signature mismatch");

  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!payload?.uid || !payload?.exp) throw new Error("Bad state payload");
  if (Date.now() > payload.exp) throw new Error("State expired");

  return payload;
};

const isAtLeastOneYearOld = (createdAtIso) => {
  const createdMs = Date.parse(String(createdAtIso || ""));
  if (!Number.isFinite(createdMs)) return false;

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs >= ONE_YEAR_MS;
};

const getTwitchAuthorizeUrl = (state) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_REDIRECT_URI) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_REDIRECT_URI");
  }

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user:read:email");
  url.searchParams.set("state", state);

  return url.toString();
};

const exchangeCodeForToken = async (code) => {
  if (!TWITCH_CLIENT_SECRET) throw new Error("Missing TWITCH_CLIENT_SECRET");

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("code", String(code || ""));
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);

  const r = await fetch(url.toString(), { method: "POST" });
  const text = await r.text();

  if (!r.ok) throw new Error(`Token exchange failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  if (!json?.access_token) throw new Error("No access_token from Twitch");

  return json.access_token;
};

const fetchTwitchMe = async (userAccessToken) => {
  const r = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Twitch users failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  const u = (json.data || [])[0];
  if (!u?.id || !u?.login) throw new Error("No Twitch user returned");

  return u; // includes created_at
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

// POST /api/twitch/connect/start
app.post("/api/twitch/connect/start", async (req, res) => {
  try {
    const uid = await requireSupabaseUserId(req);

    const state = signState({
      uid,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const url = getTwitchAuthorizeUrl(state);
    return res.json({ url });
  } catch (err) {
    return res.status(401).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/connect/callback
app.get("/api/twitch/connect/callback", async (req, res) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase admin not configured");

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code) throw new Error("Missing code");

    const { uid } = verifyState(state);

    const token = await exchangeCodeForToken(code);
    const me = await fetchTwitchMe(token);

    const ageOk = isAtLeastOneYearOld(me.created_at);

    const patch = {
      profile_user_id: uid,
      platform: "twitch",
      platform_user_id: me.id,
      platform_login: me.login,
      platform_display_name: me.display_name ?? me.login,
      profile_url: `https://twitch.tv/${me.login}`,
      account_created_at: me.created_at,
      connected_at: new Date().toISOString(),
      metadata: {
        age_ok: ageOk,
        email: me.email ?? null,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("profile_platform_accounts")
      .upsert(patch, {
        onConflict: "profile_user_id,platform",
      });

    if (error) throw new Error(error.message);

    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "connected");
    next.searchParams.set("age_ok", ageOk ? "1" : "0");
    return res.redirect(next.toString());
  } catch (err) {
    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "error");
    next.searchParams.set("msg", String(err?.message || err));
    return res.redirect(next.toString());
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});