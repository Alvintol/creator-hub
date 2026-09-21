# Launch Scope — Made for Stream

> **Status:** proposed for approval. This document is the specification the first
> paid launch is built against. Where it disagrees with a published policy or with
> the code, the disagreement is named explicitly and a resolution is recommended.
>
> Decisions marked **NEEDS YOUR CALL** are not resolved here.

The goal of the first launch is one thing working end to end: a buyer in a
supported currency commissions a creator, pays through Stripe Connect, the work is
delivered, and — if it goes wrong — there is a defined way to cancel and get money
back. Everything not required for that sentence is out of scope.

---

## 1. Supported countries, currencies and payment methods

### 1.1 Creators

| | Launch |
| --- | --- |
| Creator countries | **CA, US** |
| Creator currencies | **CAD, USD** |
| Currency selection | Pinned to the creator's Stripe connected account `default_currency`. Not separately choosable per listing or agreement. |

**Why these two.** The fee minimums are stored as integer minor units
(`buyer_service_fee_minimum_cents = 100`, `creator_platform_fee_minimum_cents = 150`,
in `20260624_108_add_listing_request_payments.sql`) and applied without regard to
currency in `ensure_listing_request_payment_for_schedule_item`
(`20260905_110_bridge_payment_schedule_to_stripe_payments.sql`). That arithmetic is
correct for any currency with a 100-subunit major unit and comparable purchasing
power. CAD and USD are both, which is why the published fee schedule can name
"CAD 1.00 / USD 1.00" and "CAD 1.50 / USD 1.50" as separate fixed amounts and be
accurate. It is silently wrong for JPY (no minor unit — 100 "cents" is ¥100) and
economically wrong for anything materially weaker.

**Correction to `AGENTS.md`.** It states "Fee minimums are USD-denominated." They
are not: they are *minor-unit-denominated*, which is why they work unchanged for
CAD. The published fee schedule is right and `AGENTS.md` is the document that needs
the edit. (`AGENTS.md` is gitignored, so that change is not in this PR.)

**Gap this closes.** `src/components/settings/CreatorPayoutSettings.tsx` ships
free-text `maxLength={2}` country and `maxLength={3}` currency inputs, and
`POST /api/stripe/connect/start` (`api/server.js`) accepts whatever they contain
against a regex only. A creator can type `GB`/`gbp` today and get a connected
account whose payments will be charged a GBP 1.00 buyer fee and a GBP 1.50 creator
fee that nobody has ever validated. Both surfaces become allowlists.

**Recommendation:** enforce the allowlist at all three layers — a `<select>` in the
UI, a server-side allowlist in `/api/stripe/connect/start`, and a check constraint
on `creator_payment_accounts.country` / `.default_currency`. UI-only is not a
boundary (`AGENTS.md`, Security boundaries).

### 1.2 Buyers

| | Launch |
| --- | --- |
| Buyer countries | **Unrestricted** |
| Buyer currency | The creator's currency. The buyer's bank converts. |

**Why unrestricted.** These are direct charges on the creator's connected account.
Stripe already decides which cards that account can accept; adding our own country
gate costs sales and prevents nothing. Fee Schedule §6 already states that a bank
may convert and apply its own rate, and that a converted refund can differ from the
converted debit — which is the correct and honest description of this design.

**One consequence to resolve before launch.** Refund Policy §1 grants EU/UK
consumers a 14-day distance-contract withdrawal right and states that losing it for
a commissioned service "requires the applicable express consent, acknowledgement and
confirmation." The product never captures that consent. Either we restrict buyers
(losing the sales) or we capture it.

**Recommendation: capture it.** At buyer acceptance of the project agreement, record
an express request to begin work before the withdrawal period expires, reusing the
existing `policy_acceptances` table (`20260917_113`, hardened by `20260919_114`).
This is a checkbox plus one recorded row, it is far cheaper than a geo-gate, and
without it the earned-value rules in Refund Policy §4 are unenforceable against
exactly the buyers the policy contemplates.

### 1.3 Payment methods

| | Launch |
| --- | --- |
| Accepted | **Cards only**, explicitly. Apple Pay and Google Pay ride the same rail and stay on. |
| Not accepted | Bank debits, bank transfers, BNPL, vouchers, and every other delayed-notification method. |

