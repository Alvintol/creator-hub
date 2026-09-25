---
feature: payments/connect-onboarding
status: active
surfaces:
  - api/server.js                                    # POST /api/stripe/connect/sync, POST /api/stripe/connect/account-session, getOrCreateStripeAccountForEmbeddedConnect, setStripeConnectDailyPayoutSchedule, deriveCreatorPaymentAccountReadinessFromV2Account
  - src/hooks/payments/useStripeConnectAccountSession.ts
  - public.creator_payment_accounts
  - supabase/migrations/20260622_107_require_payment_account_for_active_listings.sql
unmatched_tier: 2
---

# Stripe Connect Onboarding — Support Playbook

> **2026-09-22: migrated from Stripe Accounts v1 to v2.** `POST
> /api/stripe/connect/start` (Stripe-hosted Account Link onboarding, v1
> `type: "express"` accounts) was removed as dead code — nothing in `src/`
> ever called it. The only live onboarding path was always
> `POST /api/stripe/connect/account-session` (embedded components), which now
> creates **Accounts v2** accounts matching the platform's own Connect
> configuration (`fees_collector`/`losses_collector: "stripe"`, `dashboard:
> "none"`). This is also why the creator, not the platform, now bears
> Stripe's 2.9%+CA$0.30 processing fee — see `launch-scope.md` §3.2. The
> readiness fields this playbook discusses (`charges_enabled`,
> `payouts_enabled`, `details_submitted`) are unchanged in shape; they are
> now derived from v2 capability statuses
> (`deriveCreatorPaymentAccountReadinessFromV2Account`) instead of read
> directly off a v1 Account object, but nothing downstream — the readiness
> trigger, the frontend, this playbook's detection queries — needed to
> change.

Creators must connect a Stripe account before they can publish an active listing
or receive a payment. Made for Stream keeps a mirror of each creator's account state
in `creator_payment_accounts` — `charges_enabled`, `payouts_enabled`,
`details_submitted` — and a database trigger blocks publishing when that mirror
says the creator is not ready.

**The mirror is the weak point of this whole feature.** Nothing refreshes it
automatically. It updates only when the creator loads their settings page and the
client calls the sync endpoint. Stripe sends `account.updated` when an account's
capabilities change, and Made for Stream currently ignores that event entirely.

So the mirror drifts in both directions, and both are bad:

- **Stale-stale:** the creator finished onboarding, we still think they have not.
  They cannot publish; buyers are told they cannot accept payments.
- **Stale-fresh:** Stripe restricted the creator, we still think they are fine.
  Their listings stay live and buyers open checkouts that will fail.

