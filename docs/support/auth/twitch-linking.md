---
feature: auth/twitch-linking
status: active
surfaces:
  - api/server.js:1563    # POST /api/twitch/connect/start
  - api/server.js:1580    # GET  /api/twitch/connect/callback
  - public.profile_platform_accounts
unmatched_tier: 2
---

# Twitch Account Linking — Support Playbook

Creators link a Twitch account to prove who they are and to power the "Live now"
surface. The flow is a signed-state OAuth round trip: Made for Stream issues a state
token bound to the user id with an expiry and an HMAC signature, Twitch redirects
back with it, and the callback verifies the signature and expiry before storing
the account.

Linking is **not** sign-in — see [`sign-in.md`](sign-in.md) for that. A failure
here does not lock anyone out; it blocks verification and live status.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "It failed when I came back from Twitch" | [`TWL-001`](#twl-001--state-expired), [`TWL-002`](#twl-002--state-signature-mismatch) |
| "I took a while and it broke" | [`TWL-001`](#twl-001--state-expired) |
| "Linking is broken for everyone" | [`TWL-004`](#twl-004--twitch-credentials-missing-or-rejected) |
| "My live status is wrong" | [`discovery/twitch-live.md`](../discovery/twitch-live.md) |

---

## `TWL-001` — State expired

```yaml
id: TWL-001
tier: 2
signals:
  - source: api
    match: "State expired"
    where: api/server.js  # twitch connect callback
auto_fix: none
reason_not_automatable: "self-service retry; expiry is working as designed"
escalate_if:
  - "reported within a minute of starting the flow"   # clock or TTL problem
```

**Cause.** The user took too long on Twitch — paused at the consent screen, got
distracted, or went to log into Twitch first and came back much later.

**What the user sees.** An error on return from Twitch, with the link not made.

**Fix.** Start again and complete it in one go. Being logged into Twitch
beforehand avoids most of these.

**Escalate on fast failures.** A state that expires almost immediately means a
server clock problem or a TTL that is too short, and that would affect everyone.

**Money impact.** None.

---

## `TWL-002` — State signature mismatch

```yaml
id: TWL-002
tier: 2
signals:
  - source: api
    match: "State signature mismatch"
  - source: api
    match: "Bad state"
  - source: api
    match: "Bad state payload"
auto_fix: none
reason_not_automatable: "tampering cannot be distinguished from corruption without looking"
escalate_if:
  - "repeated from the same source"                    # -> tier 3
  - "any spike in volume"                              # -> tier 3
escalate_with:
  - "the raw state value received"
  - "source IP and user agent"
  - "whether OAUTH_STATE_SECRET changed recently"
```

**Cause.** Three possibilities, and they need distinguishing. Benign: the state
was mangled in transit, or `OAUTH_STATE_SECRET` was rotated while a flow was in
progress, invalidating every outstanding state. Not benign: someone is crafting
state values to bind a Twitch account to an account that is not theirs.

**Why that matters.** The whole point of linking is proving identity. A forged
link would let someone claim another creator's Twitch presence — which is
exactly the impersonation problem Made for Stream exists to prevent. Treat repetition
as hostile until shown otherwise.

**Fix.** For the benign case, retry. A secret rotation resolves itself once
in-flight states age out.

**Money impact.** None directly, but a successful forgery is a trust failure at
the core of the product.

---

## `TWL-003` — Twitch returned no usable account

```yaml
id: TWL-003
tier: 2
signals:
  - source: api
    match: "No access_token from Twitch"
  - source: api
    match: "No Twitch user returned"
  - source: api
    match: "Missing code"
  - source: api
    match: "/Token exchange failed \\(\\d+\\)/"
auto_fix: none
reason_not_automatable: "upstream failure; cause is in the Twitch response"
escalate_if:
  - "sustained failures"                               # -> tier 3, Twitch integration down
escalate_with:
  - "the HTTP status and body from the Twitch response"
```

**Cause.** The user declined consent (produces a missing code, and is benign), or
Twitch rejected the token exchange, or Twitch is having problems.

**Distinguish by status code.** A 4xx from Twitch points at our credentials or
redirect configuration. A 5xx is theirs and will resolve on its own.

**Fix.** Retry for transient cases. For sustained 4xx, check the Twitch app
configuration — see [`TWL-004`](#twl-004--twitch-credentials-missing-or-rejected).

**Money impact.** None.

---

## `TWL-004` — Twitch credentials missing or rejected

```yaml
id: TWL-004
tier: 3
signals:
  - source: api
    match: "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET"
  - source: api
    match: "Missing TWITCH_CLIENT_ID or TWITCH_REDIRECT_URI"
  - source: api
    match: "OAUTH_STATE_SECRET missing"
  - source: api
    match: "/Token request failed \\(401|403\\)/"
auto_fix: none
reason_not_automatable: "configuration; affects every user"
escalate_with:
  - "which variables are absent"
  - "whether the API was recently redeployed"
```

**Cause.** Environment variables missing or wrong. Almost always a deploy or a
credential rotation.

**Why Tier 3 on the first occurrence.** This is not a per-user failure — linking
and live status are broken for everyone simultaneously. Impact, not count,
determines the tier.

**Fix.** Restore the configuration. `TWITCH_REDIRECT_URI` must match the Twitch
app console exactly, including scheme and trailing slash.

**Money impact.** None, but creator verification and the Live page are both down.

---

## Known gaps

- **No alerting on linking failure rates.** `TWL-002` in particular relies on
  someone noticing a pattern, and it is the one entry here with a security edge.
- **No unlink-and-relink support flow** documented for a creator who changes
  Twitch accounts or has a stale link.
- **No handling for a revoked Twitch authorization.** If a user revokes access on
  Twitch's side, the stored link goes stale and nothing detects it — the same
  staleness pattern as
  [`connect-onboarding.md`](../payments/connect-onboarding.md) `CON-003`.
- Only Twitch is implemented. The product describes YouTube and Kick creators;
  neither has a linking flow, so neither has failure modes yet.
