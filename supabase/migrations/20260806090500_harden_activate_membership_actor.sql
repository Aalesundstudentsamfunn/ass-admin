-- Closes a hole opened by 20260806090300, and applied on top of it.
--
-- `activate_membership()` believes `p_actor_id` when `auth.uid()` is null, on the
-- reasoning that only the service role is ever in that position. That was wrong.
-- This project grants EXECUTE on new functions to `anon` and `authenticated` by
-- default, and `revoke ... from public` does not touch an explicit grant - it
-- only drops the PUBLIC entry. `anon` kept EXECUTE, so an unauthenticated caller
-- with a staff uuid could have activated any membership.
--
-- Found by the security advisor immediately after applying 090300, before the
-- function had been called by anything real.
--
-- Two independent fixes, because the grant was assumed to be sufficient once
-- already:
--
--   1. Take EXECUTE away from anon, and from authenticated on the refresh job
--      which only cron and the service role should ever run.
--   2. Refuse to believe p_actor_id unless the caller is neither anon nor
--      authenticated.
--
-- Note the shape of (2). Testing for role = 'service_role' would be the obvious
-- way round and is the wrong one: it assumes `request.jwt.claims` is populated,
-- which depends on whether the project's service key is a legacy JWT or a
-- new-style secret key. Guessing wrong there fails closed, and failing closed
-- here means mobile activation stops working. Excluding the two roles that must
-- never reach that branch is correct whatever the claims look like, including
-- when they are absent entirely.

revoke execute on function public.activate_membership(uuid, uuid) from anon;
revoke execute on function public.refresh_membership_active_flags() from anon, authenticated;

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
  v_actor uuid;
  v_jwt_role text;
  v_actor_privilege integer;
  v_member public.members%rowtype;
BEGIN
  BEGIN
    v_jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  EXCEPTION WHEN others THEN
    v_jwt_role := '';
  END;

  IF auth.uid() IS NOT NULL THEN
    v_actor := auth.uid();
  ELSIF v_jwt_role NOT IN ('anon', 'authenticated') THEN
    v_actor := p_actor_id;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'ACTOR_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT m.privilege_type INTO v_actor_privilege
    FROM public.members m
   WHERE m.id = v_actor;

  IF coalesce(v_actor_privilege, 0) < 2 THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

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
  'Moves a lapsed membership onto the current period. The only supported way to activate. p_actor_id is honoured only when the caller is neither anon nor authenticated, i.e. the service role.';

revoke all on function public.activate_membership(uuid, uuid) from public, anon;
grant execute on function public.activate_membership(uuid, uuid) to authenticated, service_role;