Most of this playbook is about that drift.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I finished Stripe but can't publish" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked) |
| "It says I need to connect payouts, I already did" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked) |
| "Buyers say I can't accept payments" | [`CON-001`](#con-001--creator-finished-onboarding-but-is-still-blocked), [`CON-003`](#con-003--stripe-restricted-an-account-and-we-did-not-notice) |
| "Stripe is asking for more documents" | [`CON-004`](#con-004--stripe-requires-additional-verification) |
| "I can't start Stripe onboarding at all" | [`CON-002`](#con-002--creator-is-not-approved-yet) |

---

## `CON-001` — Creator finished onboarding but is still blocked

```yaml
id: CON-001
tier: 1
signals:
  - source: api
    match: "Creator has not connected Stripe payouts."
  - source: api
    match: "Creator Stripe account is not ready for payments."
  - source: db
    match: "Creator payout account must be ready before publishing active listings."
  - source: db
    where: public.creator_payment_accounts
    match: "charges_enabled = false AND last_synced_at < now() - interval '1 hour'"
auto_fix: resync_connect_account
params:
  user_id: "$.creator_user_id"
verify:
  - "creator_payment_accounts.last_synced_at advanced"
  - "charges_enabled reflects the live Stripe account"
retry_limit: 2
escalate_if:
  - "Stripe confirms charges_enabled is genuinely false"   # -> CON-004
  - "no Stripe account exists for this user"               # -> CON-002
```

**Cause.** Our mirror is stale. The creator completed onboarding in Stripe but
nothing told us. Because only the settings page triggers a sync, a creator who
finishes onboarding and navigates away can stay blocked indefinitely.

**What the user sees.** They completed everything Stripe asked for, and
Made for Stream still behaves as though they have not. From their side this looks like
the product is broken, and they are right.

**Fix.** Re-sync from Stripe. If they are ready, this unblocks them immediately.

**If Stripe says they are genuinely not ready**, this is not stale data — it is
[`CON-004`](#con-004--stripe-requires-additional-verification), and the creator
has outstanding requirements.

**Money impact.** None directly, but the creator cannot publish or sell. For a
marketplace, a creator blocked at onboarding is a creator who leaves.

---

## `CON-002` — Creator is not approved yet

```yaml
id: CON-002
tier: 2
signals:
  - source: api
    match: "Only approved creators can connect Stripe payouts."
    where: api/server.js  # requireApprovedCreator
auto_fix: none
reason_not_automatable: "approval is a human decision and must stay one"
escalate_with:
  - "the creator's seller_applications status"
  - "how long it has been in that status"
```

**Cause.** Stripe onboarding requires an `approved` row in `seller_applications`.
The creator is applying before approval, or their application is still pending.

**What the user sees.** They cannot start payout setup, usually without
understanding that approval comes first.

**Fix.** None technical. Either the application needs reviewing, or the creator
needs telling where they are in the queue. **The agent must never approve an
application** — that is on the forbidden list.

**Why it is Tier 2 and not just noise.** A backlog of these is a signal that
applications are not being reviewed, which is a business problem worth surfacing
even though each individual case is working as designed.

**Money impact.** None.

---

## `CON-003` — Stripe restricted an account and we did not notice

```yaml
id: CON-003
tier: 2
signals:
  - source: stripe
    match: "account.updated with charges_enabled false or requirements.disabled_reason set"
  - source: db
    where: public.creator_payment_accounts
    match: "charges_enabled = true AND last_synced_at < now() - interval '7 days'"
auto_fix: none
reason_not_automatable: "the resync is safe, but removing a creator's live listings is a business decision"
escalate_with:
  - "the creator's active listing count"
  - "any in-flight requests and their payment states"
  - "the Stripe disabled_reason and outstanding requirements"
  - "money currently held against this creator"
```

**Cause.** Stripe restricted or disabled the account — verification lapsed, a
document expired, or risk review. `account.updated` is **not handled**, so
nothing updates our mirror and nothing alerts. The creator keeps live listings
and buyers keep opening checkouts that fail at
[`PAY-003`](checkout.md#pay-003--creator-cannot-accept-payments-yet).

**What the user sees.** Buyers see a creator who cannot accept payments. The
creator often does not know anything is wrong until a buyer tells them.

**Fix.** Re-sync to record reality, then decide what to do about the listings.
The agent may run the resync, but the consequence — a creator losing readiness
while holding live listings — is an escalation, because unpublishing someone's
listings is a business call with real consequences for them.

**Money impact.** In-flight projects with outstanding payments are stuck. If the
restriction affects payouts rather than charges, money may be captured and
unpayable, which is worse and needs urgent attention.

**Why this is a launch blocker.** Without `account.updated` handling, the only
thing standing between a restricted creator and a broken buyer experience is
somebody noticing. That does not scale past a handful of creators.

---

## `CON-004` — Stripe requires additional verification

```yaml
id: CON-004
tier: 2
signals:
  - source: stripe
    match: "account.requirements.currently_due is non-empty"
  - source: db
    where: public.creator_payment_accounts
    match: "details_submitted = true AND charges_enabled = false"
auto_fix: none
reason_not_automatable: "only the creator can satisfy Stripe requirements"
escalate_with:
  - "the specific currently_due and past_due requirement list"
  - "the Stripe deadline, if one is set"
```

**Cause.** Normal Stripe behaviour. Accounts hit verification thresholds as
volume grows, and Stripe asks for identity documents, a bank account, or
business details.

**What the user sees.** They submitted everything and are still not enabled,
with no clear explanation on the Made for Stream side.

**Fix.** The creator completes the requirements in Stripe. Support's job is to
tell them *specifically* what is outstanding — the requirement list is readable
from the account, and a precise ask resolves far faster than "check Stripe".

**Money impact.** None yet, but there may be a deadline after which Stripe
disables the account, at which point it becomes `CON-003`.

---

## `CON-005` — Invalid country or currency on the account

```yaml
id: CON-005
tier: 2
signals:
  - source: api
    match: "A valid two-letter country code is required."
  - source: api
    match: "A valid three-letter currency code is required."
auto_fix: none
reason_not_automatable: "indicates a data problem in the account record"
escalate_with:
  - "the raw country and default_currency from the Stripe account"
```

**Cause.** The Stripe account returned a country or currency that failed
validation during upsert. In practice this means an unexpected account shape, not
a user error.

**What the user sees.** Onboarding or sync fails with an opaque error.

**Fix.** Manual investigation.

**Money impact.** None yet.

**Unsupported but valid currency.** Since `20260923_138` the account-session
route also refuses a well-formed currency that is not enabled, with HTTP 400 and
[`AGR-006`](../requests/agreements.md#agr-006--the-projects-currency-is-not-supported)'s
message. The payout-settings form now offers only enabled currencies, so this
needs a stale client or a direct API call.

---

## Known gaps

- **No account-requirement-change webhook is handled.** This is the single
  largest gap in this feature. Everything in `CON-003` is currently detected
  by a human noticing. For v2 accounts (since 2026-09-22) the equivalent is
  not `account.updated` but a **thin event** —
  `v2.core.account[requirements].updated` and
  `v2.core.account[configuration.merchant].capability_status_updated` —
  requiring a separate event destination in the Stripe Dashboard (Developers
  → Webhooks → thin events) and `stripe.v2.core.events.retrieve(thinEvent.id)`
  to fetch the full payload. Registering it is gated on §11.1 (where
  `api/server.js` runs in production) the same as the main webhook — not
  built in this session.
- **No scheduled resync.** Nothing refreshes `creator_payment_accounts` on a
  timer, so a creator who never revisits settings has a mirror that is as old as
  their last visit.
- **No staleness alerting.** The queries in `CON-001` and `CON-003` are written
  here but nothing runs them.
- **Readiness is checked at publish time, not continuously.** The trigger fires
  on insert and update of `listings`. A creator who becomes unready *after*
  publishing keeps their listings live, and nothing re-checks.
- Non-US, non-USD onboarding is untested end to end.
