# ÅSS membership sync: handoff

Goal: when someone buys a membership in Stello, a corresponding `members` row
appears in ÅSS's Supabase with no running period. ÅSS staff then type the email
into the admin app's add-member flow, see the member as lapsed, tap Aktiver, and
the card prints.

The first version of this document was written from application code alone. Every
schema claim in it has now been checked against the live database
(`oyqsajjkrjiwtlktvdlg`), and several were wrong. This version records what is
actually true, what has been built, and what is left.

## Split of work

**Stello's side is a generic outbound webhook**, not an ÅSS feature: an
integration any organiser can enable, with its own endpoint URL and signing
secret per organiser. Organisers who want it build their own receiver. ÅSS is
simply the first one, and the ÅSS receiver in this repo is the reference
implementation of the contract.

That is being built separately. Everything below marked ÅSS is in this repo.

## Repos

| Thing | Location |
| --- | --- |
| Stello backend (Convex) | `/Users/bydennis/Desktop/Stello/packages/convex/convex` |
| Stello org dashboard | `/Users/bydennis/Desktop/Stello/apps/organizations` |
| ÅSS mobile + admin app | `/Users/bydennis/Documents/GitHub/ass-app` |
| ÅSS web admin (this repo) | `/Users/bydennis/Documents/GitHub/ass-admin` |
| ÅSS loose SQL + some edge functions | `/Users/bydennis/Documents/db/supabase` (not version controlled) |

New SQL and edge functions for this work live in `supabase/` **in this repo**
rather than the loose `db/` directory, because they are coupled to the web admin
changes in the same commits and that directory is not under version control.

## The five questions, answered

| # | Question | Answer |
| --- | --- | --- |
| 1 | Does `check` derive `active` from `is_membership_active`? | Yes, and that was the bug. |
| 2 | Does `create` set `is_membership_active = true` immediately? | Yes, explicitly - but the premise behind the question was wrong, see below. |
| 3 | Is `members.email` uniquely constrained? | Yes, `members_email_key`, a case-sensitive btree. Every staff-facing lookup uses `ilike`, so index and lookup disagree. |
| 4 | Is `members.id` a FK to `auth.users`? | Yes, `ON UPDATE CASCADE ON DELETE CASCADE`. |
| 5 | Are `birth_date` / `phone_number` nullable? | `birth_date` yes. **`phone_number` does not exist** - only `phone_set_at`. Phone lives on `auth.users.phone`. |

## What the questions missed

**`is_membership_active` was a flag that lied.** `membership_active_until` is
`NOT NULL DEFAULT compute_membership_expiry()` (31 July, rolling to next year
from August). The old trigger recomputed the flag only when the date column
itself changed, and no scheduled job touched it. On 2026-08-06 the table held 977
members: 976 flagged active, 965 with a period that had already ended. The
2025/26 season lapsed on 2026-07-31 and nothing noticed.

**The two admin surfaces disagreed about what "active" means.** The deployed
`admin-member-create` edge function read the flag. This repo, since 46fbcff
(`fix: renew membership by writing the expiry date`), read the date. So the
design's central assumption - sync writes an inactive row, `check` reports
`exists-inactive`, staff tap Aktiver - would have produced a member that mobile
called inactive and web called active.

**Nothing could distinguish "expired" from "deliberately deactivated".** One
boolean cannot carry both, which meant a renewal had no way to know whether it
was allowed to re-enable someone. Worse, the old trigger re-derived the flag on
any date write, so renewing a deactivated member silently re-enabled them - the
kill-switch was bypassable through the everyday Aktiver flow.

## The state model, as now built

Three columns, one derived:

```
membership_active_until  date         the paid period. Source of truth.
membership_disabled_at   timestamptz  the kill-switch. Stortinget (4+) only. NEW.
is_membership_active     boolean      DERIVED. Never write directly.

is_membership_active = (membership_active_until >= current_date
                        AND membership_disabled_at IS NULL)
```

The derived flag stays rather than being dropped, because the mobile app reads it
directly and cannot be changed without a release. Keeping it truthful in the
database is cheaper than shipping a build. Two things keep it truthful: the
trigger derives it on every insert and update, and a nightly cron re-derives rows
that no write touched.

Activation is the only thing that moves a period forward, and it now happens in
exactly one place - `activate_membership()` - which both the edge function and
the web admin call. It refuses to renew a disabled member, so the kill-switch
survives the everyday flow.

The database runs in UTC while ÅSS runs in Oslo, so `current_date` rolls over at
02:00 local in summer. A membership lapses an hour or two after local midnight
rather than exactly at it. That matches `compute_membership_expiry()`, which has
always used `CURRENT_DATE`, and errs toward the member.

## Built (ÅSS)

Nothing has been applied to the live database or deployed yet.

