---
feature: requests/agreements
status: active
surfaces:
  - public.listing_request_agreements
  - public.listing_request_agreement_items
  - public.listing_request_payment_schedule_items
  - supabase/migrations/20260905_110_bridge_payment_schedule_to_stripe_payments.sql
unmatched_tier: 2
---

# Project Agreements — Support Playbook

The agreement is the record of what was agreed: scope, timeline, revision policy,
required buyer confirmations, and the payment schedule. Buyer acceptance of the
agreement is what turns a conversation into a commitment, and it is what a
dispute is later argued from.

Payment timing is chosen here — full prepayment, deposit plus balance, or
milestones — and the schedule items created here become the actual Stripe
payments later. **Errors in this playbook are therefore money errors in waiting.**

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't send the agreement" | [`AGR-001`](#agr-001--agreement-totals-do-not-reconcile), [`AGR-002`](#agr-002--agreement-not-in-a-sendable-state) |
| "The buyer can't accept it" | [`AGR-003`](#agr-003--required-confirmations-not-acknowledged) |
| "Milestone amounts are rejected" | [`AGR-001`](#agr-001--agreement-totals-do-not-reconcile) |
| "It says the amount is too small" | [`PAY-004`](../payments/checkout.md#pay-004--payment-amount-or-fee-setup-is-invalid) |

---

## `AGR-001` — Agreement totals do not reconcile

```yaml
id: AGR-001
tier: 2
signals:
  - source: db
    match: "Milestone item amounts must equal the agreement total."
  - source: db
    match: "Milestone payment amounts must equal the agreement total."
  - source: db
    match: "Every milestone must have an amount greater than zero."
  - source: db
    match: "Every milestone must have a matching payment schedule item."
  - source: db
    match: "Every milestone payment must reference its milestone agreement item."
  - source: db
    match: "Milestone payment agreements require at least two milestones."
  - source: db
    match: "Milestone item correlation keys must be unique."
auto_fix: none
reason_not_automatable: "the agent may never adjust money figures"
escalate_with:
  - "the agreement total and the sum of milestone amounts"
  - "the payment schedule items and their correlation keys"
```

**Cause.** The milestone breakdown does not add up to the agreement total, a
milestone has no matching schedule item, or correlation keys collide. These
checks exist so the sum of what the buyer will be charged always equals what was
agreed.

**What the user sees.** The agreement refuses to save, usually with a message
about amounts not matching — often after a long form, which makes it costly.

**Fix.** Correct the figures so the milestones sum to the total. **The agent must
never adjust an amount to make a total reconcile.** A silently balanced
agreement is a false record of what two people agreed.

Rounding is a common cause: three milestones on an odd total cannot split evenly,
and the remainder has to land somewhere explicitly.

**Money impact.** None yet — this is the check preventing a mismatch. Which is
exactly why it must not be worked around.

---

## `AGR-002` — Agreement not in a sendable state

```yaml
id: AGR-002
tier: 2
signals:
  - source: db
    match: "Agreement status must be draft or sent."
  - source: db
    match: "Agreement response must be buyer_accepted or buyer_declined."
  - source: db
    match: "Agreement items must be provided as an array."
  - source: db
    match: "Payment schedule items must be provided as an array."
  - source: db
    match: "Unsupported payment timing: %."
auto_fix: none
reason_not_automatable: "state machine or malformed payload"
escalate_if:
  - "an array or payment-timing error occurs"   # client bug, not user error
```

**Cause.** Two different things share this entry. Status errors are ordinary
out-of-order actions, usually a stale page. The array and payment-timing errors
are **client bugs** — the UI sent something malformed, and no user action
produces them.

**Fix.** For status errors, refresh. For malformed payloads, it is a front-end
defect and should be treated as one rather than explained to the user.

**Money impact.** None directly.

---

## `AGR-003` — Required confirmations not acknowledged

```yaml
id: AGR-003
tier: 2
signals:
  - source: db
    match: "You must acknowledge every required agreement item before accepting."
auto_fix: none
reason_not_automatable: "acknowledgement is the buyer's act and the point of the feature"
```

**Cause.** The buyer tried to accept without ticking every required confirmation.

**What the user sees.** Acceptance refused, sometimes without it being obvious
which item is outstanding — worth checking whether the UI marks them clearly,
because this is a conversion-critical moment.

**Fix.** The buyer acknowledges the remaining items. **Nobody may acknowledge on
a buyer's behalf**, including support and including the agent. These
confirmations are the evidence that the buyer agreed to specific terms, and an
acknowledgement they did not make is worthless in a dispute — worse than
worthless, because it looks like evidence.

**Money impact.** None yet. High value later: these confirmations are the core
evidence in [`REF-003`](../payments/refunds-and-disputes.md#ref-003--dispute-opened-against-a-creator).

---

## `AGR-004` — Payment schedule item missing at payment time

```yaml
id: AGR-004
tier: 2
signals:
  - source: db
    match: "Payment schedule item % was not found."
  - source: db
    match: "No starting payment item is available to confirm."
  - source: db
    match: "This starting-payment schedule item is not awaiting payment."
auto_fix: none
reason_not_automatable: "data inconsistency between agreement and payment records"
escalate_with:
  - "the agreement's schedule items and their states"
  - "existing listing_request_payments rows for the request"
```

**Cause.** The bridge from agreement schedule to Stripe payment could not find
the expected item, or it is not in the expected state. Either it was already
consumed or the agreement changed underneath it.

**What the user sees.** A payment that cannot be started, on a project that
appears ready to pay.

**Fix.** Manual reconciliation of schedule items against payment rows. Do not
create a schedule item to satisfy the error.

**Money impact.** Blocked payment. If it recurs, it is a data-integrity issue and
belongs at Tier 3.

---

## Known gaps

- **Change orders modify agreed terms** but the interaction between an amended
  agreement and already-created schedule items is not documented here. See
  [`change-orders.md`](change-orders.md).
- **No agreement versioning documented** for support purposes — if terms change,
  which version a dispute is argued from is not written down anywhere.
- **Fee minimums are minor-unit-denominated** and applied to whatever currency the
  agreement carries. Correct for CAD and USD; wrong for a currency with a different
  minor-unit convention, so such an agreement can pass these checks and produce a
  wrong or rejected charge later — see
  [`PAY-004`](../payments/checkout.md#pay-004--payment-amount-or-fee-setup-is-invalid).
