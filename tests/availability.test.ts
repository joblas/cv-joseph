// When a visitor may book a call with Joe. Pure arithmetic, so every check
// below compares against an instant worked out BY HAND — never against the
// module's own output, which would let a wrong conversion agree with itself.
//
// The windows are Joe's own (2026-09-25): weekday evenings 18:00-20:00 and
// weekends 10:00-14:00 Pacific, 30-minute calls, 24 hours' notice. The single
// most important property is the negative one: NO weekday-daytime slot, ever.
// Joe's weekday daytime is not necessarily on the calendar this code reads,
// so the windows are the only thing standing between a prospect and a time he
// cannot take.
import {
  BOOKING_TZ, DEFAULT_HOURS, bookingHours, computeSlots, localParts, parseSlot,
  slotKey, slotLabel, spreadAcrossDays, zonedToUtc,
} from '../functions/api-src/_shared/availability.js'

let failed = 0
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`  ✗ ${name}`); failed++ }
}
const iso = (ms: number) => new Date(ms).toISOString()
const at = (s: string) => Date.parse(s)

// --- 1. Wall clock -> instant, against hand-computed UTC ----------------------
// Pacific Daylight Time is UTC-7; Pacific Standard Time is UTC-8. US DST 2026
// ends Sunday Nov 1 at 02:00 PDT; 2027 begins Sunday Mar 14 at 02:00 PST.
check('Mon Sep 28 2026 18:00 PDT = 01:00Z next day',
  iso(zonedToUtc(2026, 9, 28, 18, 0)) === '2026-09-29T01:00:00.000Z')
check('Sat Oct 31 2026 10:00 PDT (last day of DST) = 17:00Z',
  iso(zonedToUtc(2026, 10, 31, 10, 0)) === '2026-10-31T17:00:00.000Z')
check('Sun Nov 1 2026 10:00 PST (the fall-back day, after the change) = 18:00Z',
  iso(zonedToUtc(2026, 11, 1, 10, 0)) === '2026-11-01T18:00:00.000Z')
check('Mon Nov 2 2026 18:00 PST = 02:00Z next day',
  iso(zonedToUtc(2026, 11, 2, 18, 0)) === '2026-11-03T02:00:00.000Z')
check('Sun Mar 14 2027 10:00 PDT (the spring-forward day, after the change) = 17:00Z',
  iso(zonedToUtc(2027, 3, 14, 10, 0)) === '2027-03-14T17:00:00.000Z')
// The hours where a one-pass conversion goes wrong: after the change, but
// early enough that the naive guess sits BEFORE it. Joe's windows never reach
// these, but BOOKING_HOURS can be overridden, so the function must hold for
// every hour.
check('Sun Nov 1 2026 03:00 PST (hour after fall-back) = 11:00Z',
  iso(zonedToUtc(2026, 11, 1, 3, 0)) === '2026-11-01T11:00:00.000Z')
check('Sun Mar 14 2027 03:00 PDT (hour after spring-forward) = 10:00Z',
  iso(zonedToUtc(2027, 3, 14, 3, 0)) === '2027-03-14T10:00:00.000Z')

// --- 2. Labels and keys: what the model shows and sends back -----------------
const mon6pm = at('2026-09-29T01:00:00Z')
check('label reads as a visitor would say it', slotLabel(mon6pm) === 'Mon, Sep 28, 6:00 PM PT')
check('key is Pacific wall clock, 24-hour', slotKey(mon6pm) === '2026-09-28 18:00')
check('key survives the fall-back day', slotKey(at('2026-11-01T18:00:00Z')) === '2026-11-01 10:00')

// --- 3. Parsing what the model sends back ------------------------------------
check('parses the key form', parseSlot('2026-09-28 18:00') === mon6pm)
check('parses a T-separated key', parseSlot('2026-09-28T18:00') === mon6pm)
check('parses a full ISO instant', parseSlot('2026-09-29T01:00:00Z') === mon6pm)
check('parses an offset instant', parseSlot('2026-09-28T18:00:00-07:00') === mon6pm)
check('rejects a wall time that does not exist (2:30am on spring-forward day)', parseSlot('2027-03-14 02:30') === null)
check('rejects an impossible date', parseSlot('2026-02-30 10:00') === null)
check('rejects free text', parseSlot('next tuesday at 6') === null)
check('rejects empty', parseSlot('') === null && parseSlot(undefined) === null)

// --- 4. The windows themselves -----------------------------------------------
// "Now" is Fri Sep 25 2026 10:00 PDT. 24h notice -> nothing before Sat 10:00.
const now = at('2026-09-25T17:00:00Z')
const slots = computeSlots({ now })
// Weekday of the slot's own Pacific calendar date (pure calendar arithmetic).
const local = slots.map((s) => { const p = localParts(s.start); return { ...p, wd: new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() } })

check('produces slots', slots.length > 0)
check('THE RULE: no weekday slot before 18:00 PT, ever',
  local.every((p) => (p.wd === 0 || p.wd === 6) || p.hh >= 18))
check('weekday slots end by 20:00 (last start 19:30)',
  local.every((p) => (p.wd === 0 || p.wd === 6) || (p.hh * 60 + p.mm) <= 19 * 60 + 30))
check('weekend slots sit inside 10:00-14:00 (last start 13:30)',
  local.every((p) => !(p.wd === 0 || p.wd === 6) || ((p.hh * 60 + p.mm) >= 600 && (p.hh * 60 + p.mm) <= 13 * 60 + 30)))
check('every slot is exactly 30 minutes', slots.every((s) => s.end - s.start === 30 * 60000))
check('24 hours’ notice: nothing before Sat Sep 26 10:00 PDT', slots.every((s) => s.start >= now + 24 * 3600_000))
check('the first slot is Sat Sep 26 10:00 PDT', slots[0] && iso(slots[0].start) === '2026-09-26T17:00:00.000Z')
check('the 14-day horizon holds', slots.every((s) => s.end <= now + 14 * 86400_000))
// Sat + Sun at 8 slots each, and 5 weekday evenings at 4 each, in the first full week.
const firstWeek = slots.filter((s) => s.start < at('2026-10-03T07:00:00Z'))
check('first week = 2 weekend days x 8 + 5 evenings x 4 = 36 slots', firstWeek.length === 36)

// A window whose length is not a multiple of 30 minutes. Joe's defaults are
// all aligned, so only an override exposes this: with 18:00-19:45 the last
// START is 19:00, because a 19:30 start would run to 20:00, past the window.
const unaligned = computeSlots({ now, hours: { 1: [['18:00', '19:45']] } })
const endsLocal = unaligned.map((s) => { const p = localParts(s.end); return p.hh * 60 + p.mm })
check('an unaligned window never offers a slot that runs past its end', unaligned.length > 0 && endsLocal.every((m) => m <= 19 * 60 + 45))
check('...so its last start is 19:00, not 19:30', unaligned.every((s) => slotKey(s.start).slice(11) !== '19:30'))

// --- 5. Busy time is respected -----------------------------------------------
// Busy Mon Sep 28 18:15-18:45 PDT overlaps both the 18:00 and 18:30 slots.
const busy = [{ start: at('2026-09-29T01:15:00Z'), end: at('2026-09-29T01:45:00Z') }]
const withBusy = computeSlots({ now, busy }).map((s) => slotKey(s.start))
check('a busy block removes every slot it overlaps', !withBusy.includes('2026-09-28 18:00') && !withBusy.includes('2026-09-28 18:30'))
check('...and only those', withBusy.includes('2026-09-28 19:00') && withBusy.includes('2026-09-28 19:30'))
// Touching is not overlapping: an event ending exactly at 18:00 leaves 18:00 free.
const touching = [{ start: at('2026-09-29T00:00:00Z'), end: at('2026-09-29T01:00:00Z') }]
check('an event ending exactly at slot start does not block it',
  computeSlots({ now, busy: touching }).some((s) => slotKey(s.start) === '2026-09-28 18:00'))

// --- 6. Across the November 1 clock change -------------------------------------
// "Now" Fri Oct 23: the horizon spans the fall-back. Every weekend slot must
// still land at 10:00-13:30 wall clock, and no calendar date may be skipped
// or repeated by the walk.
const dstNow = at('2026-10-23T17:00:00Z')
const dstSlots = computeSlots({ now: dstNow })
const nov1 = dstSlots.filter((s) => slotKey(s.start).startsWith('2026-11-01'))
check('Nov 1 (fall-back Sunday) still offers exactly 8 slots', nov1.length === 8)
check('...starting at 10:00 PST = 18:00Z', nov1[0] && iso(nov1[0].start) === '2026-11-01T18:00:00.000Z')
check('...and ending with a 13:30 PST start = 21:30Z', nov1[7] && iso(nov1[7].start) === '2026-11-01T21:30:00.000Z')
const dates = new Set(dstSlots.map((s) => slotKey(s.start).slice(0, 10)))
check('Sat Oct 31 and Sun Nov 1 are both present', dates.has('2026-10-31') && dates.has('2026-11-01'))
// A duplicate would be a double-booked slot. (An earlier version checked a
// list it had already de-duplicated with a Set, so it could never fail.)
const noDupes = (xs: { start: number }[]) => new Set(xs.map((x) => x.start)).size === xs.length
check('no slot is offered twice across the change', noDupes(dstSlots))
// The walk must step CALENDAR dates. Stepping 24 hours from just after local
// midnight on the fall-back day lands on 23:30 the SAME date (that day is 25
// hours long), repeating Sunday and double-offering every one of its slots.
// Notice is zeroed to isolate the walk.
const midnightNow = at('2026-11-01T07:30:00Z') // Sun Nov 1, 00:30 PDT
const midnightSlots = computeSlots({ now: midnightNow, minNoticeHours: 0, horizonDays: 3 })
check('walking from 00:30 on the fall-back day repeats no slot', noDupes(midnightSlots))
check('...and still offers Sunday exactly once (8 slots)',
  midnightSlots.filter((s) => slotKey(s.start).startsWith('2026-11-01')).length === 8)

// --- 7. The menu shown to a visitor -----------------------------------------
const menu = spreadAcrossDays(slots)
check('menu offers at most 6 slots', menu.length <= 6 && menu.length > 0)
check('menu spreads across days rather than one evening',
  new Set(menu.map((s) => slotKey(s.start).slice(0, 10))).size >= 3)
check('menu is in time order', menu.every((s, i) => i === 0 || menu[i - 1].start < s.start))

// --- 8. The override fails CLOSED -------------------------------------------
check('no override -> Joe’s defaults', bookingHours(undefined) === DEFAULT_HOURS && bookingHours('') === DEFAULT_HOURS)
check('a valid override is honoured', JSON.stringify(bookingHours('{"6":[["09:00","12:00"]]}')) === '{"6":[["09:00","12:00"]]}')
const throws = (raw: string) => { try { bookingHours(raw); return false } catch { return true } }
check('invalid JSON throws (booking switches off, never guesses)', throws('{not json'))
check('a day key outside 0-6 throws', throws('{"7":[["09:00","10:00"]]}'))
check('a malformed time throws', throws('{"1":[["9am","10:00"]]}'))
check('an inverted window throws', throws('{"1":[["20:00","18:00"]]}'))
check('a non-list window throws', throws('{"1":"18:00-20:00"}'))
check('the zone is Pacific', BOOKING_TZ === 'America/Los_Angeles')

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('ok — windows hold, notice holds, DST holds, override fails closed')
