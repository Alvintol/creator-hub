# Launch Scope — Made for Stream

> **Status:** proposed for approval. This is **the** launch specification — the
> single document the first paid launch is built against. Where it disagrees with a
> published policy or with the code, the disagreement is named explicitly and a
> resolution is given.
>
> §9.1 records what is settled. §9.2 records the two questions still open. §10 lists
> the policy edits this implies, which are **scheduled, not yet applied** — the text
> in `src/domain/legal/` still describes the pre-decision rules until Sprint 8.
>
> An earlier parallel draft, `launch-payment-scope.md`, was merged in #101 and has
> been folded into this document — its per-event state table is now §13 and its
> integrity findings are §11. It recommended a Canada-only, CAD-only pilot and
> deferring tips, none of which survived the decisions in §9.1.

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
buyer_service_fee    = ceil( base * buyer_rate_bps / 10000 )
creator_platform_fee = ceil( base * creator_rate_bps / 10000 )
application_fee      = buyer_service_fee + creator_platform_fee + platform_support
total_charged        = base + creator_tip + buyer_service_fee + platform_support
creator_receives     = base + creator_tip − Stripe's fee on the whole charge
```

Both rates are **500 bps (5%) for everyone today**, with **no minimum on either
side** (§3.1). They are written as resolved values rather than literals because
§3.5 and §3.6 need them to become per-user without a trigger rewrite.

- Tips carry no Made for Stream percentage. They are added to the charge and
  excluded from the application fee, so they reach the creator.
- Optional platform support is added to the charge **and** to the application fee,
  so it reaches Made for Stream.
- Failed attempts and retries of the same unpaid obligation create no additional
  fee. The fee is computed once, when the ledger row is created, not per checkout
  attempt.
- **Stripe's 2.9% + 0.30 is charged to the creator's connected account** and is not
  ours to collect or return (§3.4). It is charged on the whole amount — base plus
  buyer fee plus any tip — not on the base alone.

Against today's code this changes two things: the minimums are removed, and the
rates become resolved rather than literal. Everything else in
`ensure_listing_request_payment_for_schedule_item` stands.


### 3.1 No fee minimums

**Decision: 5% from the buyer and 5% from the creator, with no minimum on either
side, on every payment.**

This changed twice, and the reasoning is worth keeping because it explains why a
minimum looked necessary and then stopped being so.

The minimums existed to protect margin on small payments. They were then justified
by Stripe's CA$2 monthly active account fee — a real per-creator-per-month cost, and
exactly the shape a per-creator-per-month minimum recovers.

**Choosing Model A (§3.4) removes that cost entirely.** Stripe bills the creator's
connected account directly, and we pay no account fee, no payout fees and no
processing. The platform takes its application fee and pays Stripe nothing, so
**it cannot lose money on a transaction at any size.** The minimum has nothing left
to protect.

What it still does is take money from creators on small commissions:

| Base | Platform (no min) | Creator | Creator % | With a 1.50 min: platform / creator |
| --- | --- | --- | --- | --- |
| 2.00 | 0.20 | 1.54 | 77% | 1.60 / **0.14 (7%)** |
| 5.00 | 0.50 | 4.30 | 86% | 1.75 / **3.05 (61%)** |
| 10.00 | 1.00 | 8.90 | 89% | 2.00 / **7.90 (79%)** |
| 20.00 | 2.00 | 18.09 | 90% | 2.50 / 17.59 (88%) |
| 50.00 | 5.00 | 45.68 | 91% | 5.00 / 45.68 (91%) |

Above about 30.00 the minimum never binds and makes no difference. Below it, the
only thing it does is transfer money from a creator selling a cheap emote to us. For
a marketplace whose volume is small commissions, that is the wrong place to take a
margin we no longer need.

**What this deletes.** No `creator_fee_minimum_consumption` table, no UTC month
boundaries, no "did a refund release this month's minimum" logic, no "is this the
first payment of the month" branch in the fee bridge. A whole subsystem leaves
Sprint 1, and the published fee becomes four words: **5% and 5%, no minimums.**

#### The instalment floor stays, for a different reason

A floor is still needed, but now to protect the **creator** rather than the
platform. Stripe's flat CA$0.30 is what bites at small amounts — 15% of a 2.00
payment — and the creator bears it under Model A.

**Decision: 5.00 minimum per instalment**, down from 10.00. At 5.00 the creator
keeps 86% of the base, which is a defensible worst case. The earlier 10.00 figure
was set against the platform's break-even under Model B, which no longer exists.

Per-currency values come from the registry (§1.1), set at roughly equivalent
purchasing power rather than converted at spot. Validate at agreement send time and
again at schedule item creation, with a real message, and leave the `PAY-004` guard
as a backstop.
### 3.2 Can the 2.9% be split between buyer and creator?

**What it is.** Stripe's payment processing fee: **2.9% + CA$0.30 per successful
domestic card transaction**, charged on the *whole amount charged* — base plus buyer
fee plus any tip — not on the base alone. International cards and currency
conversion add more.

**Resolved 2026-09-22 — the creator does bear this, but not the way the
product was built.** This went through three stages the same day, worth
keeping for the record:

1. **Assumed correct.** "Direct charges on an Express account" was treated as
   sufficient on its own to put this on the creator.
2. **Found wrong.** Retrieved the one existing connected account live: it was
   created via the **old Accounts v1 API** (`stripeClient.accounts.create({
   type: "express" })`), and Express accounts turn out to **require** the
   platform to be the fee payer — confirmed by Stripe rejecting
   `controller.fees.payer: "account"` outright for a v1 Express account:
   *"your platform must collect fees and be liable for negative balances or
   refunds and chargebacks."* There is no v1 setting that moves this to the
   creator.
3. **Fixed by migrating to Accounts v2.** The platform's own Connect settings
   (Dashboard → Settings → Connect → Platform setup) were already configured
   for **Accounts v2** with `defaults.responsibilities.fees_collector:
   "stripe"` — the v2-native way of putting Stripe's processing fee on the
   connected account. The code just wasn't creating v2 accounts. Rewrote
   `api/server.js`'s account creation (`getOrCreateStripeAccountForEmbeddedConnect`)
   to call `stripeClient.v2.core.accounts.create()` with
   `fees_collector: "stripe"` / `losses_collector: "stripe"` / `dashboard:
   "none"`, matching the platform config exactly. Verified live, end to end,
   against Stripe's test API before trusting it: account creation, capability
   status reads (`configuration.merchant.capabilities.card_payments.status`),
   and — critically — that a **direct charge with `application_fee_amount`
   still works unchanged** against a v2 account via the same `Stripe-Account`
   header pattern every other Stripe call in this codebase already uses. The
   old v1-only `/api/stripe/connect/start` route and its helpers were removed
   as dead code in the same pass (zero callers, confirmed by grep).

**What this means for §3.3/§3.4:** the "clean 10%, no Stripe cost to the
platform" framing is now actually true, as built — not just assumed. No
numbers below need reworking.

**One real cost of the fix, not a numbers problem:** the 14-day payout hold
(§6.3) does not survive this migration unchanged. See §6.3's own correction.

On a CAD 100 commission that is 2.9% × 105.00 + 0.30 = **3.35**, so the creator's
total cost is 8.35 (5.00 to us, 3.35 to Stripe) while the buyer's is 5.00.

**Yes, it can be split — but not by raising the buyer service fee.** Raising that
fee sends the extra to *us*, because the buyer fee is part of the application fee.
The creator would be no better off.

The mechanism that works is a buyer-paid amount that is added to the total and
**excluded from the application fee**, so it lands in the creator's balance and
offsets their Stripe deduction. That is structurally identical to how a tip already
works, and the schema already supports the shape.

Solving for an even split on a CAD 100 base — the amount is self-referential,
because adding to the total also raises Stripe's 2.9%:

| | Today | Even split |
| --- | --- | --- |
| Buyer pays | 105.00 | **106.70** |
| Creator receives | 91.65 | **93.31** |
| Creator's total cost | 8.35 | 6.69 |
| Buyer's total cost | 5.00 | 6.70 |
| Made for Stream | 10.00 | 10.00 |

**Recommendation: do not do this.** Three reasons.

**It pushes on the number that is already losing.** §3.1's competitive problem is
the buyer-facing total — 105.00 against VGen's 100.00 for the same commission. This
widens that to 106.70. The creator's take-home is already within pennies of VGen's;
the buyer's total is not.

**It is a card surcharge in most legal readings, and surcharging is restricted.**
The EU and UK **prohibit** surcharging consumer cards outright. Canada permits it
but caps it at 2.4% and requires card-network notification and disclosure.
Several US states restrict it. Australia caps it at actual cost. For a platform
whose stated target is global, this is a live hazard.

There is a distinction that matters here: a **platform service fee** applied
regardless of payment method is not a card surcharge, whereas a fee explicitly
tied to card processing is. So if any of this cost is ever moved to the buyer, it
must be folded into the buyer service fee as a single undifferentiated platform
fee — **never labelled as a processing fee or a card fee**, and never varying by
payment method. Labelling decides the legal analysis.

**And there may be nothing to split.** Under "you handle pricing", Stripe's own
wording is that the platform is responsible for processing fees. If that applies
to us, the 3.35 is already coming out of our 10.00, not out of the creator — and
the question is whether to pass any of it on, which is a different question with a
different answer. That is Sprint 0.5's second item and it is unresolved.

**If creators need a better deal, the lever is the creator fee, not a new buyer
charge.** One number the creator can understand beats two, and it does not touch
the buyer-facing price or the surcharging rules.


### 3.3 What the platform actually nets

**Under Model A (§3.4), the application fee is the whole story: a clean 10% of
base.** Stripe bills the creator's connected account directly, so the platform pays
no processing, no CA$2 monthly active account fee, and no per-payout fee.

| Base | Buyer pays | Creator receives | **Made for Stream** |
| --- | --- | --- | --- |
| 20.00 | 21.00 | 18.09 | **2.00** |
| 50.00 | 52.50 | 45.68 | **5.00** |
| 100.00 | 105.00 | 91.66 | **10.00** |
| 500.00 | 525.00 | 459.48 | **50.00** |
| 1000.00 | 1050.00 | 919.25 | **100.00** |

Three things follow, and all three were problems under the other model:

**There is no break-even.** The platform takes its fee and pays nothing, so no
transaction size is loss-making. An earlier draft of this section computed a
break-even of 4.31 and a loss-making long tail — that analysis was written against
Model B and does not apply.

**There is no per-creator fixed cost.** A creator who sells once for 20.00 in a
month and never returns costs nothing to carry. Under Model B the CA$2 account fee
made that creator a net loss, which for a marketplace built on small commissions was
a structural problem with growth itself.

**Payout frequency is no longer a cost question** (§6.3).

**What we give up** is roughly 3.35 per 100 of base, which under Model B would have
reached the creator instead. §3.4 works through what that means against VGen: the
creator lands at 91.66 against VGen's 91.80 for a US artist — a 14-cent difference —
and **ahead** of VGen's 89.96 for a non-US artist, because direct charges avoid the
cross-border payout leg VGen pays.

### 3.4 Model A — Stripe bills the creator, not us

**Decision: "Stripe handles pricing" — Stripe sets and collects processing fees
from the connected account directly.**

Stripe Connect offers two billing models. Under the other one, "you handle
pricing", Stripe invoices the **platform** for processing plus CA$2 per monthly
active account and 0.25% + CA$0.25 per payout, and the platform decides what to
charge creators.

The choice is close to zero-sum between the creator and us — Stripe takes the same
3.35 on a 100 commission either way, and the buyer pays the same 105 under both. It
only decides whose side it comes off:

| Base 100 | Buyer pays | Creator receives | Made for Stream nets |
| --- | --- | --- | --- |
| **Model A** *(chosen)* | 105.00 | 91.66 | **10.00** |
| Model B | 105.00 | 95.00 | 6.65, less CA$2/month and payout fees |

**Why A.** On a creator with one 100.00 sale that month, Model A nets 10.00 and
Model B nets 4.17 once the account and payout fees are counted. It removes the
per-creator fixed cost, it makes the loss-making long tail impossible, only Model A
can qualify for a Stripe revenue share — and **Fee Schedule §5 is already written
for it**: "The creator is responsible for those transaction-related charges to the
extent charged to their connected account" is true under A and false under B.

**What it costs the creator** is 14 cents against VGen on a 100 commission:

| Base 100 | Buyer / client pays | Creator receives |
| --- | --- | --- |
| Made for Stream | 105.00 | 91.66 |
| VGen, US artist | 100.00 | 91.80 |
| VGen, non-US artist | 100.00 | **89.96** |

Against VGen's **non-US** artists we are ahead by 1.70, and that is structural
rather than a pricing choice: VGen routes non-US artists through a cross-border
payout and charges 1.5–2.5% for it. Direct charges do not — a Canadian creator has
a Canadian connected account, charges CAD and pays out domestically. For the home
market, this already beats VGen on take-home.

**The remaining gap is the buyer fee, not the model.** 105.00 against 100.00 is the
number a buyer compares, and §3.5 is the answer to it.

### 3.5 Waiving the buyer fee — the subscription foundation

The 5% buyer service fee pays for what the other platforms do not have: written
agreements, milestone structure, change orders, a delivery record, and a defined
cancellation and refund path. That is the justification, and it should be stated
where the buyer pays it (the checkout note already does).

**It should also be removable per buyer**, so that a future buyer subscription can
include "no service fee" as its headline benefit. Nothing about that is built now.
What follows is only what has to be true so it can be built later without a
migration that rewrites history.

**The schema already expresses a waiver.** `buyer_service_fee_bps` is snapshotted
per payment, so a waived fee is simply `0`. Nothing needs adding to store it.

**Three things do need to be right from the start:**

**The rate must be read per buyer, not hardcoded.** The fee bridge writes a literal
`500` today. It should resolve the buyer's applicable rate at payment creation, even
while that resolution always returns 5% — a function returning a constant is trivial
to change later; a constant embedded in a trigger is not.

**Record why the rate applied.** A `0` with no explanation is indistinguishable from
a bug, and support will not be able to tell a subscriber from a defect. A reason
alongside the rate — standard, subscription, promotional, goodwill — makes a waived
fee auditable and makes revenue reporting possible. This mirrors the creator-side
waiver reason in §3.6.

**Lock the rate at agreement acceptance, as a ceiling.** Fee Schedule §2 requires
the agreement to show estimated aggregate fees before acceptance, and §8 forbids
silently repricing accepted obligations. So a buyer who accepts an agreement at 0%
must not find later milestones charged at 5% because their subscription lapsed
mid-project.

The rule that is safe in both directions: **the rate recorded at acceptance is a
maximum, and a later waiver may lower it but nothing may raise it.** A lapsed
subscription does not reprice an accepted schedule; a buyer who subscribes
mid-project still benefits on the instalments that follow. One sentence, and it
avoids a surprise charge that the refund policy would otherwise put us on the wrong
side of.

**Refunds need no special handling.** The proportional arithmetic in §6.2 works from
the values stored on the payment, so a payment with a 0% buyer fee returns a 0%
buyer fee. Nothing to change.

### 3.6 Leaving room for creator subscriptions

Premium creator features stay **Later** (§8), and dropping the fee minimum (§3.1)
took away the table that would have carried them. So the creator side now needs the
same foundation as the buyer side, and for the same reason.

**Resolve the creator's rate per creator, not as a literal.** The bridge writes
`500` for the creator fee exactly as it does for the buyer fee. Both should go
through the same resolution, returning 5% for everyone today, so that "this
creator's plan includes a reduced platform fee" is later a data change rather than a
trigger rewrite.

**Record the reason alongside it**, the same four values as §3.5 — standard,
subscription, promotional, goodwill. A creator on a discounted rate and a creator
given a goodwill adjustment must be distinguishable after the fact.

**Both sides share one resolver.** Buyer and creator rates are the same question
asked of different parties, and building two of them is how they drift apart.

Fee Schedule §8 already reserves the ground and needs no edit: "This schedule
contains no active creator subscription or subscription discount. Any future
subscription requires separately disclosed pricing, billing frequency, renewal,
cancellation and fee effects before enrolment."
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

**Decision: build them. Tips and optional platform support ship at launch.**

The database side is already correct and nothing has to be torn out — the columns,
the constraints and the display branches all exist and behave properly. What is
missing is the input and the write path.

**What has to be built:**

- A tip and contribution control on the checkout page. Both default to zero and must
  be affirmatively chosen, per Fee Schedule §4.
- An API route that recomputes `total_checkout_cents` and `application_fee_cents`
  and reissues the Stripe session. The existing idempotency key is keyed on
  `updated_at`, so it rotates correctly when the amount changes.
- The arithmetic is already right in the schema's check constraints: a tip is added
  to the total but excluded from the application fee, so it reaches the creator;
  support is added to both, so it reaches Made for Stream.

**The part that is bigger than the input.** Tips bring Refund Policy §8's
contribution rules into the refund engine's first release, and they do not follow
the base refund's rules:

- A **full** project cancellation returns tips and contributions.
- A **partial** refund does **not** prorate them automatically. The buyer requests
  them back, within 14 days of the contribution or of the project's cancellation,
  whichever is later.
- Mistaken, duplicate or unauthorised contributions are reviewable outside that
  window entirely.

So a contribution refund is a separate path with its own clock, sitting inside the
first refund feature. That is the real cost of this decision and it is sequenced in
the checklist accordingly — tips land **with** refunds, not before them, because a
tip we cannot refund correctly is worse than no tip.

**Two interactions to keep straight:**

- Tips and contributions sit outside the fee calculation entirely: a tip is
  excluded from the application fee, a contribution is added to it, and neither
  affects the buyer or creator rate (§3.1).
- A tip is the creator's money, so it sits under the same 14-day payout hold as the
  base (§6.3). A contribution is ours and is not held.

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

**The current ledger cannot store any of this.** `listing_request_payments` has a
single nullable `stripe_refund_id`, a single `refunded_at`, and an aggregate status.
There is **no refunded amount, and no history** — so two partial refunds against one
payment have nowhere to go, and the cumulative arithmetic above cannot be computed
from stored state.

**Build:** an immutable refund ledger — one row per Stripe refund, carrying its
amount, the buyer fee and creator fee reversed with it, the actor, the reason and
the timestamp. `partially_refunded` and `refunded` are then **derived** from the sum
of settled refunds rather than written directly, which also makes the status
impossible to get out of step with Stripe. The same shape covers disputes.

This has to land with §6.1, not after it. A partial refund feature on the current
columns would write a status it cannot substantiate.

### 6.3 Payout hold — keeping the money available in the first place

**Decision: hold creator payouts for 14 days after the charge, so a refund can be
taken from funds that are still there.**

This is the right first move, and it is more urgent than an earlier draft of this
section believed.

**Correction, superseded twice on 2026-09-22 — read this instead of the
"14 days" decision line above.**

**First finding:** the account-creation path every real creator actually went
through (`getOrCreateStripeAccountForEmbeddedConnect`, live behind
`POST /api/stripe/connect/account-session`) set **no payout schedule at all**.
The dead `/connect/start` route (confirmed zero callers) was the only one that
set `manual`. So any creator who onboarded before this session had payout
timing on whatever Stripe's unconfigured default was — not the "safe
accidental hold" this section originally assumed.

**Second finding, on top of the first:** fixing that turned out to require
migrating account creation to **Accounts v2** (§3.2's correction has the full
story — the fee-payer fix and this one landed together, same root cause: the
product was still creating v1 Express accounts). For v2 accounts, payout
scheduling is not part of account creation at all — it is a **separate
Balance Settings resource** (`stripeClient.balanceSettings.update(...)`,
called with the account's own `Stripe-Account` header), and it draws a hard
line the old `settings.payouts.schedule.delay_days` parameter never did:
**`settlement_timing.delay_days_override` can only be changed on accounts
where the platform itself owns fraud/dispute liability.** This platform's
`losses_collector` is `"stripe"` — Stripe owns it, deliberately, for lower
platform risk (§3.2) — so `delay_days_override` is rejected outright.
Confirmed live: attempting it returns *"You cannot change
`payments[settlement_timing][delay_days]` via API once an account has been
activated."* Setting `interval: "daily"` alone is accepted; the delay itself
cannot be pushed to 14.

**So the 14-day figure in this section's decision line does not hold, and
nothing in this codebase can make it hold without also taking on the
liability tradeoff described in §3.2.** What was actually built and verified
live: `interval: "daily"`, delay left at Stripe's own default —
**confirmed 7 days** on a Canadian test account, read back from the real
Balance Settings response. That number is Stripe's default for this country
in test mode, not a value this product chose or can currently guarantee
across countries or in live mode; treat "7" as observed, not promised, and
re-verify in live mode before publishing a number in the fee schedule.

**Decided 2026-09-22 (same session that found this): keep `losses_collector:
"stripe"` and accept whatever default Stripe assigns**, rather than taking on
platform liability just to control the exact number. The rest of this
section's reasoning (why an explicit, automatic schedule beats the
undocumented default it replaces; what it covers and doesn't) still holds —
only the specific day count changes, from a guaranteed 14 to an observed,
per-account, not-currently-overridable default.

**Implementation, as actually shipped:** `setStripeConnectDailyPayoutSchedule`
in `api/server.js` sets `interval: "daily"` via Balance Settings immediately
after v2 account creation. No `delay_days` override is attempted. No payout
code of our own, and no escrow.

**This reverses an earlier decision** (`weekly`, chosen when Model B's
per-payout fee made `daily` expensive) **for a different reason than
originally planned.** Model A removing the per-payout fee is still true and
still the reason `daily` beats `weekly` on cost — but the *specific number*
this section promised (14 days) was never achievable the way it was
described. `daily` at Stripe's default delay is still better for creators
than an undisclosed default would have been; it just isn't the guaranteed
14-day figure published earlier in this document.

**This is not escrow, and the policy stays accurate.** The funds sit in the
creator's own Stripe balance and belong to them; only the transfer to their bank is
delayed. Payment Terms §5 can keep "Made for Stream does not provide escrow, a trust
account or a promise that all funds are held pending acceptance" — but the delay
must be disclosed explicitly rather than left to §5's general "payout timing
depends on..." language.

#### What the hold does and does not cover

It covers the **most common refund by far**: a buyer cancels before substantive work
starts and gets a full refund under Refund Policy §3. Those happen within days.

It does **not** cover several real cases, and it is worth being precise about them
rather than assuming the risk is gone. (Table below still says "14-day hold" for
the cases it was written against — re-read with the corrected, shorter,
not-currently-overridable delay from above; the *shape* of what's covered
doesn't change, only how many days of buffer it actually buys.)

| Case | Typical timing | Covered by the hold? |
| --- | --- | --- |
| Cancellation before work starts | Days | **Yes** |
| Dissatisfaction reported after delivery | Within 14 days of delivery (Refund Policy §6) | Only if the delivery is within the hold's actual (shorter than 14-day) window of the payment — narrower than originally planned |
| Milestone project cancelled mid-way | Weeks to months after the starting payment | **No** — that payment released long ago |
| Final balance refunded after approval | After the hold | **No** |
| Chargeback | **Up to 120 days**, longer for some reason codes | **No**, and nothing will |
| Fraud, duplicate charge, hidden defect, infringement | No deadline (Refund Policy §6) | **No** |

A deposit taken in January on a three-month commission is paid out in January. If
that project is cancelled in March under the earned-value rules, the hold is
irrelevant.

**So the hold reduces how often we front money; it does not remove the need to be
able to.** The recovery mechanism below stays — it just becomes the exception rather
than the routine path, and covers a slightly wider range of cases than planned now
that the buffer itself is shorter than 14 days.

**One creator-experience note, revised.** The original "14 days is in line
with the market" claim assumed a number this platform cannot currently
guarantee (see the correction above) — do not repeat it in creator-facing
copy until the real, live-mode delay is confirmed. Whatever it turns out to
be, it still lands hardest on a brand-new creator waiting on their first
payment, and per-account schedule tuning remains a later knob, not a redesign
— though tightening it further is moot until the platform takes on liability
(§3.2), and loosening it isn't ours to control either way under the current
configuration.


### 6.4 Instant payouts — considered and not offered

**Decision: no instant payout option. The 14-day hold is the point, and an instant
payout would sell a way around it.**

Recorded here because it looks like an easy win and will be proposed again. Stripe
supports Instant Payouts for Connect, settles in about 30 minutes including
weekends, and explicitly invites platforms to "realize additional revenue by
assessing a fee".

**The problem is what it would be instant *from*.** Stripe makes funds from card
payments available for instant payout as soon as the charge completes — day 0. The
hold exists so that money is still there when a refund is needed, and the creators
most likely to generate a refund are exactly the ones most likely to take the
money early. Offering it undoes §6.3 for the cases §6.3 was built for, and pushes
every one of those refunds back onto platform funding (§6.5).

A narrower version — instant payout only of funds that have *already* cleared the
14 days, accelerating "next Friday" to "in 30 minutes" — keeps the hold intact and
would be safe. It is a reasonable later feature. It is not worth building now:
it adds a payout path, per-country eligibility gating, a debit-card requirement in
Canada and several other countries, daily volume limits, and its own failure modes
in support — all to compress a wait of at most six days for creators who have
already waited fourteen.

**Revisit when** the refund engine has run long enough to show what the real refund
rate is. If it is low, the hold itself can shorten, which is a better answer for
creators than paying a fee to escape it.
### 6.5 When the balance is still short — platform-funded refunds

**Decision: Made for Stream funds the buyer refund immediately, then recovers it
from the creator through the app.**

With direct charges the base amount lands in the creator's Stripe balance. Once the
hold expires and they have paid it out and spent it, Stripe cannot claw it back, and
the buyer is still owed. Refund Policy §10 already commits us: "An insufficient
Stripe balance does not extinguish a refund obligation." This is how that commitment
is honoured in the cases §6.3 does not reach.

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

### 6.6 Recovery rate

**Decided: recover at most 50% of each base payment.**

Diverting a payment in full would leave the creator working the next project for
nothing, and the predictable result is that they abandon it — producing a second
unhappy buyer, a second refund and a second recovery balance. At 50% the balance
still clears quickly, the creator keeps a reason to finish the work, and the buyer
of that project gets what they paid for. A creator who wants it over with can settle
directly at any time.

### 6.7 What a refund does to the project

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
**seven more**. That is the rule, and it was already written before this document —
what `REQ-003` was missing was not a policy but a way to run it. What follows is how
it becomes operational.

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

### 7.1 Notice delivery — transactional email ships at launch

**Decision: transactional email is a launch feature, sent through Cloudflare Email
Service.**

Without it there is no outbound email in the product at all. Supabase sends auth
mail; nothing else sends anything. A notice would reach someone only through an
in-app message and an unread badge they have to come back to see — and a final
notice a party never sees is not a notice. Closing a project against one would be
hard to defend to that party, to a bank in a chargeback, or to a regulator.

#### Why Cloudflare

Cloudflare Email Service now covers both directions, which it did not when this
document was first drafted:

| | Workers Free | Workers Paid |
| --- | --- | --- |
| Email Routing (inbound) | Unlimited | Unlimited |
| Email Sending (outbound) | Not available | 3,000/month included, then $0.35 per 1,000 |

Sending to arbitrary recipients requires the **Workers Paid plan** and an onboarded
sending domain; before a domain is onboarded, sending is limited to addresses
verified on the account. Delivery is available over the REST API and authenticated
SMTP as well as a Workers binding, so **no Workers code is required** — the Express
API calls the REST endpoint directly.

It wins here for reasons specific to this project rather than on features:

- The domain is already on Cloudflare, and Email Routing is needed for
  `inbox@madeforstream.com` regardless. That part is free.
- **It avoids an SPF collision before we have one.** Only one SPF TXT record is
  permitted per domain. Splitting inbound and outbound across two vendors means
  hand-merging `include:` directives and re-merging whenever either changes. One
  vendor manages both records.
- 3,000/month is well clear of launch volume — receipts, two notice types and
  Supabase auth mail come to roughly 600–1,000 a month at 200 transactions.

**Two caveats, neither disqualifying.** Email Sending is **Beta**, and Cloudflare's
sending reputation is newer than a specialist's. If receipt deliverability turns out
to be the constraint, Postmark or Resend is a swap of SMTP credentials rather than a
rewrite — this is not a one-way door. New accounts also start on a conservative
daily quota that scales with sending behaviour, so the domain needs warming before
launch rather than on the day.

#### Launch templates

Payment receipt, first notice, final notice, and payout released. The last one is
not optional once the 14-day hold (§6.3) ships: a creator whose money is held and
who is told nothing will read it as the platform sitting on their earnings.

#### Two things that come with this decision

**Supabase auth mail moves to the same provider.** There is no `supabase/config.toml`
and no SMTP variables in the environment, so auth email is going out on Supabase's
built-in service — which is rate-limited to a handful per hour and documented as not
for production. Sign-up confirmations and password resets are already exposed, ahead
of any of this. Point Supabase's custom SMTP at Cloudflare and the same sending
domain: one provider, one reputation to warm, one place to look when mail goes
missing.

**Send from a subdomain** — `send.madeforstream.com` — so a deliverability problem
with automated mail does not damage the root domain's reputation for the inbox
humans actually use.

### 7.2 A privacy gap this exposes

Adding an email processor is exactly what the privacy policy's **Service Provider
Register** is for. That register **does not exist**. The privacy policy references
it three times — including "The published version must include the verified Service
Provider Register and a working privacy contact" — and there is no such page, no
route and no domain module.

It was already a gap for Supabase, Stripe and Google Fonts. Adding Cloudflare for
email, and selling into the EU and UK where sub-processor disclosure is a GDPR
requirement rather than a courtesy, makes it a launch item rather than a tidy-up.

**Build:** a published Service Provider Register listing each provider, its function
and its processing locations, on the same footing as the other legal pages.

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
| 14-day payout hold, daily schedule (§6.3) | ● | | |
| Admin refunds, full and partial (§6) | ● | | |
| Platform-funded refunds and creator recovery balances (§6.5) | ● | | |
| Per-user fee rate resolution and waiver reasons (§3.5, §3.6) | ● | | |
| Tips and optional platform contributions (§4) | ● | | |
| Tax collection for CA/US (§12) | ● | | |
| Dispute webhook visibility | ● | | |
| Non-response notices and administrative closure (§7) | ● | | |
| Messaging, moderation, reporting | ● | | |
| Twitch linking and live discovery | ● | | |
| Structured usage rights on agreements | ● | | |
| Transactional email on Cloudflare (§7.1) | ● | | |
| Supabase auth mail moved to the same provider (§7.1) | ● | | |
| Published Service Provider Register (§7.2) | ● | | |
| Tax registration for EU/UK and the rest of wave 2 (§12) | | ● | |
| Currency waves 3 and 4 — zero- and three-decimal (§1.3) | | ● | |
| Creator-initiated refunds | | ● | |
| Buyer self-service refund requests | | ● | |
| Local payment methods per market (§1.6) | | ● | |
| Shorter payout hold for established creators (§6.3) | | ● | |
| Instant payouts of already-released funds (§6.4) | | | ● |
| Buyer-currency price display / FX (§1.4) | | | ● |
| Paid instant-download sales (`one_time`) | | | ● |
| Creator subscriptions for premium features (§3.6) | | | ● |
| Buyer subscriptions waiving the service fee (§3.5) | | | ● |
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
| Creator payouts | **Automatic daily payout, delay at Stripe's default** (confirmed 7 days on a CA test account) — the live account-creation path set no schedule at all before this. A guaranteed 14-day figure was planned and found unachievable under this platform's liability configuration; see §6.3 (§6.3) |
| Refund funding | **Made for Stream funds the refund**, then recovers from the creator in-app (§6.5) |
| Creator with an outstanding balance | Listings **blocked from new requests**; existing projects continue and their payments are diverted to the balance (§6.5) |
| Recovery rate | **50% of each base payment** (§6.6) |
| Stripe Connect pricing model | **Model A — "Stripe handles pricing", via Accounts v2.** Confirmed: the platform pays no CA$2 monthly account fee, no per-payout fee, and (as of the 2026-09-22 v1→v2 migration) no processing fee — `fees_collector: "stripe"` puts the 2.9%+CA$0.30 on the connected account, verified live. See §3.2 (§3.4) |
| Accounts API version | **v2** (`stripeClient.v2.core.accounts`), not v1 `type: "express"`. Matches the platform's own already-configured Connect settings (`fees_collector`/`losses_collector: "stripe"`, `dashboard: "none"`). The v1-only `/api/stripe/connect/start` route was dead code (zero callers) and was removed in the same migration (§3.2, §11) |
| Fee rates | **5% buyer and 5% creator.** The buyer fee pays for agreements, milestones, change orders, delivery records and a defined refund path — what the competition does not have (§3, §3.5) |
| Fee minimums | **None on either side** — Model A removed the cost they offset, and they only took from creators on small commissions (§3.1) |
| Instalment floor | **5.00**, now protecting the creator from Stripe's flat 0.30 rather than the platform from a loss (§3.1) |
| Per-user fee waivers | **Foundation only.** Rates resolved per user with a recorded reason, locked at agreement acceptance as a ceiling (§3.5, §3.6) |
| Splitting Stripe's 2.9% onto buyers | **No** — it worsens the buyer-facing price and reads as a card surcharge, which the EU and UK prohibit (§3.2) |
| Payout schedule | **Daily, delay at Stripe's default (not overridable to 14 days under `losses_collector: "stripe"`)** — Model A still removes the per-payout fee that made weekly cheaper; the guaranteed-14-days part of the original decision did not survive the v1→v2 migration (§6.3) |
| Instant payouts | **Not offered.** The hold is the protection; an instant payout sells a way around it (§6.4) |
| Tips and platform contributions | **Built for launch**, shipping alongside refunds (§4) |
| Transactional email | **Ships at launch**, on Cloudflare Email Service (§7.1) |
| Supabase auth mail | Moves to the **same provider and sending domain** (§7.1) |
| Regional sales tax | **Collected and remitted by Made for Stream** wherever obliged (§12) |

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

1. **Tax registration strategy and advice** — §12.3. Not an engineering decision.
   Which jurisdictions to register in and when, and whether to take
   jurisdiction-specific advice before selling into the EU and UK. Recommended: yes,
   before the first EU sale, since EU VAT applies from the first euro with no
   small-seller threshold.

**Resolved 2026-09-22 (same day, three stages — see §3.2 for the full
account).** Whether the creator or the platform pays Stripe's 2.9%+CA$0.30.
Closed as "creator pays, already correct," reopened by Stripe support, found
to be structurally false under the v1 Express accounts the code was actually
creating, and fixed for real by migrating account creation to Accounts v2
(`fees_collector: "stripe"`), matching the platform's own already-configured
Connect settings. Verified live that a direct charge with
`application_fee_amount` still works unchanged against a v2 account. No
Custom-accounts migration needed — that was the right question for a wrong
diagnosis (Express's hard constraint), and it dissolved once the actual
account API version was the thing that got fixed.

**A real cost of that same fix, not a business decision either — see §6.3:**
the 14-day payout hold cannot be guaranteed under this platform's
`losses_collector: "stripe"` configuration. Decided the same day: keep
`losses_collector: "stripe"` (lower platform risk) and accept Stripe's
default delay instead of a guaranteed 14 days. Confirmed 7 days on a Canadian
test account in test mode — not yet reconfirmed live or for other countries.

**Resolved 2026-09-22.** Whether Connect's own platform-level fees ($2/month per
active connected account, 0.25%+$0.25 per payout) are billed to the platform under
"Stripe handles pricing." Confirmed directly with Stripe support rather than
inferred from an empty invoice (no live payments have run yet, so the invoice would
show nothing either way): "Because of that, your platform doesn't incur the
account, payout volume, tax reporting, or per-payout fees that apply under the
'you handle pricing' model... Since you've described Stripe handling pricing with
Express and direct charges, those fees don't apply to your platform in that
setup." §3.1, §3.3, §3.4 and §6.3's payout-schedule reasoning all stand as written
against this confirmation — no figures change.

One nuance Stripe support flagged, unrelated to the above and not yet verified:
fee responsibility for direct charges also depends on the `fees_collector`
(Accounts v2) / fee payer (Accounts v1) property set on each connected account,
which decides whether Stripe or the connected account is billed for the charge
itself. This account is on Accounts v1 (`stripe.accounts.create` with `type:
"express"`, no `fees_collector`), and §3.1's own reasoning about Express + direct
charges already covers that case. Worth a one-line confirmation with Stripe that
no fee payer override is set on the platform's connected accounts, but it does not
block Sprint 3.

---

## 10. What this document changes about the published policies

| Policy | Change |
| --- | --- |
| All policies | Replace `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]` and `[DMCA_AGENT_EMAIL]` with `inbox@madeforstream.com`; name **Made for Stream** as the entity; remove every `// REVIEW DRAFT` marker and cut non-draft versions. |
| Fee Schedule §1 | **Remove both minimum rows.** Fees are a flat 5% each side with no minimum (§3.1) — the "Minimum per successful base payment" column disappears. Publish the enabled currency list, which §1 already requires before a currency may be enabled. |
| Fee Schedule §2 | Rewrite. "Each separately collected instalment can incur a minimum, so splitting a project can cost more than one payment" is now false — with no minimums, splitting costs the same. Add the 5.00 instalment floor and state that the agreement's fee estimate is a maximum (§3.5). |
| Fee Schedule §3 | **Rework every worked example.** All six apply minimums that no longer exist. The two-instalment example, which exists specifically to show the minimum compounding, has to go or be replaced. |
| Fee Schedule §5 | Disclose the 14-day payout hold and the daily release schedule (§6.3) — the existing "payout timing depends on..." language does not cover a delay we impose. Add that where a refund exceeds the creator's available balance, Made for Stream funds it and recovers from the creator, including by applying it to subsequent payments (§6.5). Both are new creator obligations and must be disclosed before they can be incurred. Confirm §5's existing statement that the creator bears Stripe's charges — under Model A it is true as written (§3.4). |
| Fee Schedule §4 | Keep the tip and contribution rows — they are being built (§4). |
| Fee Schedule §6 | Rewrite for §12. The current "does not claim that all taxes are automatically collected" becomes a statement that Made for Stream calculates, collects and remits where obliged, and identifies tax separately on the payment record — which also requires the missing `tax_cents` column. |
| Creator Terms | Add the recovery balance: what creates one, that new requests are blocked while it is outstanding, how it is recovered at 50% of each payment, and how it is settled directly. Add the payout hold. |
| Privacy Policy §4 | Name Cloudflare as the email and routing provider alongside Supabase and Stripe, and **publish the Service Provider Register** the policy already says the published version must include (§7.2). |
| Refund Policy §1 | Keep the EU/UK withdrawal paragraph, and build the express-consent capture it depends on (§1.5). |
| Refund Policy §5 | No wording change; make `included_revision_count` nullable so the two-round fallback can actually apply (§5.4). |
| Refund Policy §7 | No change. It is already the rule; §7 above makes it operational. |
| Refund Policy §8 | Keep the contribution-refund paragraph — it now describes a feature that exists (§4). |
| Refund Policy §10 | No change. "An insufficient Stripe balance does not extinguish a refund obligation" is now backed by two actual mechanisms: the payout hold and, behind it, platform funding with recovery. |

---

## 11. Payment integrity gaps that block live money

Four findings that are not policy decisions but that no rule in this document is
safe without. They came out of comparing the proposed rules against the code, and
the first two were verified directly.

**Fixed.** `CheckoutPolicyAcceptance` gates the checkout page on the buyer
accepting the current policy versions, and `POST /api/stripe/checkout/session`
used to create the Stripe session without consulting `policy_acceptances` at
all — the acceptance record that a dispute would be argued from was enforced
only in the browser, which per `AGENTS.md` is not a boundary.
`assertCheckoutPoliciesAccepted` now re-checks it server-side on every call,
including a reused session, since an acceptance of an older version does not
count once a policy has changed. The API has no build step connecting it to
this TypeScript app, so `api/policyVersions.js` mirrors the client's required
policy versions by hand, and
`src/domain/tests/checkoutPolicyVersionsSync.test.ts` fails loudly if the two
drift apart.

**The checkout API trusts stored fee values.** It validates that the amount is
positive and that the application fee is below the total, then passes the stored
figures to Stripe. It does not recompute the fee from the base, the currency
registry and the monthly-minimum state. Once fees vary by currency and by month
(§1.1, §3.1), recomputing server-side from authoritative rows is what stops a stale
or tampered ledger row becoming a real charge.

**Manual payment confirmation is still reachable.** The `admin_confirm_*_payment`
RPCs are break-glass fallbacks from before automated payments existed, they are
exposed in the admin UI, and they are not labelled as such. They mark money as
received without verifying it moved. That was tolerable while no real money flowed.
It is not tolerable at launch, and it is worse once refunds exist — a manual
confirmation can leave a schedule satisfied against a payment that was refunded.
**Restrict them to an audited, named exception or remove them before live
checkout.**

**Stripe does not guarantee event order and may deliver duplicates.** The webhook
handler uses `stripe_event_ids` for idempotency, which is right, but the workflow
cascades assume events arrive in order. A `charge.refunded` that lands before its
`checkout.session.completed` should not be possible to process into a wrong state.
Handle out-of-order and duplicate delivery explicitly, and reconcile against current
Stripe object state rather than trusting the event payload alone.

### 11.1 Where the API runs

Hosting the Vite site on Cloudflare does not move `api/server.js`. Static hosting
does not run Express, and Stripe's Connect webhook endpoint needs a real HTTPS
origin that preserves the **raw request body** for signature verification. Either
host the Express API separately and route `/api/*` to it, or port it to Workers and
re-test. This changes deployment and integration tests, not any rule in this
document — but it has to be decided before the webhook endpoint is registered,
because the webhook is what makes payments work at all.

---

## 12. Regional sales tax obligations

**Decision: the rules are updated to collect and remit indirect tax wherever selling
globally obliges us to, rather than leaving it to the creator.**

### 12.1 Why the current framing will not survive

Fee Schedule §6 says taxes "must be identified before payment," that creators are
responsible for tax on their own supplies "except where applicable law assigns
collection or remittance to Made for Stream," and — carefully — that the policy
"does not claim that all taxes are automatically collected."

That was written as a holding position and it worked at CA/US scope. It does not
survive global sale, because **marketplace facilitator rules in many jurisdictions
assign the collection and remittance obligation to the platform by operation of law,
regardless of what our contract says about who supplies the work.** Payment Terms §5
naming the creator as the supplier does not move that obligation. The exception
clause in §6 is doing the work, and the answer to it is now "yes, frequently."

In scope once we sell globally, at minimum:

| Regime | Applies to |
| --- | --- |
| EU VAT (OSS/IOSS) | Digital services to EU consumers, from the first euro — no threshold for non-established suppliers |
| UK VAT | Digital services to UK consumers |
| Australian GST | Inbound digital services, threshold-based |
| New Zealand GST | Remote services |
| Canadian GST/HST + provincial | Already applicable and already ours as an Alberta entity |
| US state sales tax | Digital goods and services, per state, with economic nexus thresholds |
| Norway, Switzerland, Japan, Korea, Singapore, India and others | Each with its own registration rules |

**EU VAT has no small-seller threshold for a non-established supplier.** It applies
from the first sale. That makes it the first one to solve, not a later one.

### 12.2 What this requires in the product

- **A tax engine.** Recommend **Stripe Tax** — it calculates at checkout, handles
  location evidence and produces the filing exports. It charges per transaction and
  it does not file for you.
- **A tax column on the payment ledger.** `listing_request_payments` has
  `base_amount_cents`, `creator_tip_cents`, `buyer_service_fee_cents`,
  `creator_platform_fee_cents`, `platform_support_cents`, `application_fee_cents`
  and `total_checkout_cents` — and **no tax field at all**. Meanwhile Fee Schedule §6
  already promises "The payment record must separately identify base price, buyer
  fee, creator tip, support contribution, **tax** and total." The product cannot keep
  that promise today. Add `tax_cents` and the jurisdiction, and include tax in the
  total.
- **Buyer location evidence** captured and stored — EU VAT rules require two
  non-contradictory pieces.
- **Tax shown separately at checkout before payment**, which §6 already requires.
- **Refunds adjust tax proportionally.** Refund Policy §8 already says "Taxes
  attributable to refunded items are adjusted as required."
- **Creator tax status.** Whether a creator is registered and in which country
  changes the treatment, including reverse charge on B2B supplies within the EU.
  Stripe Connect collects some of this at onboarding; it has to be stored and used.
- **Whether tax applies to our fees as well as to the base.** The buyer service fee
  and the platform contribution are our supply to the buyer, and in several
  jurisdictions they are separately taxable. This is not the same question as tax on
  the commission.

### 12.3 The part that is not an engineering decision

Registration and remittance are obligations with penalties, and the thresholds,
treatment of custom creative work, and platform-versus-creator liability differ
meaningfully by jurisdiction. Stripe Tax calculates; it does not decide where we
must register, and it does not file.

**Recommendation: get jurisdiction-specific advice before the first sale into the
EU and UK**, and stage registrations rather than attempting all of them at once.
This is the one item in this document where the right next step is a professional
opinion rather than a migration, and it should not be quietly absorbed into an
engineering sprint. It is sequenced as its own sprint for that reason.

**This does not block launching in CA/US**, where we are established and the
position is already understood. It blocks the wave 2 currencies and the markets they
represent — which is the same gate §1.3 already staged them behind.

---

## 13. State effects reference

One table for what each event does to the payment ledger, the project, and the
operator. It spans §5, §6 and §11, and it is the quickest way to check that a
proposed change does not leave money and work disagreeing.

| Event | Payment ledger | Schedule and project | Operational |
| --- | --- | --- | --- |
| Checkout opened | `requires_checkout` → `checkout_opened`, session id stored | Schedule item stays `payment_required`; work stays blocked where payment is a prerequisite | Reconcile from Stripe before creating another session; reuse a still-open one |
| Checkout abandoned or expired | Returns to a retryable state when no successful charge exists. `processing` is reserved for a genuinely pending asynchronous payment and is **not** treated as stuck | Unchanged | `PAY-005`; do not reconcile a `processing` payment as abandoned |
| Charge succeeded and verified | `paid`, with account, session, PaymentIntent, **charge**, **application fee**, amounts and event ids persisted together | Schedule item `paid` **once**, then its milestone / start / final workflow runs exactly once | Never let the browser return page declare success — the webhook is the production path |
| Tip or contribution included | Tip raises the total and not the application fee; contribution raises both | No effect on schedule state | Tip is creator money and falls under the payout hold; contribution does not |
| Payout hold expires | No ledger change | No project change | Funds become available and pay out automatically (§6.3); creator notified |
| Partial refund | Immutable refund ledger row with its amount and the fees reversed; `partially_refunded` **derived** from cumulative settled refunds. `paid_at` and the original charge are preserved | The affected milestone → `cancelled`; earlier approved milestones stand; only the affected next step freezes | Record decision, fee reversal, who funded it and the evidence; notify both parties |
| Full refund | Derived `refunded` once the full refundable charge is returned | Outstanding instalments cancelled and the unfinished agreement closed through an explicit cancellation record — **never `archived`** | Correct the rights attaching to fully refunded work (§5.3) |
| Refund exceeds available balance | Refund still issued; shortfall opens a recovery balance | Creator blocked from **new** requests; existing projects continue | Up to 50% of each later base payment is diverted via a raised application fee until clear (§6.5, §6.6) |
| Pre-payment cancellation | Every `requires_checkout` / `checkout_opened` row → `cancelled`; any open Stripe session expired | Agreement, schedule items, milestones, change orders and final delivery → `cancelled`; request → `cancelled` | Distinguish a cancelled **unpaid checkout** from a refunded **paid charge** — they are not the same record |
| Dispute opened | Tracked as a separate case over the charge, preserving paid and refunded history; visible `disputed` while open | The affected work and further collection go on hold pending review — the whole project is not silently cancelled and paid delivery rights are not erased | Tier 3. Capture the evidence deadline immediately and tell the creator; it is their account and their money |
| Dispute closed | Reconcile won/lost, final amount, and any refund already issued, avoiding duplicate recovery | Outcome decides whether the project completes or cancels | Record the outcome and the reasoning |
| Creator loses charge capability | No ledger change; new sessions denied | New paid publication paused and outstanding collection paused; existing obligations and free listings unaffected | Tell the creator which onboarding step is required and surface blocked projects to support |
| Non-response final notice expires | No ledger change | Administrative closure available to an admin on request (§7) | Closure is not a finding that the work was satisfactory; unearned prepaid amounts stay refundable |

Two rules that hold across every row:

- **`archived` is an inbox state, not a financial outcome.** It exists for a buyer
  tidying an unaccepted request. It must never stand for cancellation or settlement.
- **Status is derived where money is involved.** `partially_refunded` and `refunded`
  come from the sum of settled refunds, never from a direct write, so the record
  cannot drift from Stripe.

---

## Related

- [`launch-implementation-checklist.md`](launch-implementation-checklist.md) — the
  ordered build sequence for the sprints that follow.
- [`support/README.md`](support/README.md) — the support playbooks, several of which
  record the gaps this document closes.
