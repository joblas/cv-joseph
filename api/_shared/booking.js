// ---------------------------------------------------------------------------
// The booking concierge: three chat tools that let a visitor book a 30-minute
// call onto Joe's Google Calendar from joestechsolutions.com.
//
//   check_availability     -> open slots, from Joe's windows minus his free/busy
//   send_verification_code -> emails a 6-digit code to the visitor
//   book_call              -> verifies the code, re-checks the slot, reserves it,
//                             creates the Google event (the visitor gets Google's
//                             invite with the Meet link), and tells Joe
//
// Joe's decisions (2026-09-25): Google Calendar directly (not a self-hosted
// scheduler); a confirmed email before any booking; weekday evenings 6-8pm and
// weekends 10am-2pm Pacific, 30 minutes, 24 hours' notice.
//
// ONE TOOL CALL PER MESSAGE. chat.js makes one tool-decision call and then
// streams the reply with no tools. So a result can never say "now call X" —
// the model could not. Each result says what to TELL the visitor this turn,
// and a failure that needs a different time carries the current open times
// with it. The next visitor message is the next tool call.
//
// ONLY TEXT SURVIVES A TURN. The widget sends back the visible conversation,
// not tool results, so by the time a visitor types their code the slot values
// are gone. book_call therefore accepts the time as the model wrote it to the
// visitor ("Mon, Sep 28, 6:00 PM PT") and matches it against slots that are
// open NOW — anything that is not an open slot is refused.
//
// TRUST NOTHING THE MODEL SENDS. The model relays what a visitor typed, and a
// visitor can type anything. So: the slot must be open in freshly read
// availability; the email must be one THIS session proved it owns (checked in
// SQL, not here); and every limit — codes per email/session/IP, one upcoming
// booking per email, a daily cap, one booking per slot — lives in SQL
// (scripts/supabase-booking.sql) where it holds under concurrency.
//
// FAIL HONESTLY. Every result is text the model repeats to a prospect. A
// failure says it failed and offers email; it never implies a booking that did
// not happen, never offers a time it could not verify, never invents a link.
//
// OFF unless fully configured: the tools are not offered until every secret
// exists, so an unconfigured deploy behaves exactly as before.
// ---------------------------------------------------------------------------

import {
  BOOKING_TZ, HORIZON_DAYS, SLOT_MINUTES, bookingHours, computeSlots, localParts, parseSlot, slotLabel, spreadAcrossDays,
} from './availability.js'
import { freeBusy, googleConfigured, insertEvent } from './google-calendar.js'
import { clientIp } from './leads.js'

export const BOOKING_TOOL_NAMES = ['check_availability', 'send_verification_code', 'book_call']
export const RPC_TIMEOUT_MS = 3000
export const EMAIL_TIMEOUT_MS = 4000

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const supabaseConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// Every piece must exist, and Joe's hours must parse — a broken BOOKING_HOURS
// switches booking OFF rather than guessing at times (availability.js).
export function bookingConfigured(persona) {
  if (!persona?.booking) return false
  if (!googleConfigured() || !process.env.BOOKING_SECRET || !process.env.RESEND_API_KEY || !supabaseConfigured()) return false
  try { bookingHours(); return true } catch (err) {
    console.error('[booking] disabled — BOOKING_HOURS invalid:', err.message)
    return false
  }
}

export function bookingTools(persona) {
  if (!bookingConfigured(persona)) return []
  return [
    {
      name: 'check_availability',
      description: "Look up Joe's open 30-minute call times. Use it whenever a visitor wants to talk to Joe, book a call or a meeting, or asks when he is free.",
      input_schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'send_verification_code',
      description: "Email a 6-digit confirmation code to the visitor. Use it once the visitor has picked one of the offered times AND given you their own email address. Never use it for an address the visitor did not give you.",
      input_schema: {
        type: 'object',
        properties: { email: { type: 'string', description: "The visitor's own email address, exactly as they typed it." } },
        required: ['email'],
      },
    },
    {
      name: 'book_call',
      description: "Book the call once the visitor types the 6-digit code from their email.",
      input_schema: {
        type: 'object',
        properties: {
          slot: { type: 'string', description: 'The time the visitor picked, exactly as it was offered, e.g. "Mon, Sep 28, 6:00 PM PT".' },
          email: { type: 'string', description: 'The same email the code was sent to.' },
          code: { type: 'string', description: 'The 6-digit code the visitor typed.' },
          name: { type: 'string', description: "The visitor's name, if they gave it." },
          topic: { type: 'string', description: 'What they want to talk about, in a few words, if they said.' },
        },
        required: ['slot', 'email', 'code'],
      },
    },
  ]
}