| File | What |
| --- | --- |
| `supabase/migrations/20260806090000_membership_state_model.sql` | `membership_disabled_at`, `derive_membership_active()`, rewritten trigger now firing on INSERT too |
| `supabase/migrations/20260806090100_refresh_membership_active_flags.sql` | Nightly re-derivation function + cron at 00:10 UTC |
| `supabase/migrations/20260806090200_membership_active_flag_backfill.sql` | One-off correction. **Flips ~964 members to inactive.** Read its header before running |
| `supabase/migrations/20260806090300_activate_membership_rpc.sql` | `activate_membership()` - the single activation path |
| `supabase/migrations/20260806090400_stello_membership_purchases.sql` | Purchase record, `pass_id` primary key |
| `supabase/functions/admin-member-create/index.ts` | Recovered from the deployed source; `activate` moved onto the RPC, `check` no longer trusts the flag alone |
| `supabase/functions/stello-membership-webhook/index.ts` | The receiver, and the contract Stello implements against |
| `app/dashboard/members/server/actions.ts` | Activation moved onto the RPC; guards now test flag AND period |
| `app/api/admin/members/membership-status/route.ts` | Writes `membership_disabled_at` instead of the derived flag |

### Why no mobile build is needed

The edge function's request and response shapes are unchanged. Only its body
moves: `activate` calls the RPC instead of writing the flag, and `check` tests
flag-and-period instead of flag alone. The app keeps calling the same actions
with the same payloads and rendering the same branches.

This matters more than it sounds. With the nightly job live and the *old*
`activate`, every mobile activation would have written the flag against a stale
past period - and the job would have flipped it back the same night. Members
would have expired within a day of being activated.

## The delivery contract

`POST /functions/v1/stello-membership-webhook`, deployed with `verify_jwt = false`
(the caller is Stello, not a signed-in user; the HMAC is the authentication).

```
Stello-Signature: t=<unix seconds>,v1=<hex hmac-sha256 of `${t}.${rawBody}`>
```

Stripe's scheme, chosen because Stello is building this as an integration many
organisers will implement against, and that is the scheme with the most existing
documentation to point at. 5-minute replay window. Secret in the receiver's
`STELLO_WEBHOOK_SECRET`.

```json
{
  "type": "membership.purchased",
  "passId": "<membershipPasses _id - the idempotency key>",
  "email": "buyer@example.com",
  "firstname": "...",
  "lastname": "...",
  "purchasedAt": 1775000000000
}
```

Responses: `200` accepted or already seen, `400` malformed, `401` bad signature
(neither worth retrying), `500` our fault, retry with backoff.

Deliberately not sent: birth date, phone, validity window, tier, price. ÅSS sets
validity at print time, so a window would be ignored or misleading.

### What the receiver does

Unknown email: mint the auth user, insert the member with
`membership_active_until = '2000-01-01'` so the trigger derives the flag false,
record the purchase. Known email: record the purchase and **touch nothing else** -
no period changes, ever. A purchase proves someone paid, not that they collected
a card; only staff standing in front of the person can confirm that.

Idempotency is `pass_id` as primary key. A purchase table rather than a
`stello_pass_id` column on `members`, because a member buys a new membership every
season and a unique column would either block the second purchase or lose the
first.

## Still open

**Stello has no reliable first/last name split, and one path has no name at all.**
Verified across the three purchase paths. Memberships never go to the shared till
guest (`assertNotAlreadyMember` runs against a real buyer), so every purchase has
an identified account - but:

| Path | Name captured | Consequence |
| --- | --- | --- |
| In-app onboarding (`(auth)/identity.tsx`) | first + last, both required, min 2 chars | Clean |
| Web `/kasse` (`prepareWebBuyer`) | one `name` string | Splittable, wrong for compound surnames |
| POS (`prepareBuyerCreate`) | **none** - email and phone only | Cannot produce a member at all |

`members.firstname` and `lastname` are both `NOT NULL`, so there is no placeholder
to fall back on. The fix is two small form changes on the Stello side - add first
and last name to the POS buyer-create form, split the `/kasse` name field in two -
both writing the `userPii` columns that already exist. The receiver refuses a
delivery without both names with a `400`, which is honest: the fix belongs at the
checkout that failed to collect one.

Until that lands, POS-originated memberships will not sync.

**Incidental ÅSS issues, both now more urgent.** Neither is caused by this work.

- **Activate does not enqueue a print job.** `handleCreateMember`
  (`add-member.tsx:421`) enqueues into `printer_queue` when autoprint is on;
  `handleActivateMember` (line 525) does not. Once members arrive pre-created from
  Stello, activate becomes the staff's normal path, so autoprint would silently
  stop firing for exactly the members this integration produces.
- **The `exists-inactive` copy is wrong for this case.** "E-posten finnes
  allerede" was written for lapsed members. `stello_membership_purchases` now
  carries what is needed to say "Kjøpte medlemskap via Stello 3. august" instead.

**Refunds are out of scope for v1.** A refunded pass that was never activated
leaves a member with no running period, which is already the correct end state.
Revisit only if refunds after card printing turn out to happen.

## Remaining order

1. Apply the migrations. Run the backfill when someone is around to answer the
   phone - it flips ~964 members to inactive in one statement.
2. Deploy both edge functions. Set `STELLO_WEBHOOK_SECRET` first.
3. Walk the add-member flow on mobile and web for a lapsed member; confirm both
   now report the same thing and that Aktiver writes a period.
4. Stello: names at POS and `/kasse` checkout.
5. Stello: the generic webhook integration - target table keyed by organiser,
   signed POST action, retrier wiring, delivery log, hook in
   `mintMembershipPasses` (`checkout.ts:2119`, the single mint choke point every
   purchase path finalises through).
6. End-to-end with a real sandbox purchase.
7. The two incidental issues.
