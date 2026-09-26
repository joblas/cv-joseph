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
-- that depend on age set created_at / expires_at / verified_at explicitly.
-- Races need two sessions: see scripts/supabase-booking.race.sql.
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
  r_fresh uuid; r_stale uuid; r_mine uuid; r_slot uuid; r_past uuid; r_other uuid; r_failed uuid;
  r_59 uuid; r_61 uuid; r_newconf uuid; r_6min uuid;
  ids uuid[];
begin
  -- --- booking_issue_code: caps and windows -----------------------------------
  assert public.booking_issue_code('', 'a@example.com', 'h', null) = 'bad_request', 'empty session is refused';
  assert public.booking_issue_code('s1', ' Sam@Example.COM ', 'h1', '10.0.0.1') = 'ok', 'first code issues';
  assert (select email from public.booking_codes where code_hash = 'h1') = 'sam@example.com', 'email is normalised';
  assert (select expires_at - created_at from public.booking_codes where code_hash = 'h1') = interval '10 minutes', 'a code lives exactly 10 minutes';
  assert public.booking_issue_code('s1', 'sam@example.com', 'h2', '10.0.0.1') = 'ok', 'second code issues';
  assert public.booking_issue_code('s1', 'sam@example.com', 'h3', '10.0.0.1') = 'ok', 'third code issues';
  -- The hourly windows are a full hour: 59-minute-old codes still count.
  update public.booking_codes set created_at = now() - interval '59 minutes' where session_id = 's1';
  assert public.booking_issue_code('s1', 'SAM@example.com', 'h4', '10.0.0.1') = 'rate_limited_email', '4th code per email per hour is refused';
  assert public.booking_issue_code('s1', 'other@example.com', 'h5', '10.0.0.1') = 'rate_limited_session', '4th code per session per hour is refused';
  for i in 1..5 loop
    assert public.booking_issue_code('ip' || i, 'ip' || i || '@example.com', 'hip' || i, '10.9.9.9') = 'ok', 'codes 1-5 from one IP issue';
  end loop;
  update public.booking_codes set created_at = now() - interval '59 minutes' where ip = '10.9.9.9';
  assert public.booking_issue_code('ip6', 'ip6@example.com', 'hip6', '10.9.9.9') = 'rate_limited_ip', '6th code per IP per hour is refused';
  assert (select count(*) from public.booking_codes where code_hash in ('h4', 'h5', 'hip6')) = 0, 'refused codes are not stored';
  -- Codes older than an hour no longer count against the hourly caps...
  update public.booking_codes set created_at = now() - interval '2 hours' where email = 'sam@example.com';
  assert public.booking_issue_code('s1b', 'sam@example.com', 'h6', '10.0.0.2') = 'ok', 'the hourly window slides';
  -- ...but the per-email DAILY cap (6) still sees them.
  insert into public.booking_codes (session_id, email, code_hash, created_at, expires_at)
  values ('old1', 'sam@example.com', 'ho1', now() - interval '3 hours', now()), ('old2', 'sam@example.com', 'ho2', now() - interval '3 hours', now());
  assert public.booking_issue_code('s1c', 'sam@example.com', 'h7', '10.0.0.3') = 'rate_limited_email', '6 codes per email per day is the cap';
  update public.booking_codes set created_at = now() - interval '23 hours' where email = 'sam@example.com';
  assert public.booking_issue_code('s1d', 'sam@example.com', 'h8', '10.0.0.4') = 'rate_limited_email', 'the daily window is a full day';
  update public.booking_codes set created_at = now() - interval '25 hours' where email = 'sam@example.com';
  assert public.booking_issue_code('s1e', 'sam@example.com', 'h9', '10.0.0.5') = 'ok', '...and slides after it';
  -- The per-IP daily cap (12).
  insert into public.booking_codes (session_id, email, code_hash, ip, created_at, expires_at)
  select 'ipd' || g, 'ipd' || g || '@example.com', 'hipd' || g, '10.8.8.8', now() - interval '2 hours', now() from generate_series(1, 12) g;
  assert public.booking_issue_code('s-ipday', 'ipday@example.com', 'hid', '10.8.8.8') = 'rate_limited_ip', '12 codes per IP per day is the cap';
  -- The global daily cap (40), which protects the sending domain — over a day, not an hour.
  delete from public.booking_codes;
  insert into public.booking_codes (session_id, email, code_hash, created_at, expires_at)
  select 'bulk' || g, 'bulk' || g || '@example.com', 'hb' || g, now() - interval '23 hours', now() from generate_series(1, 40) g;
  assert public.booking_issue_code('s-late', 'late@example.com', 'hl', '10.0.0.9') = 'rate_limited_global', '40 codes a day is the global cap';
  delete from public.booking_codes;

  -- --- booking_check_code ------------------------------------------------------
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
  assert public.booking_check_code('s-other', 'lee@example.com', 'anything') = 'no_code', '...in THAT session only';
  update public.booking_codes set verified_at = now() - interval '31 minutes' where code_hash = 'l1';
  assert public.booking_check_code('s4', 'lee@example.com', 'anything') = 'no_code', '...and not after 30 minutes';
  update public.booking_codes set verified_at = now() where code_hash = 'l1';

  -- --- booking_reserve -----------------------------------------------------------
  assert public.booking_reserve('s3', 'kim@example.com', null, null, v_start, v_start + interval '30 minutes') = 'not_verified', 'an unverified email cannot book';
  assert public.booking_reserve('s-other', 'lee@example.com', null, null, v_start, v_start + interval '30 minutes') = 'not_verified', 'verification is bound to its session';
  update public.booking_codes set verified_at = now() - interval '31 minutes' where code_hash = 'l1';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start, v_start + interval '30 minutes') = 'not_verified', 'a verification older than 30 minutes cannot book';
  update public.booking_codes set verified_at = now() where code_hash = 'l1';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, now() - interval '1 hour', now()) = 'bad_slot', 'a past slot is refused';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start, v_start) = 'bad_slot', 'an empty slot is refused';
  r := public.booking_reserve('s4', 'Lee@Example.com', 'Lee', repeat('t', 900), v_start, v_start + interval '30 minutes');
  assert r like 'ok:%', 'a verified email books an open slot';
  v_id := substr(r, 4)::uuid;
  assert (select length(topic) from public.bookings where id = v_id) = 500, 'the topic is capped at 500 characters';
  assert (select status from public.bookings where id = v_id) = 'pending', 'a new booking is pending';
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 day', v_start + interval '1 day 30 minutes') = 'in_progress',
    'a booking still in flight for this email is reported as in progress, not as an existing call';
  update public.bookings set created_at = now() - interval '59 seconds' where id = v_id;
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 day', v_start + interval '1 day 30 minutes') = 'in_progress',
    'the in-flight window is a full 60 seconds';
  update public.bookings set created_at = now() - interval '61 seconds' where id = v_id;
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 day', v_start + interval '1 day 30 minutes') = 'already_booked',
    '...and ends after it';
  update public.bookings set created_at = now() - interval '2 minutes' where id = v_id;
  assert public.booking_reserve('s4', 'lee@example.com', null, null, v_start + interval '1 day', v_start + interval '1 day 30 minutes') = 'already_booked', 'one upcoming booking per email';

  assert public.booking_issue_code('s5', 'max@example.com', 'm1', null) = 'ok';
  assert public.booking_check_code('s5', 'max@example.com', 'm1') = 'ok';
  assert public.booking_reserve('s5', 'max@example.com', null, null, v_start, v_start + interval '30 minutes') = 'slot_taken', 'two people can never hold one slot';

  -- A call in the PAST is not an upcoming one.
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at)
  values ('old', 'past@example.com', now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 'confirmed', now() - interval '3 days');
  assert public.booking_issue_code('s7', 'past@example.com', 'p1', null) = 'ok';
  assert public.booking_check_code('s7', 'past@example.com', 'p1') = 'ok';
  assert public.booking_reserve('s7', 'past@example.com', null, null, v_start + interval '2 hours', v_start + interval '150 minutes') like 'ok:%',
    'someone who had a call before can book again';

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

  -- The daily cap on LIVE bookings (8). Live today: past@, max, lee = 3.
  assert (select count(*) from public.bookings where status in ('pending', 'confirmed') and created_at > now() - interval '1 day') = 3;
  -- Failed and cancelled rows never count toward it.
  insert into public.bookings (session_id, email, slot_start, slot_end, status)
  select 'dead', 'dead' || g || '@example.com', v_start + (g || ' days')::interval, v_start + (g || ' days')::interval + interval '30 minutes',
         case when g = 1 then 'cancelled' else 'failed' end
  from generate_series(1, 7) g;
  assert public.booking_issue_code('s6', 'ann@example.com', 'a1', null) = 'ok';
  assert public.booking_check_code('s6', 'ann@example.com', 'a1') = 'ok';
  assert public.booking_reserve('s6', 'ann@example.com', null, null, v_start + interval '20 days', v_start + interval '20 days 30 minutes') like 'ok:%',
    'failed and cancelled bookings do not eat the daily cap';
  insert into public.bookings (session_id, email, slot_start, slot_end, status)
  select 'bulk', 'b' || g || '@example.com', v_start + (g || ' days')::interval, v_start + (g || ' days')::interval + interval '30 minutes', 'confirmed'
  from generate_series(3, 6) g;
  assert (select count(*) from public.bookings where status in ('pending', 'confirmed') and created_at > now() - interval '1 day') = 8;
  assert public.booking_issue_code('s8', 'bob@example.com', 'b1', null) = 'ok';
  assert public.booking_check_code('s8', 'bob@example.com', 'b1') = 'ok';
  assert public.booking_reserve('s8', 'bob@example.com', null, null, v_start + interval '10 days', v_start + interval '10 days 30 minutes') = 'daily_cap', '8 live bookings a day is the cap';

  -- --- booking_candidates / booking_sync: rows follow their Google events ---------------
  delete from public.bookings;
  insert into public.bookings (session_id, email, slot_start, slot_end, status) values
    ('x', 'fresh@example.com', v_start + interval '1 day', v_start + interval '1 day 30 minutes', 'pending') returning id into r_fresh;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'stale@example.com', v_start + interval '2 days', v_start + interval '2 days 30 minutes', 'pending', now() - interval '2 minutes') returning id into r_stale;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, google_event_id, created_at) values
    ('x', 'me@example.com', v_start + interval '3 days', v_start + interval '3 days 30 minutes', 'confirmed', 'evt_me', now() - interval '30 minutes') returning id into r_mine;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, google_event_id, created_at) values
    ('x', 'holder@example.com', v_start + interval '4 days', v_start + interval '4 days 30 minutes', 'confirmed', 'evt_slot', now() - interval '30 minutes') returning id into r_slot;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'me@example.com', now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 'confirmed', now() - interval '3 days') returning id into r_past;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'other@example.com', v_start + interval '5 days', v_start + interval '5 days 30 minutes', 'confirmed', now() - interval '1 day') returning id into r_other;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'failed@example.com', v_start + interval '6 days', v_start + interval '6 days 30 minutes', 'failed', now() - interval '1 day') returning id into r_failed;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'p59@example.com', v_start + interval '8 days', v_start + interval '8 days 30 minutes', 'pending', now() - interval '59 seconds') returning id into r_59;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at) values
    ('x', 'p61@example.com', v_start + interval '9 days', v_start + interval '9 days 30 minutes', 'pending', now() - interval '61 seconds') returning id into r_61;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, google_event_id, created_at) values
    ('x', 'me@example.com', v_start + interval '12 days', v_start + interval '12 days 30 minutes', 'confirmed', 'evt_new', now() - interval '4 minutes') returning id into r_newconf;
  insert into public.bookings (session_id, email, slot_start, slot_end, status, google_event_id, created_at) values
    ('x', 'me@example.com', v_start + interval '13 days', v_start + interval '13 days 30 minutes', 'confirmed', 'evt_6', now() - interval '6 minutes') returning id into r_6min;
  select array_agg(c.id) into ids from public.booking_candidates(' ME@example.com ', v_start + interval '4 days') c;
  assert ids[1:3] @> array[r_mine, r_slot, r_6min] and ids[1:3] <@ array[r_mine, r_slot, r_6min], 'this visitor''s email and slot rows come first (a confirmed row 6 minutes old included)';
  assert ids[4:5] @> array[r_stale, r_61] and ids[4:5] <@ array[r_stale, r_61] and cardinality(ids) = 5, 'then stale pending rows; nothing else';
  assert not (ids @> array[r_fresh]) and not (ids @> array[r_59]), 'a pending row still in flight (under 60s) is never touched';
  assert not (ids @> array[r_newconf]), 'a booking confirmed under 5 minutes ago is never touched (Google may not show it yet)';
  delete from public.bookings where id in (r_59, r_61, r_newconf, r_6min);
  assert not (ids @> array[r_past]) and not (ids @> array[r_other]) and not (ids @> array[r_failed]), 'past, unrelated and dead rows are not candidates';
  -- The visitor's rows can't be crowded out of the limit by stale rows elsewhere
  -- (these six are OLDER than the visitor's rows, so age order alone would
  -- put them first).
  insert into public.bookings (session_id, email, slot_start, slot_end, status, created_at)
  select 'x', 'crowd' || g || '@example.com', v_start + (10 + g || ' days')::interval, v_start + (10 + g || ' days')::interval + interval '30 minutes', 'pending', now() - interval '1 hour'
  from generate_series(1, 6) g;
  select array_agg(c.id) into ids from public.booking_candidates('me@example.com', v_start + interval '4 days') c;
  assert cardinality(ids) = 5 and ids @> array[r_mine, r_slot], 'at most 5, and the visitor''s rows are always among them';
  delete from public.bookings where email like 'crowd%@example.com';

  begin
    r := public.booking_sync(r_stale, 'maybe', null, null, null);
  exception when check_violation then
    r := 'raised check_violation';
  end;
  assert r = 'bad_status', 'sync accepts only confirmed/failed/cancelled, and says so (got ' || r || ')';
  update public.bookings set google_event_id = 'evt_stale' where id = r_stale;
  assert public.booking_sync(r_stale, 'failed', null, null, null) = 'ok', 'a stale pending row with no event is failed';
  assert (select google_event_id from public.bookings where id = r_stale) = 'evt_stale', 'a null event id never erases the recorded one';
  assert public.booking_sync(r_failed, 'confirmed', 'e', null, null) = 'not_live', 'a dead row is never revived';
  assert public.booking_sync(r_mine, 'cancelled', null, null, null) = 'ok', 'a booking Joe cancelled is released';
  assert public.booking_issue_code('s9', 'me@example.com', 'me1', null) = 'ok';
  assert public.booking_check_code('s9', 'me@example.com', 'me1') = 'ok';
  assert public.booking_reserve('s9', 'me@example.com', null, null, v_start + interval '3 days', v_start + interval '3 days 30 minutes') like 'ok:%',
    '...which frees both the email and the slot';
  assert public.booking_sync(r_slot, 'confirmed', 'evt_moved', v_start + interval '7 days', v_start + interval '7 days 30 minutes') = 'ok', 'a booking Joe moved follows the event';
  assert (select slot_start = v_start + interval '7 days' and google_event_id = 'evt_moved' from public.bookings where id = r_slot), '...to its new time and id';
  begin
    r := public.booking_sync(r_slot, 'confirmed', null, v_start + interval '5 days', v_start + interval '5 days 30 minutes');
  exception when unique_violation then
    r := 'raised unique_violation';
  end;
  assert r = 'conflict', 'moving onto a time another booking holds is refused, not raised (got ' || r || ')';
  assert (select slot_start from public.bookings where id = r_slot) = v_start + interval '7 days', '...and leaves the row as it was';

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
    'public.booking_reserve(text, text, text, text, timestamptz, timestamptz)', 'public.booking_finalize(uuid, text, text)',
    'public.booking_candidates(text, timestamptz)', 'public.booking_sync(uuid, text, text, timestamptz, timestamptz)'] loop
    assert not has_function_privilege('anon', f, 'execute'), 'anon cannot call ' || f;
    assert not has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot call ' || f;
    assert has_function_privilege('service_role', f, 'execute'), 'service_role can call ' || f;
    assert (select proconfig from pg_proc where oid = f::regprocedure) @> array['search_path=""'], f || ' pins an empty search_path';
    assert not (select prosecdef from pg_proc where oid = f::regprocedure), f || ' is SECURITY INVOKER';
  end loop;

  raise notice 'booking SQL: all checks passed';
end $$;

rollback;