// The runtime note for the text agent. Personas without booking get nothing;
// the JTS persona is told the truth either way, so the static prompt can stay
// neutral about calls.
export function bookingContext(persona, now = Date.now()) {
  if (!persona?.booking) return ''
  const contact = persona.contactEmail
  if (!bookingConfigured(persona)) {
    return `\nCalls: booking a call through this chat is not available right now. If someone wants to talk to Joe, they email ${contact}.`
  }
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(now))
  return `\nToday is ${today}, Pacific time.`
    + '\nCalls: you can book a free 30-minute video call with Joe, right here in this chat. When someone wants to talk to Joe, offer it. The steps, one per message:'
    + ' (1) check_availability, then offer only the times it returns, written exactly as it writes them;'
    + ' (2) once they pick a time and give their email, send_verification_code;'
    + ' (3) when they type the code, book_call with that time, their email and the code.'
    + ` Say a call is booked only after book_call says "Booked". The invite and Google Meet link come from Google by email — never write a link or a time yourself. Email (${contact}) is always an option too.`
}

// The voice agent has no booking tools; it hands booking to the text chat.
export function bookingVoiceNote(persona) {
  if (!bookingConfigured(persona)) return ''
  return '\n\n## Booking a call\n- You cannot book calls by voice. If the caller wants a call with Joe, tell them to end voice mode and type in this same chat — it can book a free 30-minute call on Joe\'s calendar in a minute.'
}

// --- small, bounded I/O -------------------------------------------------------

async function bounded(url, init, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timer) }
}

export async function rpc(name, args) {
  const res = await bounded(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  }, RPC_TIMEOUT_MS)
  if (!res.ok) throw new Error(`rpc ${name} failed: ${res.status}`)
  return res.json()
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Visitors type codes as "123 456" or "123-456"; only the digits count.
export const codeHash = (sessionId, email, code) =>
  hmacHex(process.env.BOOKING_SECRET, `${sessionId}|${email}|${String(code ?? '').replace(/\D/g, '')}`)

