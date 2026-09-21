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

**Target: global availability, buying and selling in any major currency.**

That is achievable, and it is not a configuration flip. Three places in the product
hardcode the assumption that a currency has exactly 100 minor units, and the fee
minimums are fixed integers applied to whatever currency arrives. Shipping global on
top of that produces wrong money, silently. This section describes what "global"
means concretely and what has to be built to get there honestly.

### 1.1 The currency registry

**Decision: replace every hardcoded currency constant with a `supported_currencies`
registry table.** This is the foundation for everything else in this section.

| Column | Purpose |
| --- | --- |
| `code` | ISO 4217, lowercase |
| `minor_unit_exponent` | 2 for USD/EUR, **0** for JPY/KRW, **3** for KWD/BHD/JOD/OMR/TND |
| `amount_multiple` | Stripe requires three-decimal currency amounts to be a multiple of 10 |
| `buyer_fee_minimum` | In minor units, per currency |
| `creator_fee_minimum` | In minor units, per currency |
| `minimum_instalment` | §3.1, per currency |
| `stripe_minimum_charge` | Stripe's own per-currency floor |
| `enabled` | Enabled only once validated end to end |

**What this fixes.** Three live defects, all of which reach production the moment a
non-two-decimal currency is used:

1. `ensure_listing_request_payment_for_schedule_item` computes
   `round(schedule_row.amount * 100)` to convert a major-unit agreement amount into
   minor units. For JPY that turns ¥100 into a charge of ¥10,000. For KWD it
   under-states by a factor of ten and produces an amount Stripe rejects.
2. `formatPaymentCents` in `src/domain/payments/listingRequestPaymentDisplay.ts` is
   `formatMoney(cents / 100, currency)` — the same bug in the display layer, so a
   buyer would be shown a figure that is not what they are charged.
3. The fee minimums (`100` and `150`) are applied regardless of currency. In JPY
   those are ¥100 and ¥150 — roughly a dollar total, so the floor effectively
   disappears. In a strong currency they are too high.

The registry makes the exponent explicit at every conversion, so each of these
becomes a lookup rather than an assumption.

**Note on `AGENTS.md`.** It states "Fee minimums are USD-denominated." They are
*minor-unit*-denominated, which is why CAD and USD both work unchanged today and why
nothing else does. (`AGENTS.md` is gitignored, so that correction is not in this PR.)

### 1.2 Creators

| | Rule |
| --- | --- |
| Creator countries | **Every country where Stripe Connect supports a direct-charge account with `card_payments` and `transfers`** — currently around 46. |
| Creator currencies | Any enabled registry currency their connected account can settle. |
| Default currency | Their connected account's `default_currency`, changeable to any enabled currency their account supports. |

We do not invent a country list. Stripe's Connect availability *is* the list, and
attempting to ship a wider one just produces onboarding that fails at the end. A
creator in a country Stripe does not support cannot be paid, whatever we write in a
table.

**Gap this closes.** `src/components/settings/CreatorPayoutSettings.tsx` ships
free-text `maxLength={2}` country and `maxLength={3}` currency inputs, and
`POST /api/stripe/connect/start` accepts whatever they contain against a regex only.
Today that lets a creator onboard in a currency whose fee arithmetic is wrong.
Global does not mean unvalidated: the inputs still become pickers, and the server
and database still enforce the enabled set. They are just a much longer list.

### 1.3 Staged enablement

**Recommendation: build the registry once, then enable currencies in waves as each
is validated end to end.** The checkout playbook is explicit that non-USD has never
been validated; going from one unvalidated currency to fifty at once multiplies an
untested path rather than testing it.

| Wave | Currencies | Blocked on |
| --- | --- | --- |
| 1 | CAD, USD | Nothing. Already works. |
| 2 | Two-decimal majors — EUR, GBP, AUD, NZD, CHF, SGD, SEK, NOK, DKK, PLN, MXN, BRL, HKD | The registry, per-currency minimums, and one real end-to-end run each. |
| 3 | Zero-decimal — JPY, KRW | The exponent work in §1.1. |
| 4 | Three-decimal — KWD, BHD, JOD, OMR, TND | The exponent work plus the multiple-of-10 rule. |

Creator onboarding can open globally at wave 2 — a creator in Japan can onboard and
sell in USD before JPY is enabled. Country availability and currency availability
are separate switches, and that is what makes "global at launch" honest rather than
aspirational.

### 1.4 Buyers

| | Rule |
| --- | --- |
| Buyer countries | **Unrestricted** |
| Buyer currency | The creator's listing currency. The buyer's bank converts. |

