---
feature: discovery/twitch-live
status: active
surfaces:
  - api/server.js:1458    # GET /api/twitch/streams
  - api/server.js:1512    # GET /api/twitch/users
  - api/server.js:219     # stream cache TTL 15s / user cache TTL 6h
  - src/hooks/useTwitchStreams.ts
  - src/pages/Live.tsx
unmatched_tier: 2
---

# Twitch Live Status — Support Playbook

The Live page shows which creators are streaming now. The API proxies Twitch,
caching stream data for 15 seconds and user data for 6 hours, with in-flight
request deduplication.

This is a **discovery convenience, not a transactional feature**. Nothing here
touches money or blocks a commission, so almost everything in this playbook is
low urgency — with one exception: a credentials failure takes out account
linking too, and that one is not cosmetic.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I'm live but not showing" | [`LIV-001`](#liv-001--live-status-is-stale-or-wrong) |
| "The Live page is empty" | [`LIV-002`](#liv-002--twitch-api-unavailable) |
| "Live has been broken all day" | [`LIV-003`](#liv-003--twitch-credentials-rejected) |

---

## `LIV-001` — Live status is stale or wrong

```yaml
id: LIV-001
tier: 2
signals:
  - source: user_report
    match: "creator is live on Twitch but not shown, or shown when offline"
auto_fix: none
reason_not_automatable: "usually cache latency resolving itself"
escalate_if:
  - "wrong for more than 5 minutes"
  - "affecting many creators at once"
```

**Cause.** Cache lag, usually. Streams are cached for 15 seconds, so a brief
mismatch is expected. A persistent one means the creator's Twitch link is stale
or missing, which is really
[`twitch-linking.md`](../auth/twitch-linking.md) presenting here.

**Fix.** Wait out the cache. If it persists, check the linked account — a
creator who changed or renamed their Twitch account will never show as live.

**Money impact.** None. Reduced discovery for that creator.

---

## `LIV-002` — Twitch API unavailable

```yaml
id: LIV-002
tier: 2
signals:
  - source: api
    match: "/Twitch streams failed \\(5\\d\\d\\)/"
  - source: api
    match: "/Twitch users failed \\(5\\d\\d\\)/"
  - source: api
    match: "/Token request failed \\(5\\d\\d\\)/"
auto_fix: none
reason_not_automatable: "upstream outage; nothing to fix on our side"
escalate_if:
  - "sustained beyond 15 minutes"
```

**Cause.** Twitch is having problems. 5xx responses are theirs.

**What the user sees.** An empty or stale Live page.

**Fix.** None. It resolves when Twitch recovers. Worth confirming against
Twitch's status page before investigating anything locally.

**Money impact.** None.

---

## `LIV-003` — Twitch credentials rejected

```yaml
id: LIV-003
tier: 3
signals:
  - source: api
    match: "/Token request failed \\(401|403\\)/"
  - source: api
    match: "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET"
auto_fix: none
reason_not_automatable: "configuration; affects every user"
escalate_with:
  - "which variables are present"
  - "whether credentials were recently rotated"
```

**Cause.** Credentials missing, expired, or revoked.

**Why Tier 3 despite Live being non-critical.** The same credentials power
account linking. A 401 here means creators cannot verify their identity either —
see [`twitch-linking.md`](../auth/twitch-linking.md) `TWL-004`. The visible
symptom is a cosmetic page; the actual impact is verification being down.

**Fix.** Restore the credentials.

**Money impact.** None directly. Creator verification is blocked, and
verification is a trust feature the product sells on.

---

## Known gaps

- **No alerting on Live page failures.** Everything here is discovered by a user
  mentioning it.
- **Cache has no negative-result handling documented** — whether a failed
  upstream call is cached, and for how long, is not specified.
- **The 100-login cap** on the streams endpoint is not documented as a scaling
  limit. Past that many linked creators, some will silently never appear.
- **Only Twitch is implemented.** YouTube and Kick creators have no live status
  at all.
