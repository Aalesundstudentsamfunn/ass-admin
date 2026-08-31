-- Stello's envelope payload: event-level idempotency, ordering, and refunds.
--
-- Stello replaced the flat membership-shaped body with one envelope shared by
-- every event type, and added `membership.refunded`. Three things follow for the
-- database, and none of them fit the table we had.
--
--   1. The idempotency key moved. It used to be the pass id, which worked while
--      a pass could only ever be purchased. A pass can now be purchased and then
--      refunded - two deliveries, one pass - so `stello_membership_purchases`
--      can no longer be both the record of a pass and the record of a delivery.
--      The ledger below takes over the second job, keyed on the envelope id.
--
--   2. Deliveries are unordered. A retried purchase can land after the refund
--      that followed it, so every row that reflects a delivery now carries the
--      envelope's `created` and the receiver refuses to apply anything older
--      than what it already holds.
--
--   3. A refund has to actually revoke something. That is a write to
--      members.membership_disabled_at, which the protect trigger reserves for
--      admins - and the receiver holds the service role, which has no auth.uid()
--      and is therefore not one. Same problem activate_membership() solved, same
--      shape of solution: a security-definer RPC that does its own authorization
--      and then sets the bypass flag transaction-locally.
--
-- The 667 rows already in stello_membership_purchases predate all of this. They
-- keep their meaning: a purchase we received, still active, with no envelope
-- behind it. Nothing here rewrites them beyond giving them an ordering key.

-- ── 1. The delivery ledger ───────────────────────────────────────────────────

-- One row per webhook delivery, including event types this receiver does not
-- act on. Unknown types are recorded rather than dropped so that a new verb
-- Stello starts sending is visible here instead of only in Stello's own log.
create table if not exists public.stello_webhook_events (
  -- The envelope `id` (also the Stello-Event-Id header). Primary key because it
  -- is exactly the idempotency key: a retry collides here.
  event_id text primary key,
  event_type text not null,
  -- The envelope `created`. The ordering key - see the note at the top.
  event_created timestamptz,
  -- The pass the event concerns, when it concerns one. Null for webhook.test,
  -- which carries "data": { "object": null }.
  pass_id text,
  -- Stello-Delivery-Id: this attempt, not this event. Changes on every retry,
  -- and is the value Stello wants quoted when a delivery looks wrong.
  delivery_id text,
  received_at timestamptz not null default now(),
  -- Set once the event's effects are committed. A claimed-but-unprocessed row
  -- is a delivery that died halfway; the receiver redoes it rather than
  -- reporting success for work it never finished.
  processed_at timestamptz,
  payload jsonb
);

comment on table public.stello_webhook_events is
  'One row per Stello webhook delivery, keyed on the envelope id. The idempotency ledger; processed_at distinguishes a finished delivery from one that died mid-flight.';

create index if not exists idx_stello_events_pass
  on public.stello_webhook_events (pass_id);

create index if not exists idx_stello_events_received
  on public.stello_webhook_events (received_at desc);

alter table public.stello_webhook_events enable row level security;

-- Staff may read; nobody writes through PostgREST. Same rule as the purchases
-- table: the receiver holds the service role and bypasses RLS, which keeps the
-- write path down to one function that verifies an HMAC first.
drop policy if exists stello_events_select_staff on public.stello_webhook_events;
create policy stello_events_select_staff
  on public.stello_webhook_events
  for select
  to authenticated
  using (public.current_privilege() >= 2);

-- ── 2. What a pass row now holds ─────────────────────────────────────────────

alter table public.stello_membership_purchases
  -- The envelope that last wrote this row, and when Stello says it happened.
  -- Null on the rows that predate the envelope.
  add column if not exists event_id text,
  add column if not exists event_created timestamptz,
  -- 'active' or 'refunded'. A refund is terminal for a pass: a purchase
  -- delivery arriving afterwards (they are unordered) must not resurrect it.
  add column if not exists status text not null default 'active',
  add column if not exists refunded_at timestamptz,
  -- Fields the flat payload only offered as opt-in and this receiver never
  -- parsed. valid_until earns its place: Stello deliberately sends no `expired`
  -- event, on the reasoning that we hold the exact instant ourselves. The rest
  -- come free with it and make the row a record of what was actually sold.
  add column if not exists membership_type text,
  add column if not exists valid_until timestamptz,
  add column if not exists order_id text,
  add column if not exists amount_paid integer,
  add column if not exists currency text;

comment on column public.stello_membership_purchases.status is
  'active | refunded. Terminal once refunded - an out-of-order purchase delivery may not flip it back.';
comment on column public.stello_membership_purchases.event_created is
  'Envelope `created` of the newest delivery applied to this pass. Older deliveries are discarded against it.';
comment on column public.stello_membership_purchases.amount_paid is
  'Integer oere, as Stello sends it. 25000 = 250,00 kr.';