**Why.** Checkout currently passes no `payment_method_types`, so the session offers
whatever is enabled on each creator's connected account. Anything asynchronous lands
the payment in `processing`, and `processing` is a state the product handles badly
on purpose: `PAY-005` in the checkout playbook explicitly excludes it from the
`reconcile_checkout_session` auto-fix because those payments "legitimately take
days," and there is no buyer-facing copy, no creator-facing SLA, and no reminder for
a project frozen in it. Until there is, do not sell a payment method that produces
it.

**Recommendation:** set `payment_method_types: ["card"]` on the checkout session
rather than inheriting each creator's dashboard configuration.

---

## 2. Paid and free listing scope

| Offering | Launch state | Notes |
| --- | --- | --- |
| Commission request → agreement → payment → delivery | **Launch** | The whole product. Full prepayment, deposit + balance, and milestone schedules all ship. |
| Free listing — file download | **Launch** | `is_free` + `free_delivery_type = 'download'`, `free-assets` public bucket. Never touches Stripe. |
| Free listing — external link | **Launch** | `free_delivery_type = 'external_link'`. |
| Paid instant-download sale | **Later** | The `one_time` `payment_type` exists in the schema with no workflow behind it (checkout playbook, Known gaps). It stays unreachable. |

**Free listings stay limited to the `digital` offering type** (`allowsFreeListing`,
`src/domain/listings/listings.ts`).

**Blocking inconsistency.** `enforce_listing_payment_account_readiness`
(`20260622_107`) refuses to publish *any* active listing without a ready Stripe
connected account, and `20260919_115_add_free_listings.sql` did not exempt
`is_free`. A creator who only wants to give a file away must today complete full
Stripe identity onboarding — bank details, tax information — to publish something
that will never take a payment. That is a bad first experience with no
justification.

**Recommendation:** add `and new.is_free = false` to the readiness trigger's
condition. Free listings publish with no connected account; readiness continues to
apply the moment a listing is not free.

---

## 3. Fee calculation

Unchanged from the approved schedule. Written out here as the normative statement,
because the arithmetic currently exists only in PL/pgSQL.

For each **separately collected base payment** (starting payment, milestone, change
order, final balance), in minor units of the payment currency:

```
buyer_service_fee    = max( ceil(base * 5 / 100), 100 )
creator_platform_fee = max( ceil(base * 5 / 100), 150 )
application_fee      = buyer_service_fee + creator_platform_fee + platform_support
total_charged        = base + creator_tip + buyer_service_fee + platform_support
creator_receives     = base + creator_tip     (before Stripe's own costs)
```

- Tips carry no Made for Stream percentage and no minimum. They are added to the
  charge and excluded from the application fee, so they reach the creator.
- Optional platform support is added to the charge **and** to the application fee,
  so it reaches Made for Stream.
- Failed attempts and retries of the same unpaid obligation create no additional
  fee. This holds today because the fee is computed once, when the ledger row is
  created, not per checkout attempt.
- Minimums are per successful base payment, so splitting a project costs more. The
  fee schedule says this and gives the worked example.

This matches `ensure_listing_request_payment_for_schedule_item` exactly. The
calculation itself needs no code change.

### 3.1 Minimum base payment per instalment

**Decision: 10.00 minimum per instalment (CAD or USD), enforced when the payment
schedule is built.**

Below that, the fee floor dominates and the split becomes indefensible. The only
constraint enforced today is `application_fee_cents < total_checkout_cents`, which
permits a base of 2.50 — at which Made for Stream takes 2.50 and the creator
receives 0.00. Neither party is told this until checkout throws
`Payment amount % % is too small for the configured CreatorHub fee minimums`, which
reaches the buyer as "a generic failure when opening checkout" (`PAY-004`).

10.00 is already the worked example in the published fee schedule (buyer pays 11.00,
creator receives 8.50, platform takes 2.50 — 25%), so the number is disclosed before
this decision rather than after it.

**Recommendation:** validate the floor at agreement send time and again at schedule
item creation, with the real message ("Each payment must be at least $10.00"), and
leave the `PAY-004` guard where it is as a backstop.

---

## 4. Tips and optional platform support

**The conflict.** Fee Schedule §1 and §4 describe a buyer-chosen creator tip and a
buyer-chosen Made for Stream support contribution, with rules for how each is
refunded (Refund Policy §8: contributions are not auto-prorated on partial refunds
and are requestable back within 14 days). The columns exist (`creator_tip_cents`,
`platform_support_cents`), are read in `api/server.js`, and are displayed
conditionally on the checkout page. **Nothing writes them.** There is no input
control anywhere in the product, and the schedule-to-payment bridge hardcodes both
to `0`. Those two display branches can never render.

