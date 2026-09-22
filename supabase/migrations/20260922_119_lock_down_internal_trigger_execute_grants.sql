-- Follow-up to 20260921_118_lock_down_fee_rpc_execute_grants.sql, which found
-- that "revoke ... from public" does not remove EXECUTE from anon/authenticated
-- on Supabase (those roles are granted EXECUTE on new public-schema functions
-- independently of the PUBLIC pseudo-role). 118 only covered the three
-- functions touched by that day's fee-rate migration; this migration sweeps
-- the rest of the codebase's security definer functions for the same gap.
--
-- Confirmed live via information_schema.role_routine_grants: every function
-- revoked below had EXECUTE granted to anon and authenticated (most also still
-- had it granted to the PUBLIC pseudo-role, i.e. the original
-- "revoke ... from public" was either never applied to them or, in one case,
-- applied but insufficient).
--
-- All of them are "returns trigger" functions bound to a single trigger
-- (confirmed by grepping "create trigger ... execute function" for each name)
-- except refresh_listing_request_agreement_progress_schedule, which is a plain
-- function called only via `perform` from two of the trigger functions below
-- (sync_listing_request_progress_update_schedule and
-- sync_listing_request_agreement_progress_schedule) and from a one-time
-- backfill in 20260607_081_track_progress_update_schedule_dates.sql. No
-- client code calls any of these by name (grepped supabase.rpc(...) call
-- sites across src/), and none has a "grant execute ... to authenticated"
-- following its creation the way client-facing RPCs like
-- has_ready_creator_payment_account do.
--
-- Trigger functions are inert if called directly regardless of grants --
-- Postgres refuses to run a "returns trigger" function outside real trigger
-- context -- so revoking here is hygiene, same as lock_listing_request_agreement_fee_rates
-- in 118. refresh_listing_request_agreement_progress_schedule is the
-- exception: it is an ordinary void-returning function that unconditionally
-- looks up and overwrites last_progress_update_at, next_progress_update_due_at,
-- and progress_update_requirement_satisfied_at for whatever agreement id it is
-- given. Left callable by anon/authenticated, anyone could force-recompute
-- (and in some branches null out) the progress-update schedule on any other
-- buyer/creator's agreement -- a real state-mutation gap, not just an inert
-- grant.
--
-- protect_listing_request_completion is a special case: it exists live
-- (as trigger listing_requests_protect_completion on public.listing_requests)
-- but has no corresponding CREATE FUNCTION in supabase/migrations -- schema
-- drift predating this audit, not introduced here. It fits the same pattern
-- (trigger-only, never revoked from public or anon/authenticated) so it is
-- included below; see the audit note in docs/support/payments/checkout.md.
--
-- Revoking anon/authenticated does not affect any of these code paths: the
-- schedule-item/agreement/conversation trigger chains and the other security
-- definer functions that call refresh_listing_request_agreement_progress_schedule
-- all execute as the function owner regardless of who fired the triggering
-- statement or RPC.

revoke execute on function public.capture_listing_revision()
  from public, anon, authenticated;

revoke execute on function public.close_conversation_when_listing_request_completed()
  from public, anon, authenticated;

revoke execute on function public.close_conversation_when_listing_request_declined()
  from public, anon, authenticated;

revoke execute on function public.complete_listing_request_after_final_delivery_approval()
  from public, anon, authenticated;

revoke execute on function public.create_conversation_for_listing_request()
  from public, anon, authenticated;

revoke execute on function public.create_listing_request_change_order_payment()
  from public, anon, authenticated;

revoke execute on function public.create_listing_request_milestone_from_payment()
  from public, anon, authenticated;

revoke execute on function public.create_listing_request_payments_when_agreement_accepted()
  from anon, authenticated;

revoke execute on function public.enforce_final_delivery_approval_milestone_payments()
  from public, anon, authenticated;

revoke execute on function public.enforce_final_delivery_milestone_payments()
  from public, anon, authenticated;

revoke execute on function public.enforce_listing_payment_account_readiness()
  from public, anon, authenticated;

revoke execute on function public.enforce_listing_request_milestone_buyer_response_sequence()
  from public, anon, authenticated;

revoke execute on function public.enforce_listing_request_milestone_payment_sequence()
  from public, anon, authenticated;

revoke execute on function public.enforce_listing_request_milestone_submission_sequence()
  from public, anon, authenticated;

revoke execute on function public.handle_conversation_message_insert()
  from public, anon, authenticated;

revoke execute on function public.log_listing_request_agreement_conversation_event()
  from public, anon, authenticated;

revoke execute on function public.log_listing_request_status_change()
  from public, anon, authenticated;

revoke execute on function public.protect_listing_request_completion()
  from public, anon, authenticated;

revoke execute on function public.refresh_listing_request_agreement_adjusted_completion()
  from public, anon, authenticated;

revoke execute on function public.refresh_listing_request_agreement_progress_schedule(uuid)
  from public, anon, authenticated;

revoke execute on function public.set_listing_request_archive_metadata()
  from public, anon, authenticated;

revoke execute on function public.sync_listing_request_agreement_progress_schedule()
  from public, anon, authenticated;

revoke execute on function public.sync_listing_request_progress_update_schedule()
  from public, anon, authenticated;
