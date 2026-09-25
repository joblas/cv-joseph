-- ===========================================================================
-- Booking concierge — verification codes and bookings (cv-joseph project).
--
-- The chat agent books 30-minute calls onto Joe's Google Calendar. A public
-- endpoint that writes to a calendar is an abuse target, so a booking is only
-- possible after the visitor proves they own their email address with a
-- six-digit code (Joe's choice, 2026-09-25). Everything that makes that safe
-- lives here, in the database, where it holds under concurrency:
--
--   booking_issue_code   rate-limits code sends (per email, session and IP
--                        per hour; per email and IP per day; a global daily
--                        cap that protects the sending domain)
--   booking_check_code   verifies a code; 5 wrong guesses kills it
--   booking_reserve      requires a verified email; one upcoming booking per
--                        email; a daily cap; and a UNIQUE partial index so two
--                        visitors can never hold the same slot
--   booking_finalize     records the Google event, or releases the slot
--   booking_candidates   rows whose truth lives in Google: stale pending rows,
--   booking_sync         and live holds on this email or slot. The Worker
--                        checks each against its event and syncs the row, so
--                        a lost finalize, an insert whose outcome was unknown,
--                        or Joe cancelling / moving the event in Google never
--                        leaves a slot or an email stuck.
--
-- CONCURRENCY. Both write paths take ONE global advisory lock for the whole
-- transaction, so every count-then-insert cap is exact under concurrent
-- requests. Volume is a handful a day, so serialising costs nothing. (A
-- per-email lock, the first version, let an IP or the daily cap be exceeded
-- by two overlapping requests — found in review.)
--
-- Codes are never stored in plain text: the Worker sends only
-- HMAC-SHA256(BOOKING_SECRET, session|email|code).
--
-- SECURITY. This project's default ACL grants anon full rights on every new
-- table and EXECUTE on every new function (verified 2026-09-25). So this file
-- enables RLS, adds NO policies, and revokes table and function rights from
-- public/anon/authenticated in the same file. Only service_role — which the
-- Worker uses — can touch any of it. Functions are SECURITY INVOKER with an
-- empty search_path.
--
-- Additive and reversible: drop the six functions and two tables.
-- ===========================================================================

create table if not exists public.booking_codes (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  email       text not null,
  code_hash   text not null,
  ip          text,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  verified_at timestamptz
);
create index if not exists booking_codes_lookup on public.booking_codes (session_id, email, created_at desc);
create index if not exists booking_codes_recent on public.booking_codes (created_at);

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null,
  email           text not null,
  name            text,
  topic           text,
  slot_start      timestamptz not null,
  slot_end        timestamptz not null,
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'cancelled')),
  google_event_id text,
  created_at      timestamptz not null default now()
);
-- The double-booking guarantee: at most one live booking per slot. A failed or
-- cancelled row does not hold its slot, so finalize('failed') releases it.
create unique index if not exists bookings_slot_held on public.bookings (slot_start) where status in ('pending', 'confirmed');
create index if not exists bookings_by_email on public.bookings (email, slot_start);

alter table public.booking_codes enable row level security;
alter table public.bookings enable row level security;
revoke all on table public.booking_codes, public.bookings from public, anon, authenticated;
grant all on table public.booking_codes, public.bookings to service_role;

-- ---------------------------------------------------------------------------
create or replace function public.booking_issue_code(p_session text, p_email text, p_code_hash text, p_ip text)
returns text
language plpgsql
set search_path to ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if p_session is null or p_session = '' or v_email = '' or p_code_hash is null or p_code_hash = '' then
    return 'bad_request';
  end if;
  -- Serialise ALL code issuance, so no two requests can both pass a cap.
  perform pg_advisory_xact_lock(hashtext('booking-code'));
  if (select count(*) from public.booking_codes where email = v_email and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.booking_codes where email = v_email and created_at > now() - interval '1 day') >= 6 then
    return 'rate_limited_email';
  end if;
  if (select count(*) from public.booking_codes where session_id = p_session and created_at > now() - interval '1 hour') >= 3 then
    return 'rate_limited_session';
  end if;
  if p_ip is not null and (
       (select count(*) from public.booking_codes where ip = p_ip and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.booking_codes where ip = p_ip and created_at > now() - interval '1 day') >= 12) then
    return 'rate_limited_ip';
  end if;
  -- Protects the sending domain's reputation from a distributed flood.
  if (select count(*) from public.booking_codes where created_at > now() - interval '1 day') >= 40 then
    return 'rate_limited_global';
  end if;
  insert into public.booking_codes (session_id, email, code_hash, ip, expires_at)
  values (p_session, v_email, p_code_hash, p_ip, now() + interval '10 minutes');
  return 'ok';
end
$$;

-- ---------------------------------------------------------------------------
create or replace function public.booking_check_code(p_session text, p_email text, p_code_hash text)
returns text
language plpgsql
set search_path to ''
as $$
declare
  v_email text := lower(trim(p_email));
  r public.booking_codes%rowtype;
begin
  -- Already verified in this session recently: no code needed again.
  if exists (select 1 from public.booking_codes
             where session_id = p_session and email = v_email and verified_at > now() - interval '30 minutes') then
    return 'ok';
  end if;
  select * into r from public.booking_codes
   where session_id = p_session and email = v_email and verified_at is null
   order by created_at desc limit 1
   for update;
  if not found then return 'no_code'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.attempts >= 5 then return 'too_many_attempts'; end if;
  if p_code_hash is null or r.code_hash <> p_code_hash then
    update public.booking_codes set attempts = attempts + 1 where id = r.id;
    return 'mismatch';
  end if;
  update public.booking_codes set verified_at = now() where id = r.id;
  return 'ok';
