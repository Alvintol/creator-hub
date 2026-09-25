# Launch Rehearsal Runbook (test mode)

Sprint 8's last gate (`launch-implementation-checklist.md`). **Written 2026-09-23, not
yet run.** Nothing in this file has been executed; tick the boxes as you go and record
the ids you used, so "has this been rehearsed" has an answer.

A passing run clears **CAD and USD** for launch. The EUR run proves the money path works
in a second currency in test mode. It does **not** clear EUR, GBP or any other wave 2
currency for live sales: that stays gated on the Sprint 7 tax advice
(`docs/support/payments/tax.md`).

---

## 0. Before you start

- [ ] **Apply `20260923_138` together with the web deploy.** The migration drops the
      three-argument `respond_listing_request_agreement`. An old web build then gets
      `AGR-007`'s refusal when a buyer accepts an agreement, and a new build against
      an unmigrated database gets "function does not exist". Apply the migration,
      then deploy the web app straight away. Deploy the API in the same window (it
      reads `api/policyVersions.js` and `api/supportedCurrencies.js`).
- [ ] Confirm what is applied: there is one Supabase project
      (`itbgxxczuazwroniiyot`), and `list_migrations` is unreliable on it, so query
      objects directly:
      ```sql
      select to_regclass('public.supported_currencies') is not null as has_138,
             exists (select 1 from information_schema.columns
                     where table_name = 'listing_request_payments'
                       and column_name = 'tax_cents') as has_137;
      ```
- [ ] **The rehearsal writes to that same project**, next to real rows. Use obviously
      named test accounts (`rehearsal-*`) so the rows can be found later. Never
      delete rows afterwards: acceptance records and the payment ledger are
      append-only by design.
- [ ] Cloudflare Email Routing forwards `support@`, `legal@`, `privacy@`,
      `copyright@`, `disputes@`, `safety@` and `appeals@`. Send one test mail to
      each and confirm it arrives.
- [ ] The API (Cloud Run) and web app are on **test** Stripe keys, and the Connect
      webhook endpoint is registered in test mode.
- [ ] `STRIPE_TAX_COLLECTION_COUNTRIES` is empty (collection off).
- [ ] Three creator accounts, onboarded through payout settings in Stripe test mode:
      **CA/CAD**, **US/USD**, and one in the euro area (e.g. IE) with **EUR**. One
      buyer account per currency is enough.
- [ ] **Browser-check the Storage Register** (Cookie Policy §7) on the deployed
      site: DevTools → Application. The published register lists
      `sb-itbgxxczuazwroniiyot-auth-token`, `creatorhub.pendingPolicyAcceptance`,
      `creatorhub.cookiePreferences`, `creatorhub-theme` and Stripe's `__stripe_mid`
      / `__stripe_sid`. It was built from the source, not from a live browser. If
      anything else appears (e.g. a Cloudflare `__cf_bm` cookie from the site's
      proxy), add it, bump the Cookie Policy version and record its fingerprint.

Useful queries throughout (replace the ids):

```sql
-- Every payment on a request, with the fee arithmetic to check by hand
select id, payment_type, status, currency, base_amount_cents, buyer_service_fee_cents,
       creator_platform_fee_cents, creator_tip_cents, platform_support_cents,
       recovery_instalment_cents, tax_cents, tax_treatment, application_fee_cents,
       total_checkout_cents, buyer_service_fee_minimum_cents, creator_platform_fee_minimum_cents
from public.listing_request_payments
where listing_request_id = '<request>' order by created_at;

-- Acceptance evidence for the request
select policy_type, policy_version, accepted_at
from public.policy_acceptances
where related_listing_request_id = '<request>' order by accepted_at;
```

For every paid row: `buyer_service_fee_cents = ceil(base × 5%)`, the same for the
creator fee, **both `_minimum_cents` columns are 0**, `total_checkout_cents = base +
buyer fee + tip + support + tax`, and `tax_treatment = 'not_collected'`.

---

## 1. Happy path, once in each currency (CAD, USD, EUR)

Record the request id per currency: CAD `____` USD `____` EUR `____`

- [ ] Buyer submits a request. Creator accepts it.
- [ ] Creator builds a **milestone** agreement with a deposit and two milestones,
      every payment ≥ 10.00. **Summary shows the fee line as a maximum**, with the
      right figure (5% of each item, rounded up, summed).
- [ ] Negative checks before sending (each must refuse with `AGR-005`'s message and
      send nothing):
  - [ ] a 9.99 milestone, in the builder;
  - [ ] the same through a direct RPC call (`create_listing_request_agreement`
        with a 9.99 schedule item), which proves the database refuses it, not just
        the form.
- [ ] Send. Buyer opens it: the **early-start box is separate** from the
      acknowledgements, and Accept stays disabled until it is ticked.
- [ ] Negative check: call `respond_listing_request_agreement` directly with
      `buyer_accepted`, every acknowledgement key and **no**
      `p_early_service_request_version`. Refused with `AGR-007`; the agreement stays
      `sent`.
- [ ] Accept. `policy_acceptances` has an `early_service_request` row for the
      request at the current Refund Policy version (`2026-09-24`).
- [ ] Starting payment checkout: the policy step shows the Fee Schedule / Refund
      Policy box but **not** the early-start box again. Add a **tip and a
      contribution** on this payment. Billing-country step, tax row reads as
      not collected. Pay with `4242 4242 4242 4242`.
- [ ] Webhook marks it paid, and the workflow advances. The fee arithmetic above
      holds. `listing_request_payment_tax_evidence` has the billing country and the
      card country (country codes only).
- [ ] Milestone 1: creator submits, buyer approves, milestone payment paid.
- [ ] **Change order:** first try +5.00, which the creator's send must refuse
      (`AGR-005`, via the change-order trigger). Then +15.00: send, buyer accepts,
      payment paid.
- [ ] Milestone 2, then final delivery, final balance paid, project completed.
- [ ] Receipt emails arrived for each payment (transactional email, Sprint 6).

## 2. Two payments in the same month

The scope asks to prove "the minimum is charged once". There are no fee minimums
since `20260921_117`, so the check is now that **no minimum is charged at all**.

- [ ] On the CAD creator, in the same calendar month, take two separate paid
      payments of **10.00** each (two small projects, or deposit + balance).
- [ ] Each shows buyer fee 50 and creator fee 50 (5%), both `_minimum_cents` = 0.
      Neither shows 100/150.

## 3. Cancellation

- [ ] **Before payment:** accept an agreement, cancel before paying. Nothing is
      charged, and no payment row reaches `paid`.
- [ ] **After work starts:** on a paid project, the buyer requests cancellation,
      the creator submits the itemised statement, and the buyer accepts it. The
      refund matches earned value (`docs/support/requests/cancellation.md`).

## 4. Refunds

- [ ] Partial refund of a paid base (e.g. 40 of 100). The buyer fee refunded is
      proportional (2.00), the creator fee is reversed proportionally, tip and
      contribution are untouched, and the tax lines stay 0.
- [ ] A second partial refund, then a full refund of the remainder. The cumulative
      fee refunds equal the original fees exactly, with no rounding drift
      (`listing_request_payment_refunds`).
- [ ] Refund a tip or contribution explicitly (Refund Policy §8).

## 5. Payout hold

- [ ] For each test connected account, read its payout schedule (Stripe Dashboard,
      or `stripe.balance.retrieve` on the account). Record the delay days: CA
      `__`, US `__`, EUR `__`. §6.3 was confirmed at 7 days for CA only; this
      records the other two.
- [ ] Refund a payment **inside** the hold. It is funded from the creator's
      pending balance, with no platform funding and no recovery balance.

## 6. Recovery balance

- [ ] On a creator whose Stripe balance cannot cover it (test mode: use a payment
      that has already paid out, or refund more than the available balance), issue
      a refund. Made for Stream funds the shortfall and a `creator_recovery_balances`
      row opens (`docs/support/payments/creator-recovery-balances.md`).
- [ ] The creator's listings refuse **new** requests; existing projects continue.
- [ ] The creator's next payment diverts up to 50% of base into
      `recovery_instalment_cents`, and the balance falls by that amount.
- [ ] Settle the rest by card from payout settings. The balance reaches zero, and
      new requests are accepted again.

## 7. What to record afterwards

- [ ] Tick Sprint 8's rehearsal item in `launch-implementation-checklist.md`, with
      the date, the three request ids and any failures.
- [ ] Anything that fails: file it against its playbook issue, or write a new one.

---

## Carried gaps the rehearsal may run into

These are known, recorded under "Carried, not launch-blocking", and not defects
of the rehearsal:

- **`account.updated` is not handled, and nothing resyncs `creator_payment_accounts`
  on a schedule.** If Stripe test mode restricts a test account mid-run, the mirror
  goes stale until the creator revisits payout settings.
- **No alerting** for `PAY-005` (stuck payments), `CHG-003`, Sprint 6's staleness
  query, or `TAX-002`–`TAX-004`. Run those queries by hand at the end.
- **`processing` state.** Card payments won't hit it. Don't test local payment
  methods (SEPA and so on): they are not supported until that rework lands.
- **Change orders vs milestone schedules.** After step 1's change order, check
  `AGR-001`'s totals query still reconciles. If it doesn't, that's the known gap in
  `change-orders.md`.
- **Delivery links are not verified.** Final delivery accepts any URL.
