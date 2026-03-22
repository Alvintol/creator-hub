import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";

// Allow local dev. If you use Vite proxy (recommended), CORS won’t matter much.
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

async function getAppAccessToken() {
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
  cachedTokenExpMs = now + (json.expires_in * 1000);
  return cachedToken;
}

// GET /api/twitch/streams?logins=a,b,c
app.get("/api/twitch/streams", async (req, res) => {
  try {
    const loginsParam = String(req.query.logins || "").trim();
    const logins = loginsParam
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 100);

    if (logins.length === 0) {
      return res.json({ data: [] });
    }

    const token = await getAppAccessToken();

    const url = new URL("https://api.twitch.tv/helix/streams");
    for (const login of logins) url.searchParams.append("user_login", login);

    const r = await fetch(url.toString(), {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }

    const json = await r.json();

    // Return a slim, stable payload to the frontend
    const data = (json.data || []).map((s) => ({
      login: s.user_login,
      displayName: s.user_name,
      isLive: true,
      title: s.title,
      gameName: s.game_name,
      viewerCount: s.viewer_count,
      startedAt: s.started_at,
      thumbnailUrl: s.thumbnail_url,
    }));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/users?logins=a,b,c
app.get("/api/twitch/users", async (req, res) => {
  try {
    const loginsParam = String(req.query.logins || "").trim();
    const logins = loginsParam
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 100);

    if (logins.length === 0) return res.json({ data: [] });

    const token = await getAppAccessToken();

    const url = new URL("https://api.twitch.tv/helix/users");
    for (const login of logins) url.searchParams.append("login", login);

    const r = await fetch(url.toString(), {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }

    const json = await r.json();
    const data = (json.data || []).map((u) => ({
      id: u.id,
      login: u.login,
      displayName: u.display_name,
      profileImageUrl: u.profile_image_url,
    }));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});