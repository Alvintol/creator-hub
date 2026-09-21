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
buyer_service_fee    = max( ceil(base * 5 / 100), buyer_minimum )
creator_platform_fee = max( ceil(base * 5 / 100), creator_minimum_if_unconsumed )
application_fee      = buyer_service_fee + creator_platform_fee + platform_support
total_charged        = base + creator_tip + buyer_service_fee + platform_support
creator_receives     = base + creator_tip     (before Stripe's own costs)
```

where `buyer_minimum` and the creator minimum come from the currency registry
(§1.1), and the creator minimum applies only to that creator's first successful
payment of the calendar month in that currency (§3.1).

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

### 3.1 Fee minimums apply once per creator per month

**Decision: the flat fee minimums apply to a creator's first successful payment in a
calendar month. Every later payment that month is charged the percentage only, with
no minimum.**

**Why this is an improvement.** The flat minimum is what makes small payments look
bad. It currently applies to every instalment, so a creator taking many small
payments is charged it over and over:

| Base | Buyer pays | Creator receives | Made for Stream | Platform share |
| --- | --- | --- | --- | --- |
| 2.50 | 3.50 | 0.00 | 2.50 | **100%** |
| 5.00 | 6.00 | 3.50 | 2.50 | 50% |
| 10.00 | 11.00 | 8.50 | 2.50 | 25% |
| 30.00 | 31.50 | 28.50 | 3.00 | 10% |
| 100.00 | 105.00 | 95.00 | 10.00 | 10% |

Charging it once a month keeps the protection on a creator's first transaction and
stops penalising volume. On a second 10.00 payment in the same month the fees become
0.50 and 0.50 — the buyer pays 10.50, the creator receives 9.50, and the platform
share drops from 25% to 10%, matching what a large payment already pays.

#### What the minimum actually offsets

**Correction to an earlier draft of this section,** which said the minimum was
margin rather than cost recovery. That was only true under one of Stripe's two
Connect pricing models, and it is not the one we are on.

Stripe Connect bills a platform one of two ways:

| | Stripe handles pricing | **You handle pricing** |
| --- | --- | --- |
| Monthly active account | $0 | **CA$2** per account that receives a payout that month |
| Per payout sent | $0 | **0.25% + CA$0.25** |
| Processing (2.9% + CA$0.30 domestic card) | Billed to the connected account | **Billed to the platform** |

Under "you handle pricing", **CA$2 per active creator per month is a real platform
cost**, and it is a *per creator per month* cost — which is exactly the shape of a
per creator per month fee minimum. The monthly minimum is therefore the correct
structure for it, and a per-payment minimum would over-recover from any creator
taking more than one payment.

That makes the reasoning behind the monthly minimum sound. It is cost recovery, and
CA$2.50 covers a CA$2.00 account fee with a small margin.

#### Two costs this exposes that nothing has accounted for

**The 0.25% payout volume fee.** It applies to every payout and is unavoidable. At a
5% creator fee it consumes 5% of gross revenue on its own.

**The per-payout CA$0.25 is a function of payout frequency**, and the obvious
configuration for a 14-day hold — `interval: "daily"` with `delay_days: 14` — is
the most expensive one available. It means a payout on every day a creator has
funds released, so a creator with steady work could trigger 20–30 a month:

| Payout schedule | Payouts/month | Fixed payout fees |
| --- | --- | --- |
| `daily` | up to ~30 | up to **CA$7.50** |
| **`weekly`** *(decided, §6.3)* | ~4 | **CA$1.00** |
| `monthly` | 1 | **CA$0.25** |

At up to CA$7.50 the payout fees would dwarf the CA$2 account fee the monthly
minimum is sized to cover, and the whole minimum would be swallowed by a mechanism
chosen for unrelated reasons. Weekly avoids that while still paying creators on a
schedule they would consider normal.

**Decided: `weekly`.** It preserves the 14-day hold's purpose, costs about CA$1 a
month instead of up to CA$7.50, and a weekly payout is a normal creator
expectation. The exact interaction of `delay_days` with a weekly interval needs
checking against Stripe at implementation — `delay_days` is a `daily` schedule
parameter, so a weekly schedule may express the hold differently.

#### The question that decides the unit economics

**Under "you handle pricing", the platform is responsible for processing fees** —
Stripe's own wording. If that applies to our charges, then on a CAD 100 commission:

| | Creator bears Stripe | Platform bears Stripe |
| --- | --- | --- |
| Buyer pays | 105.00 | 105.00 |
| Creator receives | 91.65 | **95.00** |
| Made for Stream gross | 10.00 | 10.00 |
| Made for Stream net of Stripe | **10.00** | **6.65** |

That is a 33% difference in our net revenue, and it also decides whether a published
sentence is true: Fee Schedule §5 states "The creator is responsible for those
transaction-related charges to the extent charged to their connected account." If
the platform bears processing, that sentence is wrong and has to change before
publication.

With direct charges the default is that the connected account pays Stripe's fee, but
this is account configuration and cannot be determined from the code. **Resolve it in
the Stripe dashboard before pricing is published** — it is the first item of the
Stripe portal checklist in
[`launch-implementation-checklist.md`](launch-implementation-checklist.md).

#### Decided: creator side only. Buyers have no minimum at all.

**The 1.50 creator platform fee minimum becomes monthly. The buyer service fee has
no minimum — it is a flat 5%, every time.**

Two reasons this is the right split. First, the CA$2 cost it offsets is a
*per-creator* cost; there is no equivalent buyer-side cost to recover. Second, a
monthly buyer minimum would mean **two buyers paying different fees for the same
purchase** depending on how busy that creator happened to be that month — 11.00 on
the 1st and 10.50 on the 15th, for reasons invisible to both. The fee schedule
requires fees to be disclosed before payment, and that is not honestly disclosable.

Removing the buyer minimum outright goes further than making it monthly, and it goes
in the direction the competitive position needs (§3.2): the buyer-facing number is
where we are weakest, and 5% flat is a number that can be stated in four words.

| 10.00 payment | Buyer pays | Creator receives | Platform |
| --- | --- | --- | --- |
| Before | 11.00 | 8.50 | 2.50 |
| First of the month | 10.50 | 8.50 | 2.00 |
| Later that month | 10.50 | 9.50 | 1.00 |

#### Rules the monthly minimum needs

- **Per creator, per currency, per calendar month, UTC.** Per currency because
  minimums are denominated per currency and converting invites FX drift. UTC because
  it has to be stated somewhere and a creator's local month is not knowable at the
  point the fee is computed.
- **Only a successful payment consumes it.** Failed and abandoned checkouts do not.
- **A refund releases it.** If the payment that consumed the month's minimum is
  fully refunded, the next payment that month consumes it instead. Otherwise a
  creator refunds a small first payment and gets a free month.
- **Tips and platform support neither consume nor count toward it** — they are
  outside the fee calculation entirely (§4).
- **The agreement estimate becomes an upper bound.** Fee Schedule §2 requires the
  agreement to show "estimated aggregate Made for Stream fees before acceptance."
  Whether a March milestone is that month's first payment is unknowable in January,
  so the estimate must be quoted as a maximum with the monthly rule explained. That
  is a policy wording change, not a caveat to bury.

#### The instalment floor follows from it

The 10.00 per-instalment floor existed to stop the flat minimum eating a payment.
Where there is no minimum, that reason disappears.

**Decision: the floor is 10.00 for a month's first payment, and for every later
payment it drops to that currency's `stripe_minimum_charge` from the registry.**

A creator can then take a 3.00 follow-up payment — fees 0.15 and 0.15 — which was
the point of the change. The 10.00 first-payment floor stays because at 2.50 the
creator still receives nothing, and no pricing rule should permit that.

**Build:** validate at agreement send time and again at schedule item creation, with
a real message naming the applicable floor, and leave the `PAY-004` guard as a
backstop. Per-currency values come from the registry (§1.1), set at roughly
equivalent purchasing power rather than converted at spot.

---

### 3.2 Can the 2.9% be split between buyer and creator?

**What it is.** Stripe's payment processing fee: **2.9% + CA$0.30 per successful
domestic card transaction**, charged on the *whole amount charged* — base plus buyer
fee plus any tip — not on the base alone. International cards and currency
conversion add more. Today the creator bears all of it, because with direct charges
Stripe deducts from the connected account.

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

### 3.3 Leaving room for creator subscriptions

Subscriptions for premium creator features stay **Later** (§8). But the monthly
minimum lands first and shares their shape, so two small choices now keep the door
open without building anything.

**A creator's monthly billing period should be one concept, not two.** The
`creator_fee_minimum_consumption` record is per creator, per currency, per calendar
month. A subscription is also per creator per month. If the minimum invents its own
private notion of "this creator's month", a subscription later has to either
duplicate it or fight it. Model the period once and let both read it.

**The minimum needs to be waivable, with a recorded reason.** The most obvious
premium perk is "no monthly platform minimum", and the most obvious way to get that
wrong is to special-case it in the fee bridge later. Give the consumption record a
reason field from the start, so a waived month is a row that says why rather than an
absence of a row that nobody can explain. It also covers the non-subscription cases
— a support credit, a goodwill waiver — which will arrive before subscriptions do.

Nothing else is needed now. Fee Schedule §8 already reserves the ground: "This
schedule contains no active creator subscription or subscription discount. Any
future subscription requires separately disclosed pricing, billing frequency,
renewal, cancellation and fee effects before enrolment." That stays true and does
not need editing to accommodate this.

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

- Tips and contributions neither consume nor count toward the monthly fee minimum
  (§3.1). They are outside the fee calculation entirely.
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

This is the right first move and it is cheaper than it looks, because **we are
already holding funds — by accident and indefinitely.**

`createStripeConnectAccount` in `api/server.js` sets
`settings.payouts.schedule.interval = "manual"` on every connected account, and
**nothing anywhere in the codebase ever creates a payout.** There is no payout API
call, no scheduled job and no UI. Today a creator's money accrues in their Stripe
balance and leaves only if they trigger it themselves from the Express dashboard.

So this decision does not introduce a hold. It replaces an unbounded, undocumented,
accidental hold with a defined 14-day one that then pays out automatically. That is
strictly better for creators than what ships today, and it needs saying that way
when it is announced.

**Implementation:** change the schedule from `manual` to **`weekly`**, with the
14-day hold expressed against it. Stripe then pays out on its own and we write no
payout code. `daily` with `delay_days: 14` is the obvious-looking configuration and
it is the wrong one — see §3.1, where the per-payout fee makes it cost up to
CA$7.50 a month against about CA$1.00 for weekly. `delay_days` is a `daily`
schedule parameter, so confirm how a weekly schedule expresses the hold before
implementing.

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
rather than assuming the risk is gone:

| Case | Typical timing | Covered by a 14-day hold? |
| --- | --- | --- |
| Cancellation before work starts | Days | **Yes** |
| Dissatisfaction reported after delivery | Within 14 days of delivery (Refund Policy §6) | Only if the delivery is within ~14 days of the payment |
| Milestone project cancelled mid-way | Weeks to months after the starting payment | **No** — that payment released long ago |
| Final balance refunded after approval | After the hold | **No** |
| Chargeback | **Up to 120 days**, longer for some reason codes | **No**, and nothing will |
| Fraud, duplicate charge, hidden defect, infringement | No deadline (Refund Policy §6) | **No** |

A deposit taken in January on a three-month commission is paid out in January. If
that project is cancelled in March under the earned-value rules, the hold is
irrelevant.

**So the hold reduces how often we front money; it does not remove the need to be
able to.** The recovery mechanism below stays — it just becomes the exception rather
than the routine path.

**One creator-experience note.** 14 days is in line with the market, so it is not a
competitive problem. But it lands hardest on a brand-new creator waiting on their
first payment. Worth revisiting later with a shorter hold for creators with a clean
history — Stripe supports per-account schedules, so that is a later tuning knob, not
a redesign.

### 6.4 Instant payouts — and the tension with the hold

**Decision: offer creators a paid instant payout — but only on funds that have
already cleared the 14-day hold.**

Stripe supports Instant Payouts for Connect, it settles in about 30 minutes
including weekends, and platforms are explicitly invited to "realize additional
revenue by assessing a fee". It is a good creator feature and a clean revenue line.

**But read plainly, it undoes §6.3.** Stripe's own description is that funds from
card payments are available for instant payout *as soon as the charge completes*.
If a creator can pull money on day 0, the hold protects nothing, every refund goes
back to being platform-funded, and we have paid for a mechanism we then bypass for
the creators most likely to need it.

So the two have to be reconciled deliberately rather than shipped side by side:

| | What it accelerates | Hold intact? |
| --- | --- | --- |
| **Instant payout of released funds** *(decided)* | From "next Friday" to "in 30 minutes" | **Yes** |
| Instant payout of held funds | From "day 14" to "day 0" | No — abandons refund protection |

**The decided version still has a real product in it.** A creator whose funds
release on a Tuesday would otherwise wait until Friday's run. Paying a fee to have
it in 30 minutes is a genuine offer, and it is the common case — most creators
asking for instant payout are asking about money they have already earned and
waited for, not about bypassing a protection they have not thought about.

**Requirements and limits** worth knowing before this is scoped:

- Availability is narrower than Connect generally — Canada, US, UK, EU, AU, NZ, SG,
  HK, MY, NO, SE, DK, AE. It cannot be offered everywhere we onboard.
- **In Canada the payout destination must be a debit card**, not a bank account.
  Several other countries are the same. Onboarding has to collect one, and a
  creator with only a bank account simply cannot use this.
- The connected account must be onboarded under full terms of service, and new
  accounts are not immediately eligible — Stripe gates it on account standing.
- Instant payouts cannot use multi-currency settlement, and there are daily volume
  limits with region-specific reset times.

**Pricing.** Stripe charges a percentage of the payout and we may add a margin. The
exact rate per country is a Stripe portal checklist item — it is not on the public
docs pages and should be read off the account rather than assumed.

**Recommendation on our margin: pass Stripe's fee through at cost, at least at
first.** Marking up a creator's access to money they have already earned and waited
two weeks for is the kind of fee that gets screenshotted. The competitive position
in §3.1 is already tight; this is not where to find margin.

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
| 14-day payout hold, weekly schedule (§6.3) | ● | | |
| Paid instant payouts on released funds (§6.4) | ● | | |
| Admin refunds, full and partial (§6) | ● | | |
| Platform-funded refunds and creator recovery balances (§6.5) | ● | | |
| Monthly fee minimum (§3.1) | ● | | |
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
| Buyer-currency price display / FX (§1.4) | | | ● |
| Paid instant-download sales (`one_time`) | | | ● |
| Creator subscriptions for premium features (§3.3) | | | ● |
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
| Creator payouts | **Held 14 days** after the charge, replacing today's accidental indefinite hold (§6.3) |
| Refund funding | **Made for Stream funds the refund**, then recovers from the creator in-app (§6.5) |
| Creator with an outstanding balance | Listings **blocked from new requests**; existing projects continue and their payments are diverted to the balance (§6.5) |
| Recovery rate | **50% of each base payment** (§6.6) |
| Fee rates | **5% buyer and 5% creator**, both retained (§3) |
| Creator fee minimum | **Once per creator per calendar month**, not per payment — offsetting Stripe's CA$2 monthly active account fee (§3.1) |
| Buyer fee minimum | **None.** Flat 5%, every payment (§3.1) |
| Splitting Stripe's 2.9% onto buyers | **No** — it worsens the buyer-facing price and reads as a card surcharge, which the EU and UK prohibit (§3.2) |
| Payout schedule | **Weekly**, not daily — daily costs up to CA$7.50/creator/month in per-payout fees (§3.1, §6.3) |
| Instant payouts | **Offered, priced, and limited to funds that have cleared the 14-day hold** (§6.4) |
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

2. **Whether the platform or the connected account bears Stripe's 2.9% + CA$0.30**
   — Sprint 0.5, item 2. Not a preference but a fact to look up; it decides a 33%
   swing in net revenue and whether Fee Schedule §5 is true as published (§3.1).

---

## 10. What this document changes about the published policies

| Policy | Change |
| --- | --- |
| All policies | Replace `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]` and `[DMCA_AGENT_EMAIL]` with `inbox@madeforstream.com`; name **Made for Stream** as the entity; remove every `// REVIEW DRAFT` marker and cut non-draft versions. |
| Fee Schedule §1 | Keep the CAD/USD minimums exactly as written — they are correct. Publish the currently enabled currency list with each one's minimums, which §1 already requires before a currency may be enabled. |
| Fee Schedule §1, §3, §4 | Keep the tip and contribution rows — they are being built (§4). Update the examples to show the monthly minimum. |
| Fee Schedule §1 | Remove the buyer service fee minimum — it is now a flat 5% with no minimum (§3.1). The "Minimum per successful base payment: CAD 1.00 / USD 1.00" row on the buyer fee goes. |
| Fee Schedule §2 | Rewrite for the monthly minimum (§3.1). The current text — "Each separately collected instalment can incur a minimum, so splitting a project can cost more than one payment" — becomes wrong and has to change. Add the per-instalment floor and state that the agreement's fee estimate is a maximum. |
| Fee Schedule §3 | Rework every worked example. All six currently apply a buyer minimum that no longer exists and a per-payment creator minimum that is now monthly — the two-instalment example is wrong in both directions. |
| Fee Schedule §5 | Also disclose the **weekly** payout schedule and the paid instant payout option, including that instant payout applies only to funds already released (§6.3, §6.4). |
| Fee Schedule §5 | Disclose the 14-day payout hold explicitly (§6.3); the existing "payout timing depends on..." language is not enough to cover a delay we impose. Add that where a refund exceeds the creator's available balance, Made for Stream funds it and recovers the amount from the creator, including by applying it to subsequent payments (§6.5). Both are new creator obligations and must be disclosed before they can be incurred. |
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

**The API never checks policy acceptance.** `CheckoutPolicyAcceptance` gates the
checkout page on the buyer accepting the current policy versions, and then
`POST /api/stripe/checkout/session` creates the Stripe session without consulting
`policy_acceptances` at all — the string does not appear anywhere in
`api/server.js`. So the acceptance record that a dispute would be argued from is
enforced only in the browser. Per `AGENTS.md`, that is not a boundary. The API must
verify acceptance of the current versions before opening a session.

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
