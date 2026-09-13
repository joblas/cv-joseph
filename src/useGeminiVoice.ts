/**
 * Voice mode on Google's Gemini Live API (real-time speech ↔ speech).
 *
 * Same surface as useVoiceMode (OpenAI Realtime) so FloatingChat can pick a
 * provider at runtime. The server (/api/voice-token) mints a single-use
 * ephemeral token with the model, persona and search_portfolio tool locked
 * in; the browser only ever holds that token.
 *
 * Wire protocol (BidiGenerateContentConstrained, v1alpha):
 *   → { setup: { model } }                      ← { setupComplete }   (then history + audio)
 *   → { clientContent: { turns, turnComplete } }  (chat history)
 *   → { realtimeInput: { audio: { data, mimeType: 'audio/pcm;rate=16000' } } }
 *   ← { serverContent: { modelTurn: { parts: [{ inlineData }] }, inputTranscription,
 *                        outputTranscription, interrupted, turnComplete } }
 *   ← { toolCall: { functionCalls } }   → { toolResponse: { functionResponses } }
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceStatus, RagSource } from './useVoiceMode';
import { SESSION_TIMEOUT_S } from './useVoiceMode';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
}
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length & ~1; // PCM16: ignore a trailing odd byte
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function makeAudioContext(options?: AudioContextOptions): AudioContext {
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  return new Ctor(options);
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function rms(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 3);
}

export function useGeminiVoice() {
  const isSupported =
    typeof window !== 'undefined' &&
    'WebSocket' in window &&
    !!navigator.mediaDevices?.getUserMedia &&
    ('AudioContext' in window || 'webkitAudioContext' in window);

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_TIMEOUT_S);
  const [isSearching, setIsSearching] = useState(false);
  const [voiceSources, setVoiceSources] = useState<RagSource[]>([]);

  const activeRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inAnalyserRef = useRef<AnalyserNode | null>(null);
  const outAnalyserRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const playingRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const timerRef = useRef<number | null>(null);
  const listenTimerRef = useRef<number | null>(null);
  const traceIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef(0);
  const sessionIdRef = useRef('');
  const langRef = useRef('en');
  const currentPageRef = useRef<string | undefined>(undefined);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const userBufRef = useRef('');
  const assistantBufRef = useRef('');
  const historyRef = useRef<Message[]>([]);
  const captureRef = useRef<{ ctx: AudioContext; source: MediaStreamAudioSourceNode } | null>(null);
  const cancelledCallsRef = useRef<Set<string>>(new Set());

  const commitTranscript = useCallback(() => {
    const next = [...transcriptRef.current];
    if (userBufRef.current.trim()) next.push({ role: 'user', text: userBufRef.current.trim() });
    if (assistantBufRef.current.trim()) next.push({ role: 'assistant', text: assistantBufRef.current.trim() });
    userBufRef.current = '';
    assistantBufRef.current = '';
    transcriptRef.current = next;
    setTranscript(next);
  }, []);

  const sendTrace = useCallback(async () => {
    if (!traceIdRef.current || transcriptRef.current.length === 0) return;
    try {
      await fetch('/api/voice-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId: traceIdRef.current,
          sessionId: sessionIdRef.current,
          transcript: transcriptRef.current,
          durationMs: Date.now() - sessionStartRef.current,
          lang: langRef.current,
        }),
      });
    } catch {
      // non-critical
    }
  }, []);

  const stopPlayback = useCallback(() => {
    for (const src of playingRef.current) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    playingRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (listenTimerRef.current) { clearTimeout(listenTimerRef.current); listenTimerRef.current = null; }
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    stopPlayback();
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playbackCtxRef.current = null;
    inAnalyserRef.current = null;
    outAnalyserRef.current = null;
    captureRef.current = null;
    cancelledCallsRef.current = new Set();
    setIsSearching(false);
  }, [stopPlayback]);

  const stop = useCallback((): TranscriptEntry[] => {
    commitTranscript();
    void sendTrace();
    cleanup();
    setStatus('idle');
    return transcriptRef.current;
  }, [cleanup, commitTranscript, sendTrace]);

  const fail = useCallback((code: string) => {
    cleanup();
    setError(code);
    setStatus('error');
  }, [cleanup]);

  // Schedule a PCM16 24 kHz chunk gap-free after the previous one
  const playChunk = useCallback((b64: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;
    const int16 = base64ToInt16(b64);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_RATE);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(outAnalyserRef.current || ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    playingRef.current.add(source);
    source.onended = () => { playingRef.current.delete(source); };
  }, []);

  // Back to 'listening' once the scheduled audio has drained
  const scheduleListening = useCallback(() => {
    const ctx = playbackCtxRef.current;
    const waitMs = ctx ? Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000) + 150 : 0;
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    listenTimerRef.current = window.setTimeout(() => {
      if (activeRef.current) setStatus('listening');
    }, waitMs);
  }, []);

  const handleToolCall = useCallback(async (ws: WebSocket, calls: Array<{ id: string; name: string; args?: { query?: string } }>) => {
    setStatus('thinking');
    setIsSearching(true);
    const responses = [];
    for (const call of calls) {
      if (cancelledCallsRef.current.has(call.id)) continue;
      let result = 'Search temporarily unavailable — answer from your general knowledge.';
      if (call.name === 'search_portfolio') {
        try {
          const res = await fetch('/api/rag-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: call.args?.query || '', traceId: traceIdRef.current, currentPage: currentPageRef.current }),
          });
          const data = await res.json();
          if (data.sources?.length) setVoiceSources(data.sources);
          result = data.context || 'No relevant content found.';
        } catch {
          // keep the fallback text
        }
      }
      responses.push({ id: call.id, name: call.name, response: { result } });
    }
    setIsSearching(false);
    if (responses.length && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
  }, []);

  const startCapture = useCallback((ctx: AudioContext, source: MediaStreamAudioSourceNode, ws: WebSocket) => {
    const ratio = ctx.sampleRate / INPUT_RATE;
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    const silent = ctx.createGain();
    silent.gain.value = 0;
    source.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);
    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const outLen = Math.floor(input.length / ratio);
      const pcm = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i * ratio;
        const i0 = Math.floor(srcIdx);
        const i1 = Math.min(i0 + 1, input.length - 1);
        const frac = srcIdx - i0;
        const s = Math.max(-1, Math.min(1, input[i0] * (1 - frac) + input[i1] * frac));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: int16ToBase64(pcm), mimeType: `audio/pcm;rate=${INPUT_RATE}` } } }));
    };
  }, []);

  const handleServerMessage = useCallback((msg: Record<string, unknown>, ws: WebSocket) => {
    if (msg.setupComplete) {
      // Only now may we send anything else: prior chat turns, then live audio
      const turns = historyRef.current
        .filter((m) => m.content && m.content.trim())
        .slice(-10)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
      if (turns.length && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ clientContent: { turns, turnComplete: false } }));
      }
      const cap = captureRef.current;
      if (cap) startCapture(cap.ctx, cap.source, ws);
      setStatus('listening');
      return;
    }
    if (msg.toolCallCancellation) {
      // The user spoke over the model during a search; drop those calls
      const ids = (msg.toolCallCancellation as { ids?: string[] }).ids || [];
      for (const id of ids) cancelledCallsRef.current.add(id);
      setIsSearching(false);
      return;
    }
    if (msg.toolCall) {
      const calls = (msg.toolCall as { functionCalls?: Array<{ id: string; name: string; args?: { query?: string } }> }).functionCalls || [];
      void handleToolCall(ws, calls);
      return;
    }
    if (msg.goAway) {
      // Advance notice from the server: end cleanly (transcript + trace kept)
      stop();
      return;
    }
    const sc = msg.serverContent as {
      modelTurn?: { parts?: Array<{ inlineData?: { data: string } }> };
      inputTranscription?: { text?: string };
      outputTranscription?: { text?: string };
      interrupted?: boolean;
      turnComplete?: boolean;
    } | undefined;
    if (!sc) return;
    if (sc.interrupted) {
      // The user spoke over the model: drop queued audio and listen
      stopPlayback();
      commitTranscript();
      setStatus('listening');
      return;
    }
    if (sc.inputTranscription?.text) userBufRef.current += sc.inputTranscription.text;
    if (sc.outputTranscription?.text) assistantBufRef.current += sc.outputTranscription.text;
    for (const part of sc.modelTurn?.parts || []) {
      if (part.inlineData?.data) {
        setStatus('speaking');
        playChunk(part.inlineData.data);
      }
    }
    if (sc.turnComplete) {
      commitTranscript();
      scheduleListening();
    }
  }, [commitTranscript, handleToolCall, playChunk, scheduleListening, startCapture, stop, stopPlayback]);


  const start = useCallback(async (history: Message[], lang: string, sessionId: string, currentPage?: string) => {
    if (!isSupported) { fail('unsupported'); return; }
    setError(null);
    setVoiceSources([]);
    setTranscript([]);
    transcriptRef.current = [];
    userBufRef.current = '';
    assistantBufRef.current = '';
    langRef.current = lang;
    sessionIdRef.current = sessionId;
    currentPageRef.current = currentPage;
    sessionStartRef.current = Date.now();
    activeRef.current = true;
    setStatus('connecting');
    setRemainingSeconds(SESSION_TIMEOUT_S);

    try {
      // 1. Microphone first — a slow or denied permission prompt must not burn
      //    a single-use token (and one of the daily sessions)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        fail('micDenied');
        return;
      }
      if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      // 2. Ephemeral token (persona + tool locked server-side)
      const tokenRes = await fetch('/api/voice-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, sessionId }),
      });
      if (!tokenRes.ok) {
        if (tokenRes.status === 429) { fail('rateLimited'); return; }
        if (tokenRes.status === 503) { fail('unavailable'); return; }
        fail('connection');
        return;
      }
      const { token, model, wsUrl, traceId } = await tokenRes.json();
      traceIdRef.current = traceId || null;
      if (!token || !wsUrl || !model) { fail('connection'); return; }
      if (!activeRef.current) return;

      // 3. Audio graph: capture at the device rate (resampled to 16 kHz), playback at 24 kHz
      const captureCtx = makeAudioContext();
      captureCtxRef.current = captureCtx;
      const source = captureCtx.createMediaStreamSource(stream);
      const inAnalyser = captureCtx.createAnalyser();
      inAnalyser.fftSize = 512;
      source.connect(inAnalyser);
      inAnalyserRef.current = inAnalyser;
      captureRef.current = { ctx: captureCtx, source };
      const playbackCtx = makeAudioContext({ sampleRate: OUTPUT_RATE });
      playbackCtxRef.current = playbackCtx;
      const outAnalyser = playbackCtx.createAnalyser();
      outAnalyser.fftSize = 512;
      outAnalyser.connect(playbackCtx.destination);
      outAnalyserRef.current = outAnalyser;
      await Promise.all([captureCtx.resume(), playbackCtx.resume()]);

      // 4. Live session — setup only; history and audio wait for setupComplete
      historyRef.current = history;
      const ws = new WebSocket(`${wsUrl}?access_token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ setup: { model } })); };
      ws.onmessage = async (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
        try {
          handleServerMessage(JSON.parse(raw) as Record<string, unknown>, ws);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => { if (activeRef.current) fail('connection'); };
      ws.onclose = (e) => {
        if (!activeRef.current) return;
        console.warn('[GeminiVoice] socket closed', e.code, e.reason);
        fail('connection');
      };

      // 5. Session cap
      timerRef.current = window.setInterval(() => {
        setRemainingSeconds((s) => {
          if (s <= 1) { stop(); return 0; }
          return s - 1;
        });
      }, 1000);
    } catch {
      fail('connection');
    }
  }, [fail, handleServerMessage, isSupported, stop]);

  // Transcript reaches Langfuse even if the tab closes mid-session
  useEffect(() => {
    const beacon = () => {
      if (!traceIdRef.current || transcriptRef.current.length === 0) return;
      const blob = new Blob([JSON.stringify({
        traceId: traceIdRef.current,
        sessionId: sessionIdRef.current,
        transcript: transcriptRef.current,
        durationMs: Date.now() - sessionStartRef.current,
        lang: langRef.current,
      })], { type: 'application/json' });
      navigator.sendBeacon('/api/voice-trace', blob);
    };
    window.addEventListener('beforeunload', beacon);
    return () => window.removeEventListener('beforeunload', beacon);
  }, []);

  const cleanupRef = useRef(cleanup);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);
  useEffect(() => () => { cleanupRef.current(); }, []);

  return {
    state: { status, transcript, error, remainingSeconds },
    getInputLevel: () => rms(inAnalyserRef.current),
    getOutputLevel: () => rms(outAnalyserRef.current),
    start,
    stop,
    isSupported,
    isSearching,
    voiceSources,
  };
}
