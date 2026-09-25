-- ===========================================================================
-- Assertions for scripts/supabase-booking.sql. Runs the migration inside ONE
-- transaction, checks every limit and privilege it promises, then ROLLS BACK:
-- nothing persists. psql only (it uses \ir). Prefer a scratch database:
--
--   docker run --rm -d --name booking-sql -e POSTGRES_PASSWORD=x \
--     -v "$PWD/scripts:/scripts:ro" postgres:16-alpine
--   docker exec booking-sql psql -U postgres -v ON_ERROR_STOP=1 \
--     -f /scripts/supabase-booking.test.sql
--
-- Success prints "booking SQL: all checks passed"; any failed ASSERT aborts
-- with its message. Inside one transaction now() never moves, so the checks
-- that depend on code order or age set created_at / expires_at explicitly.
-- ===========================================================================
\set ON_ERROR_STOP on
begin;

-- Supabase's API roles, for a plain Postgres. CREATE ROLE rolls back too.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

\ir supabase-booking.sql

do $$
declare
  r text;
  v_id uuid;
  v_start timestamptz := date_trunc('hour', now()) + interval '2 days';
  f text;
begin
  -- --- booking_issue_code: caps ---------------------------------------------
  assert public.booking_issue_code('', 'a@example.com', 'h', null) = 'bad_request', 'empty session is refused';
  assert public.booking_issue_code('s1', ' Sam@Example.COM ', 'h1', '10.0.0.1') = 'ok', 'first code issues';
  assert (select email from public.booking_codes where code_hash = 'h1') = 'sam@example.com', 'email is normalised';
  assert public.booking_issue_code('s1', 'sam@example.com', 'h2', '10.0.0.1') = 'ok', 'second code issues';
  assert public.booking_issue_code('s1', 'sam@example.com', 'h3', '10.0.0.1') = 'ok', 'third code issues';
  assert public.booking_issue_code('s1', 'SAM@example.com', 'h4', '10.0.0.1') = 'rate_limited_email', '4th code per email per hour is refused';
  assert public.booking_issue_code('s1', 'other@example.com', 'h5', '10.0.0.1') = 'rate_limited_session', '4th code per session per hour is refused';
  for i in 1..5 loop
    assert public.booking_issue_code('ip' || i, 'ip' || i || '@example.com', 'hip' || i, '10.9.9.9') = 'ok', 'codes 1-5 from one IP issue';
  end loop;
  assert public.booking_issue_code('ip6', 'ip6@example.com', 'hip6', '10.9.9.9') = 'rate_limited_ip', '6th code per IP per hour is refused';
  assert (select count(*) from public.booking_codes where code_hash in ('h4', 'h5', 'hip6')) = 0, 'refused codes are not stored';
  -- Codes older than an hour no longer count against the email.
  update public.booking_codes set created_at = now() - interval '2 hours' where email = 'sam@example.com';
  assert public.booking_issue_code('s1b', 'sam@example.com', 'h6', '10.0.0.2') = 'ok', 'the hourly window slides';
  -- The global daily cap (40), which protects the sending domain.
  insert into public.booking_codes (session_id, email, code_hash, expires_at)
  select 'bulk' || g, 'bulk' || g || '@example.com', 'hb' || g, now() + interval '10 minutes' from generate_series(1, 40) g;
  assert public.booking_issue_code('s-late', 'late@example.com', 'hl', '10.0.0.3') = 'rate_limited_global', '40 codes a day is the global cap';
  delete from public.booking_codes where session_id like 'bulk%';

  -- --- booking_check_code ------------------------------------------------------
  delete from public.booking_codes;
  assert public.booking_issue_code('s2', 'pat@example.com', 'old', null) = 'ok';
  update public.booking_codes set created_at = now() - interval '1 minute' where code_hash = 'old';
  assert public.booking_issue_code('s2', 'pat@example.com', 'new', null) = 'ok';
  assert public.booking_check_code('s2', 'pat@example.com', 'old') = 'mismatch', 'only the latest code counts';
  assert public.booking_check_code('s-other', 'pat@example.com', 'new') = 'no_code', 'a code is bound to its session';
  assert public.booking_check_code('s2', 'nobody@example.com', 'new') = 'no_code', 'a code is bound to its email';
  for i in 1..4 loop
    assert public.booking_check_code('s2', 'pat@example.com', 'wrong') = 'mismatch';
  end loop;
  -- 'old' + 4 x 'wrong' = 5 misses on the latest code.
  assert public.booking_check_code('s2', 'pat@example.com', 'new') = 'too_many_attempts', 'after 5 misses even the right code is refused';
  assert (select verified_at from public.booking_codes where code_hash = 'new') is null, 'a locked code never verifies';

  assert public.booking_issue_code('s3', 'kim@example.com', 'k1', null) = 'ok';
  update public.booking_codes set expires_at = now() - interval '1 second' where code_hash = 'k1';
  assert public.booking_check_code('s3', 'kim@example.com', 'k1') = 'expired', 'an expired code is refused';

  assert public.booking_issue_code('s4', 'lee@example.com', 'l1', null) = 'ok';
  assert public.booking_check_code('s4', ' LEE@example.com ', 'l1') = 'ok', 'the right code verifies (email normalised)';
  assert public.booking_check_code('s4', 'lee@example.com', 'anything') = 'ok', 'a verified email stays verified for 30 minutes';
  update public.booking_codes set verified_at = now() - interval '31 minutes' where code_hash = 'l1';
  assert public.booking_check_code('s4', 'lee@example.com', 'anything') = 'no_code', '...and not after';
  update public.booking_codes set verified_at = now() where code_hash = 'l1';

  -- --- booking_reserve -----------------------------------------------------------
  assert public.booking_reserve('s3', 'kim@example.com', null, null, v_start, v_start + interval '30 minutes') = 'not_verified', 'an unverified email cannot book';
  assert public.booking_reserve('s-other', 'lee@example.com', null, null, v_start, v_start + interval '30 minutes') = 'not_verified', 'verification is bound to its session';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, now() - interval '1 hour', now()) = 'bad_slot', 'a past slot is refused';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start, v_start) = 'bad_slot', 'an empty slot is refused';
  r := public.booking_reserve('s4', 'Lee@Example.com', 'Lee', repeat('t', 900), v_start, v_start + interval '30 minutes');
  assert r like 'ok:%', 'a verified email books an open slot';
  v_id := substr(r, 4)::uuid;
  assert (select length(topic) from public.bookings where id = v_id) = 500, 'the topic is capped at 500 characters';
  assert (select status from public.bookings where id = v_id) = 'pending', 'a new booking is pending';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 day', v_start + interval '1 day 30 minutes') = 'already_booked', 'one upcoming booking per email';

  assert public.booking_issue_code('s5', 'max@example.com', 'm1', null) = 'ok';
  assert public.booking_check_code('s5', 'max@example.com', 'm1') = 'ok';
  assert public.booking_reserve('s5', 'max@example.com', null, null, v_start, v_start + interval '30 minutes') = 'slot_taken', 'two people can never hold one slot';

  -- --- booking_finalize ---------------------------------------------------------------
  assert public.booking_finalize(v_id, 'evt_1', 'maybe') = 'bad_status', 'only confirmed/failed are accepted';
  assert public.booking_finalize(v_id, null, 'failed') = 'ok', 'a failed calendar insert releases the booking';
  assert public.booking_finalize(v_id, 'evt_1', 'confirmed') = 'not_pending', 'a finished booking cannot be flipped';
  r := public.booking_reserve('s5', 'max@example.com', null, null, v_start, v_start + interval '30 minutes');
  assert r like 'ok:%', 'a released slot can be booked again';
  assert public.booking_finalize(substr(r, 4)::uuid, 'evt_2', 'confirmed') = 'ok', 'a booking is confirmed with its event id';
  assert (select google_event_id from public.bookings where id = substr(r, 4)::uuid) = 'evt_2';
  r := public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 hour', v_start + interval '90 minutes');
  assert r like 'ok:%', 'a FAILED booking does not count as the email''s upcoming one';

  -- The daily cap on live bookings (8).
  insert into public.bookings (session_id, email, slot_start, slot_end, status)
  select 'bulk', 'b' || g || '@example.com', v_start + (g || ' days')::interval, v_start + (g || ' days')::interval + interval '30 minutes', 'confirmed'
  from generate_series(3, 8) g;
  assert (select count(*) from public.bookings where status in ('pending', 'confirmed')) = 8;
  assert public.booking_issue_code('s6', 'ann@example.com', 'a1', null) = 'ok';
  assert public.booking_check_code('s6', 'ann@example.com', 'a1') = 'ok';
  assert public.booking_reserve('s6', 'ann@example.com', null, null, v_start + interval '10 days', v_start + interval '10 days 30 minutes') = 'daily_cap', '8 live bookings a day is the cap';

  -- --- privileges: only service_role, never the public API roles ---------------------------
  foreach f in array array['public.booking_codes', 'public.bookings'] loop
    assert (select relrowsecurity from pg_class where oid = f::regclass), f || ' has RLS on';
    assert not exists (select 1 from pg_policies where schemaname || '.' || tablename = f), f || ' has no policies';
    assert not has_table_privilege('anon', f, 'select') and not has_table_privilege('anon', f, 'insert')
       and not has_table_privilege('anon', f, 'update') and not has_table_privilege('anon', f, 'delete'), 'anon has no rights on ' || f;
    assert not has_table_privilege('authenticated', f, 'select') and not has_table_privilege('authenticated', f, 'delete'), 'authenticated has no rights on ' || f;
    assert has_table_privilege('service_role', f, 'select') and has_table_privilege('service_role', f, 'insert'), 'service_role can use ' || f;
  end loop;
  foreach f in array array[
    'public.booking_issue_code(text, text, text, text)', 'public.booking_check_code(text, text, text)',
    'public.booking_reserve(text, text, text, text, timestamptz, timestamptz)', 'public.booking_finalize(uuid, text, text)'] loop
    assert not has_function_privilege('anon', f, 'execute'), 'anon cannot call ' || f;
    assert not has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot call ' || f;
    assert has_function_privilege('service_role', f, 'execute'), 'service_role can call ' || f;
    assert (select proconfig from pg_proc where oid = f::regprocedure) @> array['search_path=""'], f || ' pins an empty search_path';
    assert not (select prosecdef from pg_proc where oid = f::regprocedure), f || ' is SECURITY INVOKER';
  end loop;

  raise notice 'booking SQL: all checks passed';
end $$;

rollback;
