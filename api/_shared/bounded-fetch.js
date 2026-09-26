// fetch with a deadline that covers the WHOLE response, body included.
//
// The booking path used to clear its timer as soon as headers arrived, which
// left every res.json() after it untimed. Review of #30 showed why that
// matters: a token-exchange body that stalls ~50s lets reconcile mark the
// booking failed, and then the event is created anyway — "Booked" on a row
// that no longer holds the slot. So the body is read inside the deadline and
// handed back as an ordinary, already-buffered Response.
const NULL_BODY = new Set([204, 205, 304])

export async function boundedFetch(url, init, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const body = await res.text()
    // The body is now decoded text: the original encoding and length headers
    // describe bytes that no longer exist, so they must not travel with it.
    const headers = new Headers(res.headers)
    headers.delete('content-encoding')
    headers.delete('content-length')
    return new Response(NULL_BODY.has(res.status) ? null : body, {
      status: res.status, statusText: res.statusText, headers,
    })
  } finally {
    clearTimeout(timer)
  }
}