end
$$;

-- ---------------------------------------------------------------------------
create or replace function public.booking_reserve(p_session text, p_email text, p_name text, p_topic text,
                                                  p_start timestamptz, p_end timestamptz)
returns text
language plpgsql
set search_path to ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  -- Re-checked here, not trusted from the caller: a booking needs an email this
  -- session proved it owns within the last 30 minutes.
  if not exists (select 1 from public.booking_codes
                 where session_id = p_session and email = v_email and verified_at > now() - interval '30 minutes') then
    return 'not_verified';
  end if;
  if p_start is null or p_end is null or p_end <= p_start or p_start <= now() then
    return 'bad_slot';
  end if;
  -- Serialise ALL reservations, so the daily cap is exact under concurrency.
  perform pg_advisory_xact_lock(hashtext('booking-reserve'));
  -- A booking for this email may still be mid-flight (reserve -> Google ->
  -- finalize is bounded well under a minute). Say so, rather than claiming
  -- a call exists that may never be created.
  if exists (select 1 from public.bookings
             where email = v_email and status = 'pending' and created_at > now() - interval '60 seconds') then
    return 'in_progress';
  end if;
  if exists (select 1 from public.bookings
             where email = v_email and status in ('pending', 'confirmed') and slot_start > now()) then
    return 'already_booked';
  end if;
  -- A flood of verified-but-junk addresses must not fill Joe's calendar.
  if (select count(*) from public.bookings
      where status in ('pending', 'confirmed') and created_at > now() - interval '1 day') >= 8 then
    return 'daily_cap';
  end if;
  begin
    insert into public.bookings (session_id, email, name, topic, slot_start, slot_end)
    values (p_session, v_email, left(p_name, 120), left(p_topic, 500), p_start, p_end)
    returning id into v_id;
  exception when unique_violation then
    return 'slot_taken';
  end;
  return 'ok:' || v_id::text;
end
$$;

-- ---------------------------------------------------------------------------
create or replace function public.booking_finalize(p_id uuid, p_event_id text, p_status text)
returns text
language plpgsql
set search_path to ''
as $$
begin
  if p_status not in ('confirmed', 'failed') then return 'bad_status'; end if;
  update public.bookings set google_event_id = p_event_id, status = p_status
   where id = p_id and status = 'pending';
  return case when found then 'ok' else 'not_pending' end;
end
$$;

-- ---------------------------------------------------------------------------
-- Rows whose real state is the Google event, for the Worker to check before
-- it reserves: pending rows no longer in flight (a finalize that never ran,
-- or an insert whose outcome was unknown), and live holds on this email or
-- this slot (Joe may have cancelled or moved the event in Google).
create or replace function public.booking_candidates(p_email text, p_start timestamptz)
returns table (id uuid, status text, google_event_id text, slot_start timestamptz, slot_end timestamptz)
language sql
set search_path to ''
as $$
  select b.id, b.status, b.google_event_id, b.slot_start, b.slot_end
    from public.bookings b
   where (b.status = 'pending' and b.created_at < now() - interval '60 seconds')
      -- Confirmed rows only once they are 5 minutes old: right after an insert
      -- Google may briefly 404 the new event, and a second visitor's reconcile
      -- must not release a booking that was just made (review of #30).
      or (b.status = 'confirmed' and b.slot_start > now() and b.created_at < now() - interval '5 minutes'
          and (b.email = lower(trim(p_email)) or b.slot_start = p_start))
   -- This visitor's own rows first, so unrelated stale rows the Worker could
   -- not settle can never crowd them out of the limit.
   order by (b.email = lower(trim(p_email)) or b.slot_start = p_start) desc, b.created_at
   limit 5
$$;

-- Bring a live row in line with its Google event: confirmed (optionally at
-- the event's current time, if Joe moved it), failed (a pending row whose
-- event never existed) or cancelled (Joe deleted or cancelled it).
create or replace function public.booking_sync(p_id uuid, p_status text, p_event_id text,
                                               p_start timestamptz, p_end timestamptz)
returns text
language plpgsql
set search_path to ''
as $$
begin
  if p_status not in ('confirmed', 'failed', 'cancelled') then return 'bad_status'; end if;
  begin
    update public.bookings
       set status = p_status,
           google_event_id = coalesce(p_event_id, google_event_id),
           slot_start = coalesce(p_start, slot_start),
           slot_end = coalesce(p_end, slot_end)
     where id = p_id and status in ('pending', 'confirmed');
  exception when unique_violation then
    -- Moved onto a time another booking holds: leave the row as it was.
    return 'conflict';
  end;
  return case when found then 'ok' else 'not_live' end;
end
$$;

revoke all on function public.booking_issue_code(text, text, text, text) from public, anon, authenticated;
revoke all on function public.booking_check_code(text, text, text) from public, anon, authenticated;
revoke all on function public.booking_reserve(text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.booking_finalize(uuid, text, text) from public, anon, authenticated;
revoke all on function public.booking_candidates(text, timestamptz) from public, anon, authenticated;
revoke all on function public.booking_sync(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.booking_issue_code(text, text, text, text) to service_role;
grant execute on function public.booking_check_code(text, text, text) to service_role;
grant execute on function public.booking_reserve(text, text, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.booking_finalize(uuid, text, text) to service_role;
grant execute on function public.booking_candidates(text, timestamptz) to service_role;
grant execute on function public.booking_sync(uuid, text, text, timestamptz, timestamptz) to service_role;