// Uniform over 000000-999999: reject the top of the 32-bit range so the modulo
// carries no bias.
export function newCode() {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000
  const buf = new Uint32Array(1)
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

async function sendEmail({ from, to, subject, text, replyTo }) {
  const res = await bounded('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }, EMAIL_TIMEOUT_MS)
  return res.ok
}

const normEmail = (e) => String(e ?? '').trim().toLowerCase()

async function openSlots(now) {
  const busy = await freeBusy(now, now + (HORIZON_DAYS + 1) * 86400_000)
  return computeSlots({ now, busy, hours: bookingHours() })
}

// The time the visitor picked, as the model relays it, resolved against slots
// that are open now. Accepts the offered label ("Mon, Sep 28, 6:00 PM PT"), a
// looser spelling of it ("September 28 at 6pm"), a wall-clock key
// ("2026-09-28 18:00") or an ISO instant. Month + day + time is unambiguous
// inside a 14-day horizon.
export function findSlot(input, slots) {
  const text = String(input ?? '')
  const exact = parseSlot(text)
  if (exact !== null) return slots.find((s) => s.start === exact) || null
  const m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b.*?\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\b/i.exec(text)
  if (!m) return null
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1
  if (!month) return null
  const hour12 = Number(m[3])
  if (hour12 < 1 || hour12 > 12) return null
  const hh = (hour12 % 12) + (m[5].toLowerCase() === 'p' ? 12 : 0)
  const mm = Number(m[4] || 0)
  const day = Number(m[2])
  return slots.find((s) => {
    const p = localParts(s.start)
    return p.m === month && p.d === day && p.hh === hh && p.mm === mm
  }) || null
}

function offerTimes(slots, lead) {
  const menu = spreadAcrossDays(slots)
  if (!menu.length) return null
  return [
    `${lead} Offer only these open ${SLOT_MINUTES}-minute times (Pacific), written exactly like this:`,
    ...menu.map((s) => `- ${slotLabel(s.start)}`),
  ].join('\n')
}

// --- the tools --------------------------------------------------------------------

export async function runBookingTool(name, input = {}, { sessionId, req, persona, now = Date.now() } = {}) {
  const contact = persona?.contactEmail || 'joe@joestechsolutions.com'
  const orEmail = `offer email instead: ${contact}`
  if (!bookingConfigured(persona)) return `Tell the visitor booking isn't available right now, and ${orEmail}.`
  // The session scopes every code; the widget's id is ~25 characters.
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 100) {
    return `Tell the visitor booking needs the chat to be reloaded first, or ${orEmail}.`
  }
  input = input && typeof input === 'object' ? input : {}

  try {
    if (name === 'check_availability') {
      let slots
      try { slots = await openSlots(now) } catch (err) {
        console.error('[booking] availability failed:', err.message)
        return `Joe's calendar can't be read right now. Do NOT offer or guess any times. Tell the visitor, and ${orEmail}.`
      }
      const offer = offerTimes(slots, 'Joe has open call times.')
      return offer
        ? `${offer}\nThen ask which works, plus their name and email — a 6-digit code goes to that email to confirm it's them.`
        : `Joe has no open call times in the next ${HORIZON_DAYS} days. Tell the visitor, and ${orEmail}.`
    }

    if (name === 'send_verification_code') {
      const email = normEmail(input.email)
      if (!EMAIL.test(email)) return "That email looks incomplete. Ask the visitor to type it again."
      const code = newCode()
      const status = await rpc('booking_issue_code', {
        p_session: sessionId, p_email: email, p_code_hash: await codeHash(sessionId, email, code), p_ip: req ? clientIp(req) : null,
      })
      if (status !== 'ok') {
        return String(status).startsWith('rate_limited')
          ? `Too many codes have been requested in the last hour, so no code was sent. Tell the visitor, and ${orEmail}.`
          : `No code could be sent right now. Tell the visitor, and ${orEmail}.`
      }
      const sent = await sendEmail({
        from: persona.booking.from,
        to: email,
        replyTo: contact,
        subject: `Your code to book a call with Joe: ${code}`,
        text: `Your code to confirm a call with Joe's Tech Solutions is ${code}\n\nType it into the chat on joestechsolutions.com. It expires in 10 minutes.\n\nIf you didn't ask to book a call, ignore this email.`,
      }).catch(() => false)
      if (!sent) return `The code email didn't go out. Tell the visitor, ask them to double-check the address, or ${orEmail}.`
      return `A 6-digit code was just emailed to ${email} (it expires in 10 minutes). Tell the visitor to check their inbox and type the code here.`
    }

    if (name === 'book_call') {
      const email = normEmail(input.email)
      // Re-read availability NOW: the slot must be open, not merely offered.
      let slots
      try { slots = await openSlots(now) } catch (err) {
        console.error('[booking] availability failed at booking time:', err.message)
        return `Joe's calendar can't be read right now, so the call was NOT booked. Tell the visitor, and ${orEmail}.`
      }
      const slot = findSlot(input.slot, slots)
      if (!slot) {
        return offerTimes(slots, "That time isn't open, so nothing was booked. Tell the visitor and ask them to pick again.")
          || `That time isn't open and Joe has no other open times in the next ${HORIZON_DAYS} days. Nothing was booked. Tell the visitor, and ${orEmail}.`
      }

      const verified = await rpc('booking_check_code', {
        p_session: sessionId, p_email: email, p_code_hash: await codeHash(sessionId, email, input.code),
      })
      if (verified !== 'ok') {
        return {
          mismatch: "That code doesn't match, so nothing was booked. Ask the visitor to check the email and type the code again.",
          expired: 'That code has expired, so nothing was booked. Ask the visitor to confirm their email so a fresh code can be sent.',
          too_many_attempts: 'Too many wrong codes were tried, so nothing was booked. Ask the visitor to confirm their email so a fresh code can be sent.',
          no_code: 'No code has been sent to that email in this chat, so nothing was booked. Ask the visitor to confirm their email so a code can be sent.',
        }[verified] || `The code couldn't be checked right now, so the call was NOT booked. Tell the visitor, and ${orEmail}.`
      }

      const visitorName = String(input.name ?? '').trim().slice(0, 80)
      const topic = String(input.topic ?? '').trim().slice(0, 500)
      const reserved = await rpc('booking_reserve', {
        p_session: sessionId, p_email: email, p_name: visitorName || null, p_topic: topic || null,
        p_start: new Date(slot.start).toISOString(), p_end: new Date(slot.end).toISOString(),
      })
      if (typeof reserved !== 'string' || !reserved.startsWith('ok:')) {
        if (reserved === 'slot_taken') {
          return offerTimes(slots.filter((s) => s.start !== slot.start), 'Someone else just booked that time, so nothing was booked. Tell the visitor and ask them to pick again.')
            || `Someone else just booked that time and Joe has no other open times. Nothing was booked. Tell the visitor, and ${orEmail}.`
        }
        return {
          already_booked: `This email already has an upcoming call with Joe, so no second one was booked. Tell the visitor, and for anything else ${orEmail}.`,
          daily_cap: `Joe's calendar isn't taking more bookings today, so nothing was booked. Tell the visitor, and ${orEmail}.`,
          not_verified: 'That email is not confirmed in this chat, so nothing was booked. Ask the visitor to confirm their email so a code can be sent.',
        }[reserved] || `The call couldn't be booked right now. Tell the visitor, and ${orEmail}.`
      }
      const bookingId = reserved.slice(3)
      const who = visitorName || email

      let event
      try {
        event = await insertEvent({
          startMs: slot.start, endMs: slot.end,
          summary: `Call with ${who} — Joe's Tech Solutions`,
          description: `Booked through the chat on joestechsolutions.com.\n\nWith: ${visitorName || '(no name given)'} <${email}>\nAbout: ${topic || '(not given)'}`,
          attendee: { email, name: visitorName || undefined },
          requestId: bookingId,
        })
      } catch (err) {
        console.error('[booking] calendar insert failed:', err.message)
        // Release the slot so a booking that does not exist does not hold it.
        await rpc('booking_finalize', { p_id: bookingId, p_event_id: null, p_status: 'failed' })
          .catch((e) => console.error('[booking] release failed:', e.message))
        return `The call could NOT be added to Joe's calendar, so nothing was booked. Say so plainly, and ${orEmail}.`
      }
      await rpc('booking_finalize', { p_id: bookingId, p_event_id: event.id, p_status: 'confirmed' })
        .catch((err) => console.error('[booking] finalize failed after a successful insert:', err.message))

      // Best effort: Joe hears about it even if Google's own notice lags.
      if (process.env.ALERT_EMAIL) {
        await sendEmail({
          from: persona.booking.from,
          to: process.env.ALERT_EMAIL,
          replyTo: email,
          subject: `Call booked: ${slotLabel(slot.start)} — ${who}`,
          text: `${visitorName || '(no name)'} <${email}> booked ${slotLabel(slot.start)} (${SLOT_MINUTES} min) through the site chat.\nAbout: ${topic || '(not given)'}\n\nIt is on your calendar with a Meet link.`,
        }).catch((err) => console.error('[booking] owner notice failed:', err.message))
      }
      return `Booked: ${slotLabel(slot.start)}, ${SLOT_MINUTES} minutes, for ${email}. Tell the visitor it's booked and that Google Calendar is emailing them the invite with the Google Meet link. Do not write a link yourself.`
    }

    return `Tell the visitor that couldn't be done, and ${orEmail}.`
  } catch (err) {
    console.error(`[booking] ${name} failed:`, err.message)
    return `That couldn't be completed right now, and nothing was booked. Tell the visitor, and ${orEmail}.`
  }
}
