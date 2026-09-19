---
feature: creators/applications
status: active
surfaces:
  - public.seller_applications
  - public.seller_application_samples
  - src/hooks/creatorApplication/
  - src/domain/creatorApplication/
unmatched_tier: 2
---

# Creator Applications — Support Playbook

Creators apply, submit portfolio samples, and wait for admin approval. Approval
is the gate for everything else: without it a creator cannot connect Stripe, and
without Stripe they cannot publish. The chain is
**approval → payout onboarding → published listing**, and a stall anywhere in it
looks the same to the creator: nothing is happening.

Nothing here is auto-fixable. Approval is a human judgement and stays one — the
agent is explicitly forbidden from writing `seller_applications`.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Applications are closed" | [`APP-001`](#app-001--application-capacity-reached) |
| "I can't submit my application" | [`APP-002`](#app-002--application-not-in-a-submittable-state) |
| "My form won't save" | [`APP-003`](#app-003--field-validation-rejected) |
| "I've heard nothing back" | [`APP-004`](#app-004--application-waiting-too-long) |
| "I'm approved but can't publish" | [`connect-onboarding.md`](../payments/connect-onboarding.md) |

---

## `APP-001` — Application capacity reached

```yaml
id: APP-001
tier: 2
signals:
  - source: db
    match: "Creator applications are full right now. Please check again later."
auto_fix: none
reason_not_automatable: "capacity is a deliberate business setting"
escalate_with:
  - "current application count against the cap"
  - "how many are pending review versus already resolved"
```

**Cause.** A deliberate cap on open applications, working as designed.

**What the user sees.** A closed door, with no indication of when it reopens.

**Fix.** Not a bug. But the escalation matters: if the cap is full of *pending*
applications rather than processed ones, the bottleneck is review throughput, not
capacity — and raising the cap would make that worse rather than better.

**Money impact.** None directly. Every blocked applicant is a creator who may not
come back.

---

## `APP-002` — Application not in a submittable state

```yaml
id: APP-002
tier: 2
signals:
  - source: db
    match: "Application could not be submitted. Only draft or needs-changes applications can be submitted."
auto_fix: none
reason_not_automatable: "state machine working correctly; the UI is what is wrong"
escalate_with:
  - "the application's actual status"
  - "whether the UI was showing a submit action for it"
```

**Cause.** Only `draft` and `needs_changes` applications can be submitted. A
double-click, a stale tab, or an already-submitted application produces this.

**What the user sees.** An error on submit, often on an application they believe
is unsubmitted.

**Fix.** Refresh and check the real status. If the UI offered submit for an
application in another state, that is a front-end bug worth fixing rather than
explaining repeatedly.

**Money impact.** None.

---

## `APP-003` — Field validation rejected

```yaml
id: APP-003
tier: 2
signals:
  - source: db
    match: "Additional details must be 1000 characters or less."
  - source: db
    match: "Please add at least 10 characters of detail when choosing Other."
  - source: db
    match: "Admin notes must be 2000 characters or less."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "a limit is hit frequently"   # the limit may be wrong, not the users
```

**Cause.** Server-side validation catching input the client should have caught
first.

**What the user sees.** A rejection after submitting, sometimes losing what they
typed — which for a long application is genuinely infuriating.

**Fix.** Shorten the input. But note the pattern: **these firing at all means
client-side validation is missing or inconsistent.** The server check is the
backstop, not the intended user experience.

**Money impact.** None. Costs goodwill at a first impression.

---

## `APP-004` — Application waiting too long

```yaml
id: APP-004
tier: 2
signals:
  - source: db
    where: public.seller_applications
    match: "status = 'submitted' AND updated_at < now() - interval '7 days'"
  - source: user_report
    match: "applicant asking about status"
auto_fix: none
reason_not_automatable: "review is a human decision; the agent may never approve"
escalate_with:
  - "count and age of the pending queue"
  - "the oldest pending application"
```

**Cause.** The review queue is not being worked.

**What the user sees.** Silence. They do not know whether they were rejected,
forgotten, or are still in a queue.

**Fix.** Review the queue. **The agent must never approve or reject an
application** — it is on the forbidden list. It may only surface the backlog.

**Why it is worth alerting on.** This is a business failure that generates no
errors. Nothing is broken, so nothing reports it, and the only signal is
applicants giving up quietly.

**Money impact.** None directly, and significant in aggregate — unapproved
creators are unlisted inventory.

---

## Known gaps

- **No queue-age alerting.** `APP-004` has to be run by hand.
- **No applicant-facing status visibility** beyond the raw state, so "how long
  will this take" cannot be answered in-product.
- **Portfolio sample storage failures are undocumented.** Upload errors fall
  through to Tier 2 unmatched.
- **No rejection-reason playbook.** What applicants are told when declined, and
  whether they may reapply, is not defined anywhere.
