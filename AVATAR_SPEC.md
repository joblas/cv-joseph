# LongCat Video Avatar Feature — Implementation Spec

## Goal

Add a "Video Avatar" mode to cloudyjoe.com where the chatbot responds as a lip-synced video of Joe speaking. Uses LongCat-Video-Avatar-1.5 via the HF Space Gradio API.

## Architecture

```
User types question in chat
  → Existing /api/chat (Anthropic) generates text response
  → New /api/avatar-generate (edge function):
      1. Text → TTS audio (OpenAI TTS, existing OPENAI_API_KEY)
      2. Joe's portrait + TTS audio + prompt → LongCat HF Space Gradio API
      3. Poll for video result (Gradio async pattern)
      4. Return video URL to client
  → Client plays video in chat bubble
```

This is **async video generation** (~30-60s per response), NOT realtime. The existing text + voice chatbot stays for instant interaction. The avatar mode is opt-in — a button toggle in the chat UI.

## Key Technical Details

### HF Space Gradio API (verified working 2026-07-10)

**Space:** `akhaliq/LongCat-Video-Avatar-1.5` (running on ZeroGPU, public API)
**Base URL:** `https://akhaliq-longcat-video-avatar-1-5.hf.space`

**Endpoint:** `/gradio_api/call/generate_avatar` (POST + SSE poll)

**Parameters (7 total, in order):**
1. `image_file` — FileData (portrait image, Joe's face)
2. `audio_file` — FileData (TTS audio of the response)
3. `prompt` — string (description of performance, e.g. "A man speaking naturally to camera, professional lighting, neutral background")
4. `resolution` — string ("480p" or "720p")
5. `seed` — number (random int for reproducibility)
6. `vocal_mode` — string (check Space UI for options, default "Studio Portrait Voice" or similar)
7. `acceleration` — string (distillation mode, use "distill" for faster inference)

**Gradio call pattern (2-step):**
```javascript
// Step 1: Submit job
const submitRes = await fetch(`${BASE}/gradio_api/call/generate_avatar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [imageFileData, audioFileData, prompt, "480p", seed, vocalMode, "distill"]
  })
});
const { event_id } = await submitRes.json();

// Step 2: Poll for result (SSE stream)
const resultRes = await fetch(`${BASE}/gradio_api/call/generate_avatar/${event_id}`);
// Parse SSE: look for data: with the result containing video URL
```

**File upload:** Use `/gradio_api/upload` endpoint first to upload image and audio files, get file paths back, then pass as FileData objects.

### Existing Codebase Structure

- `src/FloatingChat.tsx` — main chat component, has text + voice modes
  - `mode` state: `'text' | 'voice'` — add `'avatar'` mode
  - `sendMessage()` — posts to `/api/chat`, streams SSE response
  - Has session storage, RAG sources, streaming drain animation
- `src/VoiceOrb.tsx` — canvas orb visual for voice mode
- `src/useVoiceMode.ts` — OpenAI Realtime WebSocket voice mode
- `api/chat.js` — edge function, Anthropic SDK + RAG + Langfuse
- `api/voice-token.js` — edge function, rate limiting via Supabase
- `api/_shared/rag.js` — shared RAG utilities
- `api/_shared/prompt.js` — system prompt loader
- `public/foto-avatar.webp` — Joe's portrait (use this as the avatar reference image)
- `vercel.json` — CSP headers + rewrites + crons

### What to Build

#### 1. New API route: `api/avatar-generate.js`

Edge function that:
- Receives: `{ text, sessionId, currentPage }` (the chatbot's text response to turn into video)
- Step 1: Generate TTS audio from text using **Voicebox** (Joe's cloned voice via Chatterbox, running locally on `127.0.0.1:8000`, exposed via Cloudflare tunnel — `VOICEBOX_TUNNEL_URL` env var). POST to `${VOICEBOX_TUNNEL_URL}/api/speak` with `{ text, profile: "joe" }`. Returns a generation ID; poll `${VOICEBOX_TUNNEL_URL}/api/generate/{id}/status` for the audio file URL. **Fallback:** if Voicebox is down, fall back to OpenAI TTS (`tts-1`, `OPENAI_API_KEY`, voice="onyx").
- Step 2: Upload Joe's portrait (`public/foto-avatar.webp`) + TTS audio to HF Space Gradio upload endpoint
- Step 3: Call `/gradio_api/call/generate_avatar` with the 7 params
- Step 4: Poll the SSE result endpoint for the video URL
- Step 5: Return `{ videoUrl, audioUrl }` to client
- Timeout: 120s max (Vercel edge function limit)
- Error handling: if HF Space is down or times out, return `{ error: 'avatar_unavailable' }` and client falls back to text-only response
- Rate limiting: reuse the Supabase rate limit pattern from voice-token.js (MAX_SESSIONS_PER_IP, WINDOW_MS)

**Env vars needed (already have):** `OPENAI_API_KEY`
**New env var:** `LONGCAT_SPACE_URL=https://akhaliq-longcat-video-avatar-1-5.hf.space` (set in Vercel project settings)

