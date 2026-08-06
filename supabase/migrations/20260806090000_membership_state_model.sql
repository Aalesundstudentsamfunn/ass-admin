-- Membership state model
--
-- Three columns, one of which is derived:
--
--   membership_active_until  The validity period. Source of truth for "is this
--                            membership still running". Written by activation
--                            and renewal (see activate_membership()).
--   membership_disabled_at   The kill-switch. Non-null means the membership is
--                            withdrawn even though its period may still run.
--                            Stortinget (privilege 4+) only, same threshold the
--                            app already applies via `manageMembershipStatus`.
--   is_membership_active     A DERIVED mirror of the two above. Never write it
--                            directly.
--
-- Why keep a derived flag at all: the mobile app reads is_membership_active on
-- its own and cannot be changed without a release. Keeping the flag truthful is
-- cheaper than shipping a new build, so the flag stays and the database becomes
-- responsible for it never lying.
--
-- It has been lying. The old trigger recomputed the flag only when the date
-- column itself changed, and nothing recomputed it when a period merely elapsed,
-- so on 2026-08-06 the table held 976 rows flagged active against 965 expired
-- periods. Two changes fix that: this trigger now derives the flag on every
-- insert and update, and a nightly job (see the cron migration) re-derives rows
-- that no write has touched.
--
-- A note on time: the database runs in UTC while ÅSS runs in Oslo, so
-- current_date rolls over at 02:00 local in summer and 01:00 in winter. A
-- membership therefore lapses an hour or two after local midnight rather than
-- exactly at it. That matches compute_membership_expiry(), which has always
-- used CURRENT_DATE, and errs toward the member.

alter table public.members
  add column if not exists membership_disabled_at timestamptz;

comment on column public.members.membership_disabled_at is
  'Manual kill-switch. Non-null = membership withdrawn even if the period still runs. Stortinget (privilege 4+) only. Distinct from is_banned, which bars the account entirely.';

comment on column public.members.membership_active_until is
  'End of the paid membership period. Source of truth for whether a membership runs; defaults to compute_membership_expiry().';

comment on column public.members.is_membership_active is
  'DERIVED: (membership_active_until >= current_date AND membership_disabled_at IS NULL). Maintained by trg_members_protect_columns and refresh_membership_active_flags(). Do not write directly.';

/**
 * The single definition of "this membership is currently active".
 *
 * Kept as a function rather than inlined so the trigger, the nightly refresh and
 * any caller that needs to reason about the flag cannot drift apart. STABLE
 * rather than IMMUTABLE because it reads current_date.
 */
create or replace function public.derive_membership_active(
  p_active_until date,
  p_disabled_at timestamptz
)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select p_active_until >= current_date and p_disabled_at is null;
$function$;

comment on function public.derive_membership_active(date, timestamptz) is
  'Single definition of an active membership: period still running and not manually disabled.';

/**
 * Guards the columns that decide membership standing, and derives
 * is_membership_active from the two that do.
 *
 * Permission model:
 *   is_banned               admin (4+) only
 *   membership_disabled_at  admin (4+) only
 *   membership_active_until admin (4+), or voluntary staff (2-3) performing an
 *                           activation - moving a lapsed period forward. That is
 *                           the Aktiver button, and it is deliberately not
 *                           allowed to resurrect a disabled or banned member,
 *                           which would let the everyday flow undo a kill-switch.
 *
 * `app.bypass_member_protect` skips the permission checks for callers that have
 * already done their own authorization (activate_membership()). It does NOT skip
 * the derivation - letting a caller hand-set the flag is what allowed it to drift
 * in the first place.
 */
create or replace function public.members_protect_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_can_staff_activate boolean := false;
BEGIN
  IF tg_op = 'INSERT' THEN
    new.is_membership_active := public.derive_membership_active(
      new.membership_active_until,
      new.membership_disabled_at
    );
    RETURN new;
  END IF;

  IF coalesce(current_setting('app.bypass_member_protect', true), '') <> 'on' THEN
    IF new.is_banned IS DISTINCT FROM old.is_banned AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'FORBIDDEN_CHANGE_IS_BANNED' USING ERRCODE = 'P0001';
    END IF;

    IF new.membership_disabled_at IS DISTINCT FROM old.membership_disabled_at
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'FORBIDDEN_CHANGE_MEMBERSHIP_DISABLED' USING ERRCODE = 'P0001';
    END IF;

    v_can_staff_activate :=
      public.is_voluntary()
      AND NOT public.is_admin()
      AND coalesce(old.membership_active_until < current_date, true)
      AND coalesce(new.membership_active_until >= current_date, false)
      AND old.membership_disabled_at IS NULL
      AND new.membership_disabled_at IS NULL
      AND coalesce(old.is_banned, false) = false
      AND coalesce(new.is_banned, false) = false;

    IF new.membership_active_until IS DISTINCT FROM old.membership_active_until
       AND NOT public.is_admin()
       AND NOT v_can_staff_activate THEN
      RAISE EXCEPTION 'FORBIDDEN_CHANGE_MEMBERSHIP_STATUS' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  new.is_membership_active := public.derive_membership_active(
    new.membership_active_until,
    new.membership_disabled_at
  );

  RETURN new;
END;
$function$;

-- Now fires on INSERT too, so a row inserted with a past period (the Stello
-- receiver does exactly that) comes out flagged inactive without the caller
-- having to remember.
drop trigger if exists trg_members_protect_columns on public.members;
create trigger trg_members_protect_columns
  before insert or update on public.members
  for each row execute function public.members_protect_columns();