comment on column public.stello_membership_purchases.valid_until is
  'End of the pass validity window. Null is legitimate: a manually-activated pass nobody has scanned, or one that never expires.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stello_purchases_status_check'
  ) then
    alter table public.stello_membership_purchases
      add constraint stello_purchases_status_check
      check (status in ('active', 'refunded'));
  end if;
end
$$;

-- Give the pre-envelope rows an ordering key, so a late delivery for one of
-- those passes compares against something rather than against null. received_at
-- is the honest answer: it is when we learned of the pass.
update public.stello_membership_purchases
   set event_created = received_at
 where event_created is null;

create index if not exists idx_stello_purchases_status
  on public.stello_membership_purchases (status);

-- ── 3. Revoking on refund ────────────────────────────────────────────────────

/**
 * Marks a Stello pass refunded and withdraws the membership it was paying for.
 *
 * Service role only. The receiver has already verified an HMAC over the raw
 * delivery before it gets here; nothing else has any business calling this.
 *
 * What it will and will not do:
 *
 *   - It writes membership_disabled_at, the kill-switch, rather than winding the
 *     period back. The kill-switch is the column that means "withdrawn even
 *     though the period still runs", which is what a refund is. It also makes
 *     activate_membership() refuse the member until Stortinget clears it, so a
 *     volunteer at the card printer cannot undo a refund by pressing Aktiver.
 *
 *   - It leaves a lapsed member alone. Disabling someone whose period has
 *     already run out revokes nothing and would poison a future activation:
 *     pay cash at the door next season and Aktiver raises MEMBERSHIP_DISABLED
 *     with no obvious remedy. The refund is still recorded on the pass.
 *
 *   - It leaves alone anyone still covered by another Stello pass that is
 *     demonstrably live. Passes with no validity window - every row from before
 *     the envelope - do not count as cover; erring toward revoking is the side
 *     the house can see and correct, and the audit row below is how they see it.
 *
 * @param p_member_id member the refunded pass belongs to.
 * @param p_pass_id   the pass being refunded.
 * @param p_event_id  envelope id, recorded in the audit row for tracing.
 * @returns true if the membership was withdrawn, false if there was nothing to
 *          withdraw. Either way the pass is marked refunded.
 */
create or replace function public.stello_revoke_membership(
  p_member_id uuid,
  p_pass_id text,
  p_event_id text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_jwt_role text;
  v_member public.members%rowtype;
  v_covered boolean;
  v_disabled boolean := false;
BEGIN
  BEGIN
    v_jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  EXCEPTION WHEN others THEN
    v_jwt_role := '';
  END;

  -- Excluding the roles that must never reach here, rather than testing for
  -- service_role positively: request.jwt.claims may or may not be populated
  -- depending on whether the project key is a legacy JWT or a new-style secret,
  -- and this check has to hold either way. Same reasoning as 20260806090500.
  IF auth.uid() IS NOT NULL OR v_jwt_role IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  IF p_pass_id IS NULL OR p_pass_id = '' THEN
    RAISE EXCEPTION 'PASS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- FOR UPDATE so a refund and a concurrent activation cannot interleave.
  SELECT * INTO v_member
    FROM public.members m
   WHERE m.id = p_member_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.stello_membership_purchases p
     SET status = 'refunded',
         refunded_at = coalesce(p.refunded_at, now())
   WHERE p.pass_id = p_pass_id;

  SELECT EXISTS (
    SELECT 1
      FROM public.stello_membership_purchases p
     WHERE p.member_id = p_member_id
       AND p.pass_id <> p_pass_id
       AND p.status = 'active'
       AND p.valid_until IS NOT NULL
       AND p.valid_until > now()
  ) INTO v_covered;

  IF NOT v_covered
     AND public.derive_membership_active(
           v_member.membership_active_until,
           v_member.membership_disabled_at
         ) THEN
    PERFORM set_config('app.bypass_member_protect', 'on', true);
    UPDATE public.members m
       SET membership_disabled_at = now()
     WHERE m.id = p_member_id;
    PERFORM set_config('app.bypass_member_protect', 'off', true);
    v_disabled := true;
  END IF;

  -- Written whether or not anything was withdrawn. A membership that stops
  -- working because of a webhook has to be explicable to the staff member the
  -- person is standing in front of.
  INSERT INTO public.admin_audit_log
    (actor_id, action, target_table, target_id, status, details)
  VALUES (
    null,
    'stello_membership_refunded',
    'members',
    p_member_id::text,
    'ok',
    jsonb_build_object(
      'pass_id', p_pass_id,
      'event_id', p_event_id,
      'membership_disabled', v_disabled,
      'covered_by_other_pass', v_covered
    )
  );

  RETURN v_disabled;
END;
$function$;

comment on function public.stello_revoke_membership(uuid, text, text) is
  'Marks a Stello pass refunded and withdraws the membership it paid for. Service role only; called by the stello-membership-webhook receiver on membership.refunded.';

-- This project grants EXECUTE to anon and authenticated by default, and
-- `revoke ... from public` does not touch an explicit grant - see 20260806090500.
revoke all on function public.stello_revoke_membership(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.stello_revoke_membership(uuid, text, text)
  to service_role;