These are direct charges on the creator's connected account. Stripe already decides
which cards that account can accept, so a buyer geo-gate costs sales and prevents
nothing. Fee Schedule §6 already states that a bank may convert and apply its own
rate, and that a converted refund can differ from the converted debit — the correct
and honest description of this design.

**Presenting prices in the buyer's own currency is a later feature,** not a launch
one. It requires either Stripe Adaptive Pricing or our own FX handling, and it
changes what "the agreed amount" means mid-project. One currency per agreement,
named on the agreement, is the launch rule.

### 1.5 Consumer law — now required, not recommended

Refund Policy §1 already grants EU/UK consumers a 14-day distance-contract
withdrawal right and states that losing it for a commissioned service "requires the
applicable express consent, acknowledgement and confirmation." The product never
captures that consent.

At CA/US scope that was a recommendation. **Selling globally makes it a launch
requirement**, because the policy grants the right and the product cannot rely on
its own earned-value rules without the consent that qualifies it.

**Build:** at buyer acceptance of the project agreement, record an express request
to begin work before the withdrawal period expires, through the existing
`policy_acceptances` table (`20260917_113`, hardened by `20260919_114`). A checkbox
and one recorded row.

### 1.6 Payment methods

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

**This costs more now that the target is global.** In several European markets a
local method is the dominant one — iDEAL in the Netherlands, Bancontact in Belgium,
BLIK in Poland — and cards-only measurably suppresses conversion there. The answer
is to fix `processing` (buyer copy, creator SLA, a reminder, and reconciliation that
understands a legitimately slow payment) and then enable local methods per market,
rather than to enable them now and discover the gap through stuck projects.

**Recommendation:** set `payment_method_types: ["card"]` on the checkout session
rather than inheriting each creator's dashboard configuration, and treat local
payment methods as the first post-launch market expansion.

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

**Decision: a floor on how small a single instalment may be — 10.00 in CAD and USD,
and a per-currency equivalent in the registry for every other currency.**

**What the problem is.** The fee minimums are flat amounts, so on a small payment
they stop being 5% and become most of the payment. The only constraint enforced
today is `application_fee_cents < total_checkout_cents`, which permits a base of
2.50 — at which the buyer pays 3.50, **Made for Stream takes 2.50, and the creator
receives 0.00.** Neither party is told this until checkout throws
`Payment amount % % is too small for the configured CreatorHub fee minimums`, which
reaches the buyer as "a generic failure when opening checkout" (`PAY-004`).

**What the floor does.** At a 10.00 base the buyer pays 11.00, the creator receives
8.50, and Made for Stream takes 2.50 — 25%, which is high but honest and already
disclosed. Below 10.00 the creator's share collapses:

| Base | Buyer pays | Creator receives | Made for Stream | Platform share |
| --- | --- | --- | --- | --- |
| 2.50 | 3.50 | 0.00 | 2.50 | 100% |
| 5.00 | 6.00 | 3.50 | 2.50 | 50% |
| **10.00** | **11.00** | **8.50** | **2.50** | **25%** |
| 30.00 | 31.50 | 28.50 | 3.00 | 10% |
| 100.00 | 105.00 | 95.00 | 10.00 | 10% |

10.00 is already the worked example in the published fee schedule, so the number is
disclosed before this decision rather than after it. Note this is a floor on each
*instalment*, not on the project: a 300.00 project in three 100.00 milestones is
unaffected. It only stops a schedule being split so finely that the flat minimums
eat it — which the fee schedule already warns about in §2.

**Per-currency values** come from the registry (§1.1), set at roughly equivalent
purchasing power rather than by converting 10.00 at spot. They are published in the
fee schedule alongside that currency's minimums, as §1 of that schedule already
requires for any currency we enable.

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

**Recommendation — "deferring tips": take tips and platform support out of the
launch fee schedule and refund policy, keep the columns, the arithmetic and the
display branches, and build the feature after launch.**

Deferring means changing the *policy*, not the code. The database already supports
tips correctly and nothing has to be torn out. What changes is that the published
fee schedule stops describing a thing buyers cannot do. Right now it tells a buyer
they may add an optional tip and an optional platform contribution, and there is no
control anywhere in the product to add either — so the promise generates a support
ticket ("where do I tip?") and no revenue.

**The alternative is building it,** and it is a contained build: a tip input on the
checkout page, plus an API route that recomputes `total_checkout_cents` and
`application_fee_cents` and reissues the Stripe session (the existing idempotency
key is already keyed on `updated_at`, so it rotates correctly). Perhaps two days.

**What makes it more than two days** is that tips drag Refund Policy §8's
contribution rules into the refund engine's first release: contributions are *not*
automatically prorated on a partial refund, the buyer can request them back within
14 days of the contribution or of the cancellation, and mistaken or duplicate
contributions are reviewable outside that window. That is a separate refund path
with its own clock, sitting inside the first refund feature we ship.

