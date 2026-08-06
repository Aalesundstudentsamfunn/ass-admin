-- activate_membership(): the one place a membership period is moved forward.
--
-- Why an RPC rather than an UPDATE at each call site:
--
-- 1. The admin-member-create edge function talks to the database with the
--    service role, so auth.uid() is null, so is_admin() and is_voluntary() are
--    both false, so members_protect_columns raises
--    FORBIDDEN_CHANGE_MEMBERSHIP_STATUS on any attempt to write the period. The
--    function needs a way past its own trigger that is not "turn the trigger
--    off".
-- 2. Activation had drifted into writing is_membership_active instead of the
--    period, which left the member expired and - once the nightly refresh job
--    exists - would be silently undone the same night. One implementation makes
--    that class of bug impossible to reintroduce at a single call site.
--
-- The mobile app is unchanged by this: it still calls the edge function with the
-- same action and payload. Only the function's body moves onto this RPC.

/**
 * Moves a lapsed membership onto the current period.
 *
 * How: authorizes the actor, refuses the cases where activation is the wrong
 * remedy, then writes membership_active_until from compute_membership_expiry()
 * and lets the trigger derive is_membership_active. The bypass flag is set
 * transaction-locally, and only after this function has done its own checks.
 *
 * The actor is auth.uid() when a signed-in user calls this. Only the service
 * role - which has no auth.uid() - may name an actor via p_actor_id, and it does
 * so having already authenticated the caller itself.
 *
 * Deliberately allows privilege 2-3 to activate any member including another
 * frivillig, which is what the edge function does today. The RLS rule that stops
 * staff editing peers exists to prevent privilege escalation; renewing someone's
 * membership at the card printer is not that.
 *
 * @param p_member_id member whose period should be moved forward.
 * @param p_actor_id  acting staff member; service role only, ignored otherwise.
 * @returns the member row as it stands after activation.
 */
create or replace function public.activate_membership(
  p_member_id uuid,
  p_actor_id uuid default null
)
returns table (
  id uuid,
  firstname text,
  lastname text,
  email text,
  privilege_type smallint,
  is_membership_active boolean,
  membership_active_until date,
  is_banned boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_actor uuid := coalesce(auth.uid(), p_actor_id);
  v_actor_privilege integer;
  v_member public.members%rowtype;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'ACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT m.privilege_type INTO v_actor_privilege
    FROM public.members m
   WHERE m.id = v_actor;

  IF coalesce(v_actor_privilege, 0) < 2 THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  -- FOR UPDATE so two staff pressing Aktiver on the same person cannot both pass
  -- the already-active check.
  SELECT * INTO v_member
    FROM public.members m
   WHERE m.id = p_member_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(v_member.is_banned, false) THEN
    RAISE EXCEPTION 'MEMBER_BANNED' USING ERRCODE = 'P0001';
  END IF;

  -- A disabled membership is not reactivated by renewing it. Stortinget clears
  -- the kill-switch first, otherwise the everyday Aktiver flow would quietly
  -- undo a deliberate restriction.
  IF v_member.membership_disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'MEMBERSHIP_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  IF v_member.membership_active_until >= current_date THEN
    RAISE EXCEPTION 'ALREADY_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.bypass_member_protect', 'on', true);
  UPDATE public.members m
     SET membership_active_until = public.compute_membership_expiry()
   WHERE m.id = p_member_id;
  PERFORM set_config('app.bypass_member_protect', 'off', true);

  RETURN QUERY
    SELECT m.id, m.firstname, m.lastname, m.email, m.privilege_type,
           m.is_membership_active, m.membership_active_until, m.is_banned
      FROM public.members m
     WHERE m.id = p_member_id;
END;
$function$;

comment on function public.activate_membership(uuid, uuid) is
  'Moves a lapsed membership onto the current period. The only supported way to activate; writes the period and lets the trigger derive is_membership_active.';

revoke all on function public.activate_membership(uuid, uuid) from public;
grant execute on function public.activate_membership(uuid, uuid) to authenticated, service_role;
