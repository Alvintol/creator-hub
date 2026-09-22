-- 20260921_117 revoked EXECUTE on its new functions "from public", following the
-- pattern already used elsewhere in this codebase. On Supabase that is not
-- sufficient: the anon and authenticated roles are granted EXECUTE on new
-- functions in the public schema independently of the PUBLIC pseudo-role, so
-- "revoke ... from public" leaves both roles with direct access. Confirmed live
-- via information_schema.role_routine_grants after applying 117 -- anon had
-- EXECUTE on all three functions below.
--
-- None of these are meant to be called directly by a client:
--   * resolve_listing_request_fee_rates is an internal fee-rate lookup. Callable
--     by anon today it is harmless (it always returns the standard rate), but it
--     becomes a public oracle for "does this buyer/creator have a discount" once
--     a rate can differ per user, which is the entire point of section 3.5.
--   * lock_listing_request_agreement_fee_rates is a trigger function (returns
--     trigger). Postgres refuses to invoke it outside real trigger context, so
--     the grant is inert -- revoked here for hygiene and to keep the advisor
--     clean, not because it is exploitable.
--   * ensure_listing_request_payment_for_schedule_item is pre-existing, carried
--     forward unchanged by 117's rewrite. Called with an arbitrary schedule item
--     id belonging to someone else's request, it lets an anonymous caller either
--     learn whether a payment already exists for that item (the id is returned)
--     or cause a real listing_request_payments row to be created ahead of the
--     buyer's own action. This is the boundary AGENTS.md calls out directly:
--     enforcement belongs at the database, and a security definer RPC meant to
--     be reached only through the trigger chain must not be independently
--     callable.
--
-- All three are only ever invoked from other security definer functions
-- (the schedule-item trigger chain), which execute as their owner regardless of
-- who fired the triggering statement. Revoking anon/authenticated does not
-- affect that path.
revoke execute on function public.resolve_listing_request_fee_rates(uuid, uuid)
  from anon, authenticated;

revoke execute on function public.lock_listing_request_agreement_fee_rates()
  from anon, authenticated;

revoke execute on function public.ensure_listing_request_payment_for_schedule_item(uuid)
  from anon, authenticated;
