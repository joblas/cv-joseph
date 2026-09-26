// ---------------------------------------------------------------------------
// When a visitor can book a call with Joe — pure calendar arithmetic, no I/O.
//
// Joe decided these on 2026-09-25: weekday evenings 6–8pm and weekends
// 10am–2pm, Pacific time, 30-minute calls, at least 24 hours' notice. They are
// deliberately NOT business hours: weekday daytime is unavailable for JTS
// calls, and that unavailability is not necessarily on the calendar this code
// reads, so free/busy alone cannot protect it — these windows have to.
//
// Every instant here is a UTC millisecond timestamp. Wall-clock times exist
// only at the edges: turning a window like "Mon 18:00 PT" into an instant, and
// turning an instant back into a label a visitor can read.
// ---------------------------------------------------------------------------

export const BOOKING_TZ = 'America/Los_Angeles'
export const SLOT_MINUTES = 30
export const MIN_NOTICE_HOURS = 24
export const HORIZON_DAYS = 14
export const MAX_OFFERED = 6

// Weekday (0 = Sunday … 6 = Saturday) -> [start, end) wall-clock windows.
export const DEFAULT_HOURS = Object.freeze({
  0: [['10:00', '14:00']],
  1: [['18:00', '20:00']],
  2: [['18:00', '20:00']],
  3: [['18:00', '20:00']],
  4: [['18:00', '20:00']],
  5: [['18:00', '20:00']],
  6: [['10:00', '14:00']],
})

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

// BOOKING_HOURS may override the defaults with the same JSON shape. A value
// that does not parse or validate THROWS: a broken override must switch
// booking off, never quietly fall back to hours Joe did not choose — the
// failure mode that matters is booking a prospect into a time he cannot take.
export function bookingHours(raw = process.env.BOOKING_HOURS) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_HOURS
  let parsed
  try { parsed = JSON.parse(raw) } catch { throw new Error('BOOKING_HOURS is not valid JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('BOOKING_HOURS must be an object keyed 0-6')
  const out = {}
  for (const [day, windows] of Object.entries(parsed)) {
    if (!/^[0-6]$/.test(day)) throw new Error(`BOOKING_HOURS: day key "${day}" is not 0-6`)
    if (!Array.isArray(windows)) throw new Error(`BOOKING_HOURS[${day}] must be a list of [start, end]`)
    out[day] = windows.map((w) => {
      if (!Array.isArray(w) || w.length !== 2 || !HHMM.test(w[0]) || !HHMM.test(w[1]) || w[0] >= w[1]) {
        throw new Error(`BOOKING_HOURS[${day}] has an invalid window ${JSON.stringify(w)}`)
      }
      return [w[0], w[1]]
    })
  }
  return Object.freeze(out)
}

// The wall-clock fields of an instant in a time zone.
const partsCache = new Map()
function formatter(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
  }
  return partsCache.get(tz)
}
export function localParts(ms, tz = BOOKING_TZ) {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second }
}

// Minutes the zone is ahead of UTC at an instant (Pacific: -420 in summer, -480 in winter).
function offsetMinutes(ms, tz) {
  const p = localParts(ms, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

// The instant at which a zone's wall clock reads y-m-d hh:mm. Two passes,
// because the offset used for the guess can differ from the offset at the
// answer when the day crosses a daylight-saving change.
export function zonedToUtc(y, m, d, hh, mm, tz = BOOKING_TZ) {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - offsetMinutes(guess, tz) * 60000
  const second = guess - offsetMinutes(first, tz) * 60000
  return second
}

const pad = (n) => String(n).padStart(2, '0')

// The value the model passes back to book a slot: wall-clock Pacific, 24-hour.
export function slotKey(ms, tz = BOOKING_TZ) {
  const p = localParts(ms, tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`
}

const labelFmt = new Map()
export function slotLabel(ms, tz = BOOKING_TZ) {
  if (!labelFmt.has(tz)) {
    labelFmt.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }))
  }
  return `${labelFmt.get(tz).format(new Date(ms))} PT`
}

// Parse what the model sends back: "2026-09-28 18:00" (Pacific wall clock,
// the form this module hands out) or a full ISO instant. Anything else -> null.
export function parseSlot(input, tz = BOOKING_TZ) {
  const s = String(input || '').trim()
  const wall = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s)
  if (wall) {
    const [, y, m, d, hh, mm] = wall.map(Number)
    if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null
    const ms = zonedToUtc(y, m, d, hh, mm, tz)
    // Reject wall times that do not exist (the spring-forward gap) or that
    // rolled over (e.g. Feb 30): the round trip must reproduce the input.
    return slotKey(ms, tz) === `${wall[1]}-${wall[2]}-${wall[3]} ${wall[4]}:${wall[5]}` ? ms : null
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    const ms = Date.parse(s)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

// Every open slot between (now + notice) and (now + horizon), minus anything
// that overlaps a busy interval. `busy` is a list of { start, end } in ms.
export function computeSlots({
  now, busy = [], hours = DEFAULT_HOURS, tz = BOOKING_TZ,
  slotMinutes = SLOT_MINUTES, minNoticeHours = MIN_NOTICE_HOURS, horizonDays = HORIZON_DAYS,
}) {
  const earliest = now + minNoticeHours * 3600_000
  const latest = now + horizonDays * 86400_000
  const slotMs = slotMinutes * 60000
  const today = localParts(now, tz)
  const out = []
  // Walk CALENDAR dates, not 24-hour steps: a 24h step from a local midnight
  // lands on 23:00 or 01:00 across a DST change and can skip or repeat a day.
  for (let k = 0; k <= horizonDays; k++) {
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + k))
    const y = cal.getUTCFullYear(), m = cal.getUTCMonth() + 1, d = cal.getUTCDate()
    for (const [from, to] of hours[cal.getUTCDay()] || []) {
      const [fh, fm] = from.split(':').map(Number)
      const [th, tm] = to.split(':').map(Number)
      for (let mins = fh * 60 + fm; mins + slotMinutes <= th * 60 + tm; mins += slotMinutes) {
        const start = zonedToUtc(y, m, d, Math.floor(mins / 60), mins % 60, tz)
        const end = start + slotMs
        if (start < earliest || end > latest) continue
        if (busy.some((b) => start < b.end && end > b.start)) continue
        out.push({ start, end })
      }
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

// A short menu for the model: up to `max` slots, spread across days rather
// than the first six of a single evening.
export function spreadAcrossDays(slots, max = MAX_OFFERED, tz = BOOKING_TZ) {
  const byDay = new Map()
  for (const s of slots) {
    const day = slotKey(s.start, tz).slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(s)
  }
  const days = [...byDay.values()]
  const picked = []
  for (let round = 0; picked.length < max && days.some((q) => q.length > round); round++) {
    for (const q of days) {
      if (picked.length >= max) break
      if (q[round]) picked.push(q[round])
    }
  }
  return picked.sort((a, b) => a.start - b.start)
}