**Decision: remove tips and platform support from the launch fee schedule and refund
policy. Keep the columns, the arithmetic and the display branches.**

Publishing a policy describing an optional contribution the product cannot collect
is a promise we cannot keep and a support ticket we will answer repeatedly ("where
do I tip?"). Deleting two paragraphs is cheaper than building a tip control plus the
partial-refund contribution rules that come with it.

**If you would rather ship tips at launch,** it is a contained build — a tip input
on the checkout page and an API route that recomputes `total_checkout_cents` and
`application_fee_cents` and reissues the session (the existing idempotency key is
already keyed on `updated_at`, so it rotates correctly). But it pulls Refund Policy
§8's contribution rules into the refund engine's first release. Recommendation is to
defer to limited beta; say the word and it moves.

---

## 5. Cancellation

Nothing in the product can cancel anything. `cancelled` is a valid status on
agreements, payment schedule items, milestones, change orders and final deliveries,
and **no RPC writes it on any of them**. `listing_requests.status` does not even
have the value — it is `submitted | accepted | completed | declined | archived`
(`20260611_093`). `archive_my_listing_request` only works on a `submitted` request
that was never accepted.

### 5.1 Before any payment has been collected

Either party may cancel unilaterally. No settlement, no review.

| Object | Result |
| --- | --- |
| `listing_requests` | `cancelled` (new status value) with `cancelled_at`, `cancelled_by_user_id`, `cancellation_reason` |
| `listing_request_agreements` | `cancelled`, `cancelled_at` set |
| Payment schedule items | every `pending` / `payment_required` item → `cancelled` |
| `listing_request_payments` | every `requires_checkout` / `checkout_opened` row → `cancelled`; any open Stripe session expired through the API |
| Milestones, change orders, final delivery | `cancelled` |
| Conversation | stays open and readable; closed on the same rule as completion (`20260611_094`) |
| Delivered rights | none granted; nothing was paid for |

### 5.2 After any payment has been collected

Cancellation becomes a **proposal with a settlement**, never a unilateral act.

1. Either party opens a cancellation stating, per milestone, the earned value
   claimed, per Refund Policy §4 — completed conforming milestones may retain their
   agreed price; a partially completed one retains only the documented value of
   conforming work actually made available to the buyer.
2. The creator must stop avoidable new work on receipt and provide the itemised
   cancellation statement **within three business days** (Refund Policy §3).
3. The other party accepts or disputes.
4. **On acceptance:** unpaid schedule items are cancelled, refunds are issued for
   prepaid unearned amounts, the request moves to `cancelled`.
5. **On dispute:** it enters the support queue as Tier 2 with the evidence package
   already defined in `REF-001`. Made for Stream decides under Refund Policy §9.

**Cancellation never creates a new charge.** Any earned-but-unpaid amount is settled
outside the automatic flow, by agreement — Refund Policy §4 already says
"cancellation does not authorise a surprise charge."

### 5.3 Delivered rights on cancellation

- The buyer keeps the licence to each milestone whose payment is **retained** as
  earned value, on the usage terms stated in the agreement.
- The buyer must stop using and delete anything whose payment was **refunded**,
  except copies needed as evidence (Refund Policy §11).
- The creator gains no right to publish, reuse or resell the commissioned work
  unless the agreement grants it.

**Gap.** The agreement has no structured usage-rights field. `scope_summary`,
`included_deliverables` and `additional_cost_policy` are all free text
(`20260524_069`), and a search for `usage_rights` or `licen` across the migrations
returns nothing. The rights half of "what the buyer keeps" is therefore
unenforceable and uncitable in a dispute, while Refund Policy §4 repeatedly turns on
"the agreed usage rights."

**Recommendation:** add a required `usage_rights` field to the agreement with a
small enumerated set (personal use / creator's own channel use / commercial use /
exclusive with the buyer named as owner) plus a free-text qualifier, snapshotted
into the agreement version at acceptance.

### 5.4 A related inconsistency worth fixing in the same pass

`listing_request_agreements.included_revision_count` defaults to `0`, while Refund
Policy §5 says that if the agreement does not state a number, **two** rounds are
included per separately priced deliverable. A stored `0` is indistinguishable from
"not stated," so the policy's fallback can never be applied correctly.

**Recommendation:** make the column nullable with `null` meaning "not stated," and
have the product apply the two-round fallback when it is null.

---

## 6. Partial milestone refunds

The policy is written and it is good. The product cannot do any of it. From
`refunds-and-disputes.md`: no RPC, no API route, no webhook branch;
`charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` all fall
through `processStripeWebhookEvent` and are stored as `ignored`. `stripe_charge_id`
and `stripe_application_fee_id` are declared and never populated.

**A refund issued by hand in Stripe today leaves the Made for Stream record saying
`paid`.** That divergence, not the missing button, is the launch blocker.

### 6.1 Launch scope for refunds

| | Launch |
| --- | --- |
| Who can initiate | **Admin only** |
| Scope | Full and partial refunds of any `paid` payment |
| Fee treatment | Proportional, per Refund Policy §8 |
| Dispute handling | Webhook branches and visibility. No automated response. |
| Creator-initiated refunds | Later |
| Buyer self-service refund requests | Later — the request arrives by message and support acts |

Admin-only is the right first cut: the reversal of the application fee must happen
atomically with the base refund, and the money sits on the creator's account. One
correct path beats three.

### 6.2 Refund arithmetic

For a base refund of `r` against a payment with base `b`, where `cumulative_r` is
all base refunded on that payment including this one:

```
buyer_fee_refund     = round( buyer_service_fee    * cumulative_r / b ) - already_refunded_buyer_fee
creator_fee_reversal = round( creator_platform_fee * cumulative_r / b ) - already_reversed_creator_fee
```

Computed cumulatively against the original payment and rounded once, per Refund
Policy §8 — which is what prevents repeated partial rounding from exceeding the
original fee. Minimums are never recalculated against the remaining balance. A final
full refund returns any rounding remainder.

Mechanically: `stripe.refunds.create` on the connected account with
`refund_application_fee: true`, against `stripe_charge_id`.

### 6.3 What a refund does to the project

| Refund | Effect |
| --- | --- |
| Full refund of the starting payment, before work | Agreement and request → `cancelled` |
| Partial refund of a milestone | That milestone → `cancelled`; earlier approved milestones stand; the request continues only if both parties want it to, otherwise §5.2 applies |
| Full refund of every collected payment | Request → `cancelled`; all licences revoked |
| Refund after final delivery approval | Request stays `completed` and carries a refund record. There is no un-approval path, and inventing one would corrupt the delivery history. |

---

## 7. Unresponsive buyers and creators

Refund Policy §7 already sets the clock: a clear project message stating what is
needed, **seven days** without a substantive reply, then a **final notice** granting
**seven more**. That is the rule. What follows is how it becomes operational, since
`REQ-003` currently reads "There is no automated path and no policy for this yet."

| | Rule |
| --- | --- |
| First notice | A project message from the waiting party stating what is needed and why. Logged against the request. |
| Waiting period | 7 calendar days without a substantive reply. An automated acknowledgement is not a reply. |
| Final notice | 7 further calendar days. Recorded as a distinct event, not an ordinary message. |
| After expiry, **buyer unresponsive** | The creator may pause work, propose a revised schedule, and request administrative closure with cancellation of unfinished work. Unearned prepaid amounts remain refundable. Silence forfeits no deposit, completes no milestone, authorises no charge and transfers no rights. |
| After expiry, **creator unresponsive** | The buyer may request cancellation and refund of unearned amounts. A creator who retains payment must evidence earned value. |
| Early review | Immediately, without waiting, where a promised essential deadline is missed, there is credible fraud, or the creator states they cannot complete. |
| Who closes | **An administrator**, on request from the waiting party. Not unilateral. |

**Why admin closure and not unilateral.** Unilateral closure with money in the
project requires the refund engine *and* a dispute path to both exist and be
trusted. At launch volume, a human deciding is cheaper and safer than a wrong
automatic transfer. Revisit once refunds have run for a quarter.

**Administrative closure is not a finding that the work was satisfactory** (Refund
Policy §6). The request records the closure reason and preserves the full history.

### 7.1 NEEDS YOUR CALL — notices have no delivery channel

There is **no outbound email in the product**. Supabase sends auth emails; nothing
else sends anything. The only way a notice reaches anyone is an in-app project
message and an unread badge they have to come back to see.

A final notice a party never sees is not a notice, and closing a project against it
is hard to defend to that party, to a bank in a chargeback, or to a regulator.

Two options:

- **Add minimal transactional email before launch** — three templates: payment
  receipt, first notice, final notice. *(Recommended.)* It is the difference between
  a defensible closure and a silent one, and buyers separately expect payment
  receipts.
- **Launch without it**, and accept that the non-response rules run on in-app
  delivery only. Cheaper now; every closure is contestable.

---

## 8. Feature classification

| Feature | Launch | Limited beta | Later |
| --- | --- | --- | --- |
| Commission requests, agreements, milestones, change orders, final delivery | ● | | |
| Stripe Connect onboarding — CA/US, CAD/USD | ● | | |
| Card checkout, direct charges, application fee | ● | | |
| Free listings — download and external link | ● | | |
| Cancellation (§5) | ● | | |
| Admin refunds, full and partial (§6) | ● | | |
| Dispute webhook visibility | ● | | |
| Non-response notices and administrative closure (§7) | ● | | |
| Messaging, moderation, reporting | ● | | |
| Twitch linking and live discovery | ● | | |
| Structured usage rights on agreements | ● | | |
| Transactional email | ● *(if §7.1 is approved)* | | |
| Tips and optional platform support | | ● | |
| Creator-initiated refunds | | ● | |
| Buyer self-service refund requests | | ● | |
| Delayed / non-card payment methods | | ● | |
| Additional currencies and countries | | ● | |
| Paid instant-download sales (`one_time`) | | | ● |
| Subscriptions | | | ● |
| Ads | | | ● |
| Listing boosts | | | ● |
| YouTube and other platform linking | | | ● |

Nothing in the **Later** column is required for a buyer to pay a creator and receive
work, which is the launch test. YouTube linking already ships as a "Coming soon" row
in profile settings, which is the correct treatment.

---

## 9. Decisions that need your business choice

These are not resolved above, and inventing an answer would be worse than asking.

1. **Legal entity and contact addresses.** Every policy ships with
   `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]` and `[DMCA_AGENT_EMAIL]` placeholders, and
   every policy version is `2026-09-20-draft-1` behind a
   `// REVIEW DRAFT: resolve publication inputs` marker. The refund policy assumes
   Alberta, Canada business days. None of this can be published as-is, and
   `policy_acceptances` records the version a user agreed to — so the launch
   versions must be cut before the first real buyer accepts anything.

2. **Transactional email at launch — yes or no.** §7.1. This decides what the
   non-response rules are worth.

3. **Who funds a refund when the creator's Stripe balance is short.** Refund Policy
   §10 states "An insufficient Stripe balance does not extinguish a refund
   obligation." With direct charges the base amount is the creator's money, on the
   creator's account. If they have spent it, Stripe cannot claw it back and the
   buyer is still owed. Does Made for Stream front the refund and pursue the
   creator, or does the buyer wait on the creator's balance? This is real financial
   exposure and it should be decided before the first refund, not during it. The
   platform fee reversal is separate and is already promised — we absorb that in
   every case.

4. **Confirm the 10.00 minimum per instalment** (§3.1) and the **deferral of tips**
   (§4). Both are recommendations with a clear default and both are reversible, but
   both change published pricing copy, so they should be said out loud rather than
   assumed.

---

## 10. What this document changes about the published policies

| Policy | Change |
| --- | --- |
| Fee Schedule §1, §3, §4 | Remove the creator tip and Made for Stream support rows and examples (§4 above). Keep the CAD/USD minimums exactly as written — they are correct. |
| Fee Schedule §1 | State that CAD and USD are the only enabled currencies, rather than describing the conditions under which others could be. |
| Fee Schedule §2 | Add the 10.00 minimum per instalment. |
| Refund Policy §8 | Remove the contribution-refund paragraph along with tips (§4 above). |
| Refund Policy §1 | Keep the EU/UK withdrawal paragraph, and build the express-consent capture it depends on (§1.2). |
| Refund Policy §5 | No wording change; make `included_revision_count` nullable so the two-round fallback can actually apply (§5.4). |
| Refund Policy §7 | No change. It is already the rule; §7 above makes it operational. |
| All policies | Cut non-draft versions once §9.1 is resolved. |

---

## Related

- [`launch-implementation-checklist.md`](launch-implementation-checklist.md) — the
  ordered build sequence for the sprints that follow.
- [`support/README.md`](support/README.md) — the support playbooks, several of which
  record the gaps this document closes.