#### 2. Extend `FloatingChat.tsx`

Add an "Avatar" mode toggle button (next to the existing Mic/voice button):
- When avatar mode is active and user sends a message:
  1. Show typing indicator while /api/chat streams the text response (existing behavior)
  2. After text response completes, show "Generating video..." loading state
  3. POST to `/api/avatar-generate` with the full text response
  4. On success: replace the text bubble with a `<video>` element playing the generated video
  5. On failure: keep the text response, show a small "avatar unavailable" note
- The video plays inline in the chat bubble, controls visible, autoplay muted
- Cache: store videoUrl in the message object so re-renders don't re-generate

New message type field: `videoUrl?: string` on the Message interface.

#### 3. CSP update in `vercel.json`

Add to `connect-src` in the Content-Security-Policy:
- `https://akhaliq-longcat-video-avatar-1-5.hf.space` (HF Space API)
- `https://*.hf.space` (wildcard in case Space URL changes)
- `https://huggingface.co` (if needed for redirects)

Add to `media-src`:
- `https://*.hf.space` (video files served from HF Space CDN)
- `https://huggingface.co`

#### 4. Avatar reference image

Use existing `public/foto-avatar.webp` as the portrait. If the model needs a specific crop or format, the API route should handle conversion (or just pass as-is and see if it works — the Space accepts PNG/JPG/WebP).

## Constraints

- **No new npm dependencies.** Use native `fetch`, `FormData`, `Response` APIs. The repo already has `@anthropic-ai/sdk`, `openai`, `langfuse`, `@supabase/supabase-js`.
- **Edge runtime.** All API routes use `export const config = { runtime: 'edge' }`.
- **120s timeout.** Vercel edge function max. If LongCat takes longer, the route returns a timeout error and the client shows text fallback.
- **HF Space reliability.** The Space is a free community Space — it can be paused or rate-limited. The feature MUST degrade gracefully to text-only.
- **No GPU on our side.** All generation happens on HF's ZeroGPU. We're just a thin API proxy.
- **Keep it minimal.** Don't over-engineer caching, queuing, or pre-generation. Ship the simple async path first.

## File List (what to create/modify)

| File | Action | Purpose |
|------|--------|---------|
| `api/avatar-generate.js` | CREATE | Edge function: text → TTS → LongCat → video URL |
| `src/FloatingChat.tsx` | MODIFY | Add avatar mode toggle, video playback in chat bubbles |
| `vercel.json` | MODIFY | Update CSP to allow HF Space domains |
| `.env.example` or README | MODIFY | Document `LONGCAT_SPACE_URL` env var |

## Verification

1. `npm run build` passes
2. Dev server: open chat, toggle avatar mode, send a message, see video response (or graceful fallback)
3. Check CSP doesn't block the HF Space requests in browser console
4. Test timeout path: if HF Space is slow, see text fallback after 120s

## Ponytail notes

- Don't build a separate AvatarChat component — extend FloatingChat. The mode toggle is one state variable.
- Don't build a video caching layer — the session storage already caches messages; just store videoUrl on the message object.
- Don't build a queue system — one request at a time per user. If the user sends another message while avatar is generating, abort the previous request (same pattern as existing abortRef).
- The prompt for LongCat can be a static string — "A man speaking naturally to camera, professional lighting, neutral background, looking directly at viewer." Don't make it dynamic per-response.
- Use `480p` resolution for speed. `720p` is too slow for a chat experience.
- Use `distill` acceleration always — it's required for avatar-v1.5 and faster.