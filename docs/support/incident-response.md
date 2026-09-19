# Tier 3 — Incident Response

Tier 3 is triggered by **impact**, not by cause. Multiple users affected,
security involved, or data integrity in question.

A known Tier 1 issue that suddenly hits several accounts is a Tier 3 incident.
The agent must escalate it as one even though it knows the fix — because at that
point the fix is treating a symptom and the cause is unknown.

The agent's job in Tier 3 is to **stop, preserve, notify, and contain**. It does
not remediate.

---

## Step 0 — Stop automating

The moment a Tier 3 trigger fires, the agent halts all Tier 1 auto-fixes
**globally**, not just for the affected records. Continuing to auto-fix during
an incident destroys the evidence needed to find the cause and can accelerate
the damage.

Auto-fixes stay off until a human turns them back on.

---

## Step 1 — Preserve evidence

Before anything else, capture and store off to the side:

- Every matching `stripe_webhook_events` row, with full payloads.
- Every affected `listing_request_payments` row, as-is.
- The API logs for the window, verbatim.
- The Stripe event and charge ids involved.
- The exact timestamp of the first occurrence.

Never mutate affected records during collection. If a fix later needs a
before-state, this is the only copy.

---

## Step 2 — Classify

| Class | Means | First concern |
| --- | --- | --- |
| **Security** | Auth, RLS, authorization failures, signature failures, payment identity mismatch | Is someone accessing what they should not |
| **Data integrity** | Constraint violations, sequence-guard violations, records disagreeing with Stripe | Is our record of what was paid and delivered still true |
| **Availability** | Webhooks stopped, API down, checkout failing broadly | Can people transact at all |
| **Financial** | Wrong amounts, wrong recipient, duplicate charges | Is money in the wrong place |

An incident can be more than one. Classify for all that apply — the containment
differs.

---

## Step 3 — Notify

Immediately, in this order:

1. **Alvin** — direct message plus phone push. Always first, always regardless of
   hour. The escalation package from
   [`agent-contract.md`](agent-contract.md) applies, plus the classification and
   the containment actions the agent is recommending.
2. **Nobody else, yet.** There is no second responder configured. If that changes
   before launch, update this list rather than improvising during an incident.

The notification says what is happening, what the agent has already stopped, and
what it recommends locking down. It does not wait for a complete diagnosis —
speed matters more than completeness here.

---

## Step 4 — Contain

The agent **recommends** containment; Alvin **executes** it. The agent does not
have lockdown authority, because every lockdown action below has real business
cost and one of them is irreversible in practice.

Containment options, in rough order of escalating cost:

| Action | Blast radius | How |
| --- | --- | --- |
| Disable Tier 1 auto-fixes | None to users | Already done in step 0 |
| Pause a single creator's listings | One creator | Set `is_active = false` |
| Stop new checkouts | All new payments; in-flight unaffected | `VITE_STRIPE_PAYMENTS_ENABLED=false` |
| Pause webhook processing | Payment state stops updating; Stripe retries for ~3 days | Stop the API, or return 500 from the webhook route so Stripe retries |
| Take the API down | All payments, Twitch, Connect | Stop the service |
| Full site offline | Everything | Last resort |

**On pausing webhooks:** Stripe retries failed deliveries with backoff for about
three days. Returning a non-2xx is therefore a *safe pause* — events are not
lost, they queue. Do not swallow events with a 200 to make the noise stop; that
is the one containment action that loses data permanently.

**On the payments flag:** `VITE_STRIPE_PAYMENTS_ENABLED=false` hides the payment
UI but does not invalidate in-flight Stripe sessions. Buyers mid-checkout can
still complete. Treat it as "no new payments start", not "all payments stop".

---

## Step 5 — Customer communication

**Alvin writes and sends all customer communication.** The agent drafts, never
sends. This is absolute — see the forbidden list in
[`agent-contract.md`](agent-contract.md).

What the agent prepares:

- The list of affected users, with what specifically happened to each.
- Whether their money is safe, and where it currently sits. This is the question
  every affected person will actually ask, and it should be answered
  per-person, not generically.
- A draft message for each affected group.

Principles for the message:

- **Say what happened in plain terms.** Creators and buyers here are not
  engineers, and a vague message reads as a cover-up.
- **Lead with money.** If funds are safe, say so in the first line. If they are
  not, say that in the first line instead.
- **Say what they need to do.** Usually nothing — say that explicitly rather
  than leaving it open.
- **Give a next update time**, and meet it, even with "still working on it".
- **Do not speculate on cause** while the incident is open.

Who to tell:

| Situation | Tell |
| --- | --- |
| Money moved wrongly or is stuck | Every affected buyer and creator, individually |
| Data exposed across accounts | Every user whose data was reachable, regardless of whether it was read |
| Availability only, no data or money impact | Only those who tried and failed, unless it was prolonged |
| Contained with zero user impact | Nobody — log it and move on |

If personal data was exposed, there may be a notification deadline depending on
where the affected users live. That is a question for Alvin and, if it is real,
for a lawyer — not a decision the agent or an engineer makes alone.

---

## Step 6 — Resolve and close

1. Fix the cause, not the symptom.
2. Verify every affected record individually. Not a sample — during an incident
   the tail is where the bad ones hide.
3. Re-enable Tier 1 auto-fixes, deliberately, as a separate step.
4. Send the closing customer update.

---

## Step 7 — Write it down

Not optional. Within a day, while it is still fresh:

- **Add the issue to its playbook** with the signal that would have caught it
  sooner. If the agent had no signal for it, that gap is the most important
  output of the whole incident.
- **Add a Tier 3 trigger** if the existing triggers did not fire, or fired late.
- **Add the containment step** to the table above if a new one was used.
- **Record what the agent got wrong** — a bad match, a missed signal, a fix that
  made it worse — in the playbook, so the next version does not repeat it.

An incident that produces no playbook change either was not understood or will
happen again.
