---
feature: requests/milestones
status: active
surfaces:
  - public.listing_request_milestone_submissions
  - supabase/migrations/20260618_103_enforce_milestone_submission_sequence.sql
  - supabase/migrations/20260618_105_enforce_milestone_payment_sequence.sql
  - supabase/migrations/20260619_106_align_milestone_sequence_guards.sql
unmatched_tier: 2
---

# Milestones — Support Playbook

Milestone projects split the work and the money into stages. The creator submits
a milestone, the buyer approves it or requests a revision, and the associated
payment is taken. Several database guards enforce that milestones are submitted,
approved and paid **in order**.

Those sequence guards are the important thing in this playbook. They exist
because out-of-order milestone payments mean money changing hands for work that
was never staged — so a sequence-guard violation is never "just" a validation
error. It is the system reporting that the workflow is in a state it should not
be able to reach.

**Any sequence-guard violation is Tier 3.** Do not retry it.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't submit this milestone" | [`MIL-001`](#mil-001--milestone-submitted-out-of-order) |
| "Buyer approved but it didn't unlock" | [`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance) |
| "My submission was rejected" | [`MIL-002`](#mil-002--submission-content-rejected) |
| "It won't let me approve" | [`MIL-003`](#mil-003--invalid-milestone-response) |

---

## `MIL-001` — Milestone submitted out of order

```yaml
id: MIL-001
tier: 3
signals:
  - source: db
    match: "Another milestone must be resolved before this milestone can be submitted."
  - source: db
    match: "Earlier milestones must be completed before this milestone can be submitted."
auto_fix: none
reason_not_automatable: "workflow integrity guard; retrying cannot help and may compound"
escalate_with:
  - "every milestone for the request with its state and payment status"
  - "the milestone that was attempted and the one blocking it"
  - "whether any payment has been taken out of sequence"
```

**Cause.** Two readings, and they need separating.

**Benign:** the UI offered a submit action for a milestone that is not next. A
front-end bug, annoying but harmless — the guard held.

**Not benign:** the milestones are genuinely in an inconsistent state, which can
mean a payment applied to the wrong stage.

**Why Tier 3 either way.** The two are indistinguishable from the error alone,
and the second involves money against the wrong work. Verify the whole milestone
chain before deciding it was only a UI bug.

**Fix.** None automated. Walk the full sequence and confirm each milestone's
state and payment agree.

**Money impact.** Potentially wrong. Milestone payments are released against
staged work; out-of-order submission means that link may be broken.

---

## `MIL-002` — Submission content rejected

```yaml
id: MIL-002
tier: 2
signals:
  - source: db
    match: "Milestone submission summary must be between 10 and 4000 characters."
  - source: db
    match: "A milestone submission can contain no more than 20 delivery links."
  - source: db
    match: "Each milestone delivery link must be 2000 characters or fewer."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "the 20-link limit is hit repeatedly"   # the limit may be too low for real work
```

**Cause.** Server-side validation on submission content.

**What the user sees.** A rejected submission after writing it up, which for a
creator delivering work is a bad moment.

**Fix.** Adjust the content. If the link limit is being hit regularly, that is
worth revisiting — some deliverables legitimately have many files, and the limit
is a guess rather than a requirement.

**Money impact.** None. Delivery is delayed.

---

## `MIL-003` — Invalid milestone response

```yaml
id: MIL-003
tier: 2
signals:
  - source: db
    match: "Milestone response must be buyer_approved or revision_requested."
  - source: db
    match: "A revision request reason of at least 10 characters is required."
  - source: db
    match: "Approval responses cannot include a revision request reason."
  - source: db
    match: "Milestone could not be found."
auto_fix: none
reason_not_automatable: "user input or client payload"
escalate_if:
  - "an approval arrives carrying a revision reason"   # client bug
  - "Milestone could not be found"                     # data inconsistency
```

**Cause.** Mostly user input — a revision request with no reason. But an approval
carrying a revision reason is a client bug, and "could not be found" is a data
problem rather than either.

**Fix.** For the input case, supply a reason. The 10-character minimum exists so
the creator gets something actionable rather than "no".

**Money impact.** None directly. Approval usually releases a payment, so a
blocked approval is a blocked payment.

---

## `MIL-004` — Milestone payment confirmation restricted

```yaml
id: MIL-004
tier: 2
signals:
  - source: db
    match: "Only admins can confirm milestone payments."
  - source: db
    match: "A milestone payment must reference a milestone agreement item."
  - source: db
    match: "A milestone payment references an unknown agreement item."
  - source: db
    match: "Only milestone payments can reference milestone agreement items."
auto_fix: none
reason_not_automatable: "admin confirmation is a manual fallback, not the production path"
escalate_with:
  - "why manual confirmation was being attempted"
  - "the Stripe payment state for the milestone"
```

**Cause.** Someone attempted the admin manual-confirmation path, or a payment was
linked to the wrong agreement item.

**Important context.** The `admin_confirm_*_payment` RPCs are a **break-glass
fallback from before automated Stripe payments existed**. The production path is
the webhook. If manual confirmation is being used routinely, the automated path
is failing and that is the actual problem to investigate — see
[`webhooks.md`](../payments/webhooks.md).

**Fix.** Investigate why the automated path did not fire before confirming
anything by hand.

**Money impact.** Manual confirmation marks a payment as received **without
verifying that money actually moved.** Used incorrectly, it releases work against
a payment that never happened. Treat it as a last resort.

---

## Known gaps

- **No alerting on sequence-guard violations.** `MIL-001` is Tier 3 but nothing
  detects it automatically.
- **Manual admin confirmation is still reachable in the admin UI** and is not
  labelled as break-glass, so nothing stops it being used as a routine fix.
- **Link limit of 20** has not been validated against real deliverables.
- **A milestone the buyer never responds to** now has a documented, implemented
  path via the same non-response notice and administrative closure flow as any
  other stalled request — see [`request-lifecycle.md`](request-lifecycle.md)
  `REQ-003`. It closes the request, not just the one milestone; there is no
  milestone-scoped variant.
