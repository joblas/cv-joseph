-- ===========================================================================
-- Race checks for scripts/supabase-booking.sql: two overlapping requests must
-- not both pass a cap. A race needs two sessions and COMMITTED rows, so this
-- cannot run inside the rolled-back battery. It creates its own scratch
-- database, runs there, and drops it — never point it at a real project (on
-- Supabase it stops at CREATE DATABASE anyway). It may leave the three API
-- roles behind in the cluster; use a throwaway container:
--
--   docker run --rm -d --name booking-sql -e POSTGRES_PASSWORD=x \
--     -v "$PWD/scripts:/scripts:ro" postgres:16-alpine
--   docker exec booking-sql psql -U postgres -v ON_ERROR_STOP=1 \
--     -f /scripts/supabase-booking.race.sql
--
-- How: session A runs a request inside an open transaction; session B then
-- sends the competing request and A commits. With the global advisory lock,
-- B waits for A and sees its row; without it, B counts too few and passes.
-- ===========================================================================
\set ON_ERROR_STOP on
drop database if exists booking_race_scratch;
create database booking_race_scratch;
\c booking_race_scratch
create extension dblink;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
\ir supabase-booking.sql

-- --- 1. The per-IP hourly cap (5): four committed, then two at once ------------
select public.booking_issue_code('r' || g, 'r' || g || '@example.com', 'hr' || g, '10.7.7.7') from generate_series(1, 4) g;
select dblink_connect('a', 'dbname=booking_race_scratch');
select dblink_connect('b', 'dbname=booking_race_scratch');
select dblink_exec('a', 'begin');
select * from dblink('a', $q$select public.booking_issue_code('ra', 'ra@example.com', 'hra', '10.7.7.7')$q$) as t(r text);
select dblink_send_query('b', $q$select public.booking_issue_code('rb', 'rb@example.com', 'hrb', '10.7.7.7')$q$);
select pg_sleep(0.3);
select dblink_exec('a', 'commit');
create temp table race_result as select r from dblink_get_result('b') as t(r text);
select * from dblink_get_result('b') as t(r text); -- drain
do $$ begin
  assert (select r from race_result) = 'rate_limited_ip',
    'two overlapping requests from one IP cannot pass the cap of 5 (got ' || coalesce((select r from race_result), 'null') || ')';
  assert (select count(*) from public.booking_codes where ip = '10.7.7.7') = 5, 'exactly 5 codes were stored';
end $$;
drop table race_result;

-- --- 2. The daily cap on live bookings (8): seven committed, then two at once ---
insert into public.bookings (session_id, email, slot_start, slot_end, status)
select 'seed', 'seed' || g || '@example.com', now() + (g || ' days')::interval, now() + (g || ' days')::interval + interval '30 minutes', 'confirmed'
from generate_series(1, 7) g;
select public.booking_issue_code('sa', 'ya@example.com', 'hya', null), public.booking_issue_code('sb', 'yb@example.com', 'hyb', null);
select public.booking_check_code('sa', 'ya@example.com', 'hya'), public.booking_check_code('sb', 'yb@example.com', 'hyb');
select dblink_exec('a', 'begin');
select * from dblink('a', $q$select public.booking_reserve('sa', 'ya@example.com', null, null, now() + interval '20 days', now() + interval '20 days 30 minutes')$q$) as t(r text);
select dblink_send_query('b', $q$select public.booking_reserve('sb', 'yb@example.com', null, null, now() + interval '21 days', now() + interval '21 days 30 minutes')$q$);
select pg_sleep(0.3);
select dblink_exec('a', 'commit');
create temp table race_result as select r from dblink_get_result('b') as t(r text);
select * from dblink_get_result('b') as t(r text); -- drain
do $$ begin
  assert (select r from race_result) = 'daily_cap',
    'two overlapping reservations cannot pass the daily cap of 8 (got ' || coalesce((select r from race_result), 'null') || ')';
  assert (select count(*) from public.bookings where status in ('pending', 'confirmed')) = 8, 'exactly 8 live bookings exist';
end $$;

select dblink_disconnect('a');
select dblink_disconnect('b');
\c postgres
drop database booking_race_scratch;
\echo booking race: all checks passed
