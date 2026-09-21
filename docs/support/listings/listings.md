---
feature: listings
status: active
surfaces:
  - public.listings
  - supabase/migrations/20260921_116_exempt_free_listings_from_payout_readiness.sql
  - src/hooks/listings/listingPaymentAccountGuards.ts
  - src/hooks/listings/
  - src/pages/listings/
unmatched_tier: 2
---

# Listings — Support Playbook

Listings are what creators sell. They carry drafts, publication controls, and
revision history, and a database trigger blocks publishing an active **paid**
listing unless the creator's payout account is ready. Free listings are exempt —
they never touch Stripe.

That trigger is the most common source of confusion in this feature: a creator
who believes their Stripe setup is done gets a publish error that says nothing
about Stripe being stale.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't publish my listing" | [`LST-001`](#lst-001--publish-blocked-by-payout-readiness) |
| "My listing disappeared" | [`LST-002`](#lst-002--listing-hidden-by-moderation) |
| "Buyers say the listing is unavailable" | [`LST-003`](#lst-003--listing-not-found-or-unavailable) |
| "I can't restore my listing" | [`LST-002`](#lst-002--listing-hidden-by-moderation) |

---

## `LST-001` — Publish blocked by payout readiness

```yaml
id: LST-001
tier: 1
signals:
  - source: db
    match: "Creator payout account must be ready before publishing active listings."
    where: supabase/migrations/20260921_116_exempt_free_listings_from_payout_readiness.sql
auto_fix: resync_connect_account
params:
  user_id: "$.listing.user_id"
verify:
  - "creator_payment_accounts.charges_enabled = true"
retry_limit: 1
escalate_if:
  - "Stripe confirms the account is genuinely not ready"   # -> connect CON-004
  - "no Stripe account exists for this creator"            # -> connect CON-002
  - "the listing is free (is_free = true)"                 # -> should be exempt; see below
```

**Cause.** The trigger checks `has_ready_creator_payment_account`, which reads
our mirror of Stripe. Since nothing refreshes that mirror automatically, a
creator who finished onboarding and did not revisit their settings page is still
recorded as not ready.

**Free listings are exempt** and must never produce this signal. A free listing
serves an uploaded file or an external link and never touches Stripe, so it
publishes with no connected account at all. If this error appears for a listing
with `is_free = true`, the exemption is not working — that is a regression, not a
stale mirror, and it blocks a creator who may have no reason to onboard with
Stripe ever.

**What the user sees.** A publish failure telling them their payout account is
not ready, when as far as they are concerned it is. This is the single most
likely stale-mirror symptom, because publishing is the first thing a newly
onboarded creator does.

**Fix.** Re-sync from Stripe, then retry the publish. See
[`connect-onboarding.md`](../payments/connect-onboarding.md) `CON-001` for the
underlying issue.

**Money impact.** None, but the creator cannot sell.

---

## `LST-002` — Listing hidden by moderation

```yaml
id: LST-002
tier: 2
signals:
  - source: db
    match: "Only admins can hide listings."
  - source: db
    match: "Only admins can restore listings."
  - source: db
    match: "Only published listings can be restored to public visibility."
  - source: user_report
    match: "creator reports their listing vanished"
auto_fix: none
reason_not_automatable: "moderation decisions are human; the agent may not write listings"
escalate_with:
  - "the listing's status and any linked moderation report"
  - "whether the creator was notified"
```

**Cause.** An admin hid the listing, usually from a report. The restore
constraint means a listing must be `published` to return to public visibility —
a draft cannot be restored into view.

**What the user sees.** Their listing gone, often without knowing why.

**Fix.** Human review. **The agent may not write to `listings`** under any tier.

**Worth noting.** If creators are finding out by discovering the absence rather
than by being told, that is a gap in the moderation flow rather than a support
case — see [`messaging/moderation.md`](../messaging/moderation.md).

**Money impact.** None directly; the creator's income from that listing stops.

---

## `LST-003` — Listing not found or unavailable

```yaml
id: LST-003
tier: 2
signals:
  - source: db
    match: "Listing not found or unavailable."
  - source: db
    match: "Listing not found."
  - source: db
    match: "Listing is not available for messages."
auto_fix: none
reason_not_automatable: "usually correct behaviour; volume is the only actionable signal"
escalate_if:
  - "a spike against many distinct listing ids"    # -> tier 3, enumeration
escalate_with:
  - "the listing ids requested and whether they exist at all"
```

**Cause.** The listing was unpublished, deleted, hidden, or never existed. Also
produced when someone tries to start a conversation about a listing that is no
longer open to messages.

**What the user sees.** A dead link — often a shared or bookmarked one.

**Fix.** Usually none needed. A buyer with a stale link needs a current one.

**Escalate on a spike across many ids.** Scattered misses are stale links. A
sweep through listing ids is someone enumerating the catalogue.

**Money impact.** None directly. A buyer hitting a dead listing is a lost sale
that nobody hears about.

---

## Known gaps

- **Readiness is only enforced at write time.** The trigger fires on insert and
  update of `listings`. A creator who becomes unready afterwards keeps their
  listings live, and nothing re-checks. See
  [`connect-onboarding.md`](../payments/connect-onboarding.md) `CON-003`.
- **A free listing flipped to paid is only checked at that write.** The trigger
  now watches `is_free`, so the flip is caught — but the same write-time
  limitation above still applies afterwards.
- **Revision-history failure modes are undocumented.** The feature exists; its
  failures fall through to unmatched Tier 2.
- **Listing media/upload failures are undocumented.**
- **No creator notification on moderation hide** is documented, so `LST-002`
  cases arrive as confusion rather than as questions about a known action.