**So the choice is:** launch without tips and add them once refunds are proven (the
recommendation), or accept a more complicated first refund release. Either is fine
— it just should not be decided by accident.

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

### 6.3 When the creator's balance is short — platform-funded refunds

**Decision: Made for Stream funds the buyer refund immediately, then recovers it
from the creator through the app.**

With direct charges the base amount lands in the creator's Stripe balance. If they
have already paid it out and spent it, Stripe cannot claw it back, and the buyer is
still owed. Refund Policy §10 already commits us: "An insufficient Stripe balance
does not extinguish a refund obligation." This is how that commitment is honoured.

**The buyer is never made to wait on a creator's balance.** The refund is issued
from the platform, and whatever could not be taken from the creator's balance
becomes a **recovery balance** owed by the creator to Made for Stream.

While a recovery balance is outstanding:

| | Rule |
| --- | --- |
| New requests | **Blocked.** The creator's listings stay visible but cannot receive a new request. |
| Existing projects | Continue. Work already agreed is not interrupted. |
| Payments on existing projects | **Diverted to the recovery balance** until it clears. |
| Paying it off directly | The creator can settle the balance in the app at any time, by card, which lifts the block immediately. |
| Clearing | Automatic. When the balance reaches zero the block lifts with no admin action. |

**Blocking new requests, not hiding listings.** A hidden listing loses its search
position, its link history and its reviews, and punishes the creator's future for a
past debt. Blocking at the point of request is the narrower action that achieves the
same thing: no new obligation can be created while an old one is unpaid. The
enforcement point is the `listing requests buyer insert` RLS policy on
`public.listing_requests`, which already gates on listing state — it gains a check
that the creator has no outstanding recovery balance. That is a database boundary,
which is where it belongs.

**How the diversion works mechanically.** Not a new money-movement primitive: on the
creator's subsequent payments, `application_fee_amount` is raised by the recovery
instalment, so the extra comes off the top of the same direct charge and lands with
the platform. This is already the exact mechanism the platform fee uses, and it
respects the existing `application_fee_cents < total_checkout_cents` constraint.

### 6.4 NEEDS YOUR CONFIRMATION — how much of each payment to divert

**Recommendation: recover at most 50% of each base payment, not all of it.**

Diverting a payment in full means the creator is working on the new project for
nothing. The predictable result is that they abandon it — which produces a second
unhappy buyer, a second refund, and a second recovery balance on top of the first.
The recovery mechanism would then be generating the debt it exists to collect.

At 50% the balance still clears quickly, the creator keeps a reason to finish the
work, and the buyer of the new project gets what they paid for. A creator who wants
it over with can always settle directly.

Recovering 100% is a defensible choice if you would rather a creator with an
outstanding debt earn nothing until it is cleared. It is a policy stance rather than
an engineering constraint — both are the same amount of work — so it should be your
call rather than mine.

### 6.5 What a refund does to the project

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
| Currency registry replacing the hardcoded constants (§1.1) | ● | | |
| Stripe Connect onboarding — global country coverage | ● | | |
| Currency waves 1 and 2 (§1.3) | ● | | |
| Card checkout, direct charges, application fee | ● | | |
| Free listings — download and external link | ● | | |
| EU/UK express consent to immediate start (§1.5) | ● | | |
| Cancellation (§5) | ● | | |
| Admin refunds, full and partial (§6) | ● | | |
| Platform-funded refunds and creator recovery balances (§6.3) | ● | | |
| Dispute webhook visibility | ● | | |
| Non-response notices and administrative closure (§7) | ● | | |
| Messaging, moderation, reporting | ● | | |
| Twitch linking and live discovery | ● | | |
| Structured usage rights on agreements | ● | | |
| Transactional email | ● *(if §9.2.1 is approved)* | | |
| Currency waves 3 and 4 — zero- and three-decimal (§1.3) | | ● | |
| Tips and optional platform support | | ● | |
| Creator-initiated refunds | | ● | |
| Buyer self-service refund requests | | ● | |
| Local payment methods per market (§1.6) | | ● | |
| Marketplace tax collection (§9.2.3) | | ● | |
| Buyer-currency price display / FX (§1.4) | | | ● |
| Paid instant-download sales (`one_time`) | | | ● |
| Subscriptions | | | ● |
| Ads | | | ● |
| Listing boosts | | | ● |
| YouTube and other platform linking | | | ● |

Nothing in the **Later** column is required for a buyer to pay a creator and receive
work, which is the launch test. YouTube linking already ships as a "Coming soon" row
in profile settings, which is the correct treatment.

---

## 9. Decisions

