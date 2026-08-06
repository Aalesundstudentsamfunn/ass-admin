-- Record of membership purchases received from Stello.
--
-- A table rather than a stello_pass_id column on members, because a member buys
-- a new membership every season. A unique column would either block the second
-- purchase or lose the first, and neither is a record of anything. One row per
-- pass gives idempotency (pass_id is the key Stello retries against) and the
-- purchase history that lets the add-member screen say "kjøpte medlemskap via
-- Stello 3. august" instead of the misleading "e-posten finnes allerede".
--
-- Note what this table does NOT do: it never decides whether a membership is
-- active. A purchase arriving from Stello creates or annotates a member and
-- stops there. Activation stays a deliberate press of Aktiver by staff at the
-- card printer, which is the only moment anyone has confirmed the person is
-- standing in front of them.

create table if not exists public.stello_membership_purchases (
  -- The membershipPasses _id from Stello. Primary key because it is exactly the
  -- idempotency key: a retried or replayed delivery collides here and becomes a
  -- no-op instead of a duplicate member.
  pass_id text primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  -- The address Stello sold to, kept verbatim. members.email can be corrected by
  -- staff later; this stays as the record of what actually arrived.
  email text not null,
  -- Did this delivery create the member row, or attach to one already here?
  -- Distinguishes a genuinely new member from a returning one.
  created_member boolean not null default false,
  -- When Stello says the purchase happened, versus when we received it. They
  -- differ whenever a delivery is retried after an outage.
  purchased_at timestamptz,
  received_at timestamptz not null default now(),
  -- The verified payload as delivered. Cheap to keep, and the only way to
  -- reconstruct what happened when a delivery turns out to have been wrong.
  payload jsonb
);

comment on table public.stello_membership_purchases is
  'One row per membership pass sold through Stello. pass_id is the idempotency key. Never affects membership standing - activation stays manual.';

create index if not exists idx_stello_purchases_member
  on public.stello_membership_purchases (member_id);

-- Supports "has anything arrived for this person recently", which is what the
-- add-member screen asks when it explains why an email is already known.
create index if not exists idx_stello_purchases_received
  on public.stello_membership_purchases (received_at desc);

alter table public.stello_membership_purchases enable row level security;

-- Staff may read; nobody writes through PostgREST. The receiver holds the
-- service role and bypasses RLS, which keeps the write path down to one
-- function that verifies an HMAC first.
drop policy if exists stello_purchases_select_staff on public.stello_membership_purchases;
create policy stello_purchases_select_staff
  on public.stello_membership_purchases
  for select
  to authenticated
  using (public.current_privilege() >= 2);
