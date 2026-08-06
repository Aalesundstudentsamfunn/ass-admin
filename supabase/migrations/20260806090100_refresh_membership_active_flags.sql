-- Nightly re-derivation of is_membership_active.
--
-- The trigger keeps the flag honest for any row that gets written. It cannot
-- help a row nobody touches: a membership whose period simply elapses overnight
-- produces no write, so without this job the flag stays true forever. That is
-- how 965 expired memberships came to be flagged active.
--
-- This is also what lets the mobile app keep reading is_membership_active on its
-- own. Once the flag tracks the period, the app's flag-only check is correct
-- without a new build.

/**
 * Re-derives is_membership_active for every row where it disagrees with
 * membership_active_until / membership_disabled_at.
 *
 * How: one set-based UPDATE restricted to disagreeing rows, so a normal night
 * writes only the handful of memberships that lapsed that day and the audit
 * trigger stays quiet.
 * @returns number of rows corrected.
 */
create or replace function public.refresh_membership_active_flags()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.members m
     SET is_membership_active = public.derive_membership_active(
           m.membership_active_until,
           m.membership_disabled_at
         )
   WHERE m.is_membership_active IS DISTINCT FROM public.derive_membership_active(
           m.membership_active_until,
           m.membership_disabled_at
         );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

comment on function public.refresh_membership_active_flags() is
  'Re-derives is_membership_active for rows the trigger could not reach, i.e. memberships that lapsed without any write. Run nightly by cron.';

revoke all on function public.refresh_membership_active_flags() from public;
grant execute on function public.refresh_membership_active_flags() to service_role;

-- 00:10 UTC, just after current_date rolls over. The database is UTC, so this is
-- 02:10 Oslo in summer and 01:10 in winter; a membership therefore lapses in the
-- small hours of the morning after its last valid day, never during trading.
-- No summer/winter pair is needed the way the reminder jobs have one, because
-- nothing here is read by a human at a fixed local hour.
select cron.unschedule('refresh-membership-active-flags')
where exists (select 1 from cron.job where jobname = 'refresh-membership-active-flags');

select cron.schedule(
  'refresh-membership-active-flags',
  '10 0 * * *',
  $$select public.refresh_membership_active_flags();$$
);