### 9.1 Settled

| Question | Decision |
| --- | --- |
| Legal entity | **Made for Stream** |
| `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]`, `[DMCA_AGENT_EMAIL]` | **inbox@madeforstream.com** for all three |
| Geographic scope | **Global** — every country Stripe Connect supports for creators, unrestricted for buyers (§1) |
| Currency scope | **Any major currency**, through the registry, enabled in waves (§1.1, §1.3) |
| Refund funding | **Made for Stream funds the refund**, then recovers from the creator in-app (§6.3) |
| Creator with an outstanding balance | Listings **blocked from new requests**; existing projects continue and their payments are diverted to the balance (§6.3) |

Two follow-ups that come with the entity details rather than being separate
decisions:

- **A single inbox for all three roles is fine to launch with** and can be split
  later without a policy version bump, since the policies name an address rather
  than a department.
- **US DMCA safe harbour requires a designated agent registered with the US
  Copyright Office**, not just an address in a policy. With US buyers in scope, that
  registration is worth doing — it is a form and a small fee, and without it the
  safe harbour the copyright policy assumes does not apply. Not a launch blocker;
  do not let it fall off.
- **Governing law stays Alberta, Canada.** Refund Policy §1 already defines business
  days there. Global selling does not change that, because the policy already states
  that mandatory local consumer rights apply regardless — which is the correct and
  enforceable position.

### 9.2 Still open

1. **Transactional email at launch — yes or no.** §7.1. There is no outbound email
   in the product at all; `inbox@madeforstream.com` is where mail arrives, not a way
   to send it. Going global sharpens this: parties are now spread across every
   timezone, so "they will see it next time they open the app" is a longer and less
   predictable wait, and a 7-day notice clock runs regardless.

2. **How much of each payment to divert to a recovery balance** — §6.4. Recommended
   50%; 100% is a legitimate alternative. Same build either way.

3. **Marketplace tax collection.** Fee Schedule §6 currently says taxes "must be
   identified before payment" and carefully does not claim they are automatically
   collected. That was tenable in CA/US. Selling globally engages EU VAT, UK VAT,
   Australian GST, Canadian GST/HST and US state sales tax on digital services, with
   marketplace-facilitator rules that in several of those jurisdictions put the
   obligation on **us**, not on the creator, regardless of what the fee schedule
   says. Stripe Tax handles the calculation for a fee; registration and remittance
   are still a decision with real cost. This does not block a first launch, but it
   should be a deliberate choice with a date on it rather than something discovered
   later.

4. **Confirm the per-instalment minimum** (§3.1) and the **treatment of tips** (§4).
   Both are explained in full in those sections.

---

## 10. What this document changes about the published policies

| Policy | Change |
| --- | --- |
| All policies | Replace `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]` and `[DMCA_AGENT_EMAIL]` with `inbox@madeforstream.com`; name **Made for Stream** as the entity; remove every `// REVIEW DRAFT` marker and cut non-draft versions. |
| Fee Schedule §1 | Keep the CAD/USD minimums exactly as written — they are correct. Publish the currently enabled currency list with each one's minimums, which §1 already requires before a currency may be enabled. |
| Fee Schedule §1, §3, §4 | Remove the creator tip and Made for Stream support rows and examples, if §4 above is accepted. |
| Fee Schedule §2 | Add the per-instalment minimum. |
| Fee Schedule §5 | Add that where a refund exceeds the creator's available balance, Made for Stream funds it and recovers the amount from the creator, including by applying it to subsequent payments (§6.3). This is a new obligation on the creator and must be disclosed before they can incur it. |
| Fee Schedule §6 | Revisit once §9.2.3 is decided — the current wording is deliberately non-committal about tax collection and should not survive a marketplace-facilitator obligation. |
| Creator Terms | Add the recovery balance: what creates one, that new requests are blocked while it is outstanding, how it is recovered, and how it is settled directly. |
| Refund Policy §1 | Keep the EU/UK withdrawal paragraph, and build the express-consent capture it depends on (§1.5). |
| Refund Policy §5 | No wording change; make `included_revision_count` nullable so the two-round fallback can actually apply (§5.4). |
| Refund Policy §7 | No change. It is already the rule; §7 above makes it operational. |
| Refund Policy §8 | Remove the contribution-refund paragraph along with tips, if §4 above is accepted. |
| Refund Policy §10 | No change. "An insufficient Stripe balance does not extinguish a refund obligation" is now backed by an actual mechanism. |

---

## Related

- [`launch-implementation-checklist.md`](launch-implementation-checklist.md) — the
  ordered build sequence for the sprints that follow.
- [`support/README.md`](support/README.md) — the support playbooks, several of which
  record the gaps this document closes.
