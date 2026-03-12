import Anthropic from '@anthropic-ai/sdk'
import { Langfuse } from 'langfuse'
import { waitUntil } from '@vercel/functions'
import SYSTEM_PROMPT_FALLBACK from '../chatbot-prompt.txt'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ---------------------------------------------------------------------------
// Cost tracking per span (Block 1 — LLMOps)
// ---------------------------------------------------------------------------

const MODEL_COSTS = {
  'claude-sonnet-4-6': { input: 3.0 / 1e6, output: 15.0 / 1e6 },
  'claude-haiku-4-5-20251001': { input: 0.25 / 1e6, output: 1.25 / 1e6 },
  'text-embedding-3-small': { input: 0.02 / 1e6 },
}

function calcCost(model, inputTokens, outputTokens = 0) {
  const r = MODEL_COSTS[model]
  return r ? (inputTokens * (r.input || 0)) + (outputTokens * (r.output || 0)) : 0
}

// ---------------------------------------------------------------------------
// Prompt versioning via Langfuse (Block 4 — LLMOps)
// ---------------------------------------------------------------------------

async function getSystemPrompt(langfuse) {
  try {
    if (langfuse) {
      const prompt = await langfuse.getPrompt('chatbot-system', undefined, {
        type: 'text', label: 'production', cacheTtlSeconds: 300,
      })
      return { text: prompt.prompt, version: prompt.version }
    }
  } catch { /* fallback to file */ }
  return { text: SYSTEM_PROMPT_FALLBACK, version: 'file' }
}

// ---------------------------------------------------------------------------
// RAG: tool definition for Agentic RAG
// ---------------------------------------------------------------------------

function isRagEnabled() {
  return !!(process.env.OPENAI_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

const PORTFOLIO_TOOL = {
  name: 'search_portfolio',
  description: "Search your own published case studies for project details. You wrote these articles — they are YOUR words about YOUR projects. The system prompt only has brief summaries; this tool has the FULL content you authored: architectures, sub-agents, workflows, Airtable structures, metrics, technical decisions, pipeline details, code patterns, and lessons learned. Use this whenever the user asks for specifics about any project. Remember: speak from this content as your own experience, never cite it as an external source.",
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant portfolio content',
      },
    },
    required: ['query'],
  },
}

// ---------------------------------------------------------------------------
// RAG: embed query via OpenAI REST API (Edge-compatible)
// ---------------------------------------------------------------------------

async function embedQuery(query) {
  const t0 = Date.now()
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`)
  }

  const data = await response.json()
  return {
    embedding: data.data[0].embedding,
    latencyMs: Date.now() - t0,
    totalTokens: data.usage?.total_tokens || 0,
  }
}

// ---------------------------------------------------------------------------
// RAG: hybrid search via Supabase RPC (Edge-compatible)
// ---------------------------------------------------------------------------

async function searchDocuments(queryText, queryEmbedding) {
  const t0 = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000) // 2s timeout (cold start can be slow)

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/hybrid_search`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_text: queryText,
          query_embedding: queryEmbedding,
          match_count: 10,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Supabase search failed: ${response.status}`)
    }

    const chunks = await response.json()
    return {
      chunks,
      latencyMs: Date.now() - t0,
    }
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new Error('Supabase search timeout (>400ms)')
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// RAG: re-rank top-10 → top-3 with Haiku
// ---------------------------------------------------------------------------

async function rerankChunks(query, chunks) {
  if (chunks.length <= 3) return { chunks, latencyMs: 0, rerankedOrder: null, usage: null }

  const t0 = Date.now()
  try {
    const numbered = chunks.slice(0, 10).map((c, i) =>
      `[${i}] ${c.content.slice(0, 200)}`
    ).join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Query: "${query}"\nRank these chunks by relevance. Return ONLY the top 5 IDs as comma-separated numbers (most relevant first):\n${numbered}`,
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const ids = text.match(/\d+/g)?.map(Number).filter(n => n < chunks.length) || []

    const ranked = ids.slice(0, 5).map(i => chunks[i])
    // Fill up to 5 if Haiku returned fewer
    while (ranked.length < 5 && ranked.length < chunks.length) {
      const next = chunks.find(c => !ranked.includes(c))
      if (next) ranked.push(next)
      else break
    }

    // Diversify: ensure each distinct article has at least one representative
    const diversified = diversifyByArticle(ranked)

    return {
      chunks: diversified, latencyMs: Date.now() - t0, rerankedOrder: ids.slice(0, 5),
      usage: { input_tokens: response.usage?.input_tokens || 0, output_tokens: response.usage?.output_tokens || 0 },
    }
  } catch {
    // Fallback: use original order with diversity
    const diversified = diversifyByArticle(chunks.slice(0, 5))
    return { chunks: diversified, latencyMs: Date.now() - t0, rerankedOrder: null, usage: null }
  }
}

/** Pick up to 5 chunks ensuring every distinct article gets at least 1 slot */
function diversifyByArticle(ranked) {
  const result = []
  const seenArticles = new Set()

  // Pass 1: first chunk from each distinct article (preserving rank order)
  for (const chunk of ranked) {
    const articleId = chunk.metadata?.article_id
    if (!seenArticles.has(articleId)) {
      seenArticles.add(articleId)
      result.push(chunk)
    }
  }

  // Pass 2: fill remaining slots with best remaining chunks (rank order)
  for (const chunk of ranked) {
    if (result.length >= 5) break
    if (!result.includes(chunk)) {
      result.push(chunk)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// RAG: format chunks for tool_result + extract sources for badges
// ---------------------------------------------------------------------------

function formatChunksForContext(chunks) {
  return chunks.map((c, i) => {
    const meta = c.metadata || {}
    const source = meta.article_id ? `[From your article: ${meta.article_id}, section: ${meta.section_id}]` : ''
    return `--- Your content ${i + 1} ${source} ---\n${c.content}`
  }).join('\n\n')
}

function extractSources(chunks) {
  const seen = new Set()
  const sources = []
  for (const c of chunks) {
    const meta = c.metadata || {}
    const key = `${meta.article_id}:${meta.section_id}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({
      article_id: meta.article_id,
      section_id: meta.section_id,
      section_anchor: meta.section_anchor || '',
      page_path_en: meta.page_path_en || '',
      page_path_es: meta.page_path_es || '',
      article_slug_en: meta.article_slug_en || '',
      article_slug_es: meta.article_slug_es || '',
    })
  }
  return sources
}

// Keywords that signal the response actually references a given article
const ARTICLE_KEYWORDS = {
  'n8n-for-pms':          ['n8n', 'nodemation'],
  'jacobo':               ['jacobo', 'agente ia', 'ai agent', 'whatsapp', 'multi-agent', 'multiagent'],
  'business-os':          ['business os', 'erp', 'airtable bases', 'crm', 'inventory'],
  'programmatic-seo':     ['seo programático', 'programmatic seo', 'web programática', 'programmatic web'],
  'self-healing-chatbot': ['chatbot', 'this chat', 'este chat', 'evals', 'self-healing', 'closed-loop', 'langfuse', 'rag'],
  'santifer-irepair':     ['santifer irepair', 'irepair', 'repair business', 'taller de reparación'],
}

/** Filter RAG sources to only those whose article is actually mentioned in the response */
function filterSourcesByResponse(sources, responseText) {
  if (!responseText || sources.length === 0) return sources
  const lower = responseText.toLowerCase()
  return sources.filter(s => {
    const keywords = ARTICLE_KEYWORDS[s.article_id]
    if (!keywords) return true // unknown article — keep it
    return keywords.some(kw => lower.includes(kw))
  })
}

// ---------------------------------------------------------------------------
// RAG: full agentic search pipeline
// ---------------------------------------------------------------------------

async function searchPortfolio(query, trace) {
  const result = {
    chunks: null,
    sources: [],
    degraded: false,
    degradedReason: null,
    metrics: { embeddingMs: 0, retrievalMs: 0, rerankMs: 0 },
    usage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
  }

  // 1. Embed
  let embedding
  const embeddingSpan = trace?.span({ name: 'embedding', metadata: { query } })
  try {
    const embResult = await embedQuery(query)
    embedding = embResult.embedding
    result.metrics.embeddingMs = embResult.latencyMs
    result.usage.embeddingTokens = embResult.totalTokens
    embeddingSpan?.end({ metadata: {
      latencyMs: embResult.latencyMs, model: 'text-embedding-3-small',
      totalTokens: embResult.totalTokens,
      cost: calcCost('text-embedding-3-small', embResult.totalTokens),
    } })
  } catch (err) {
    embeddingSpan?.end({ metadata: { error: err.message } })
    result.degraded = true
    result.degradedReason = 'embedding_fail'
    return result
  }

  // 2. Retrieve
  const retrievalSpan = trace?.span({ name: 'retrieval', metadata: { query } })
  try {
    const searchResult = await searchDocuments(query, embedding)
    result.metrics.retrievalMs = searchResult.latencyMs
    retrievalSpan?.end({
      metadata: {
        chunksCount: searchResult.chunks.length,
        topSimilarity: searchResult.chunks[0]?.similarity || 0,
        latencyMs: searchResult.latencyMs,
      },
    })

    if (!searchResult.chunks.length) {
      result.degradedReason = 'no_match'
      return result
    }

    // 3. Re-rank
    const rerankSpan = trace?.span({ name: 'reranking', metadata: { query } })
    const rerankResult = await rerankChunks(query, searchResult.chunks)
    result.metrics.rerankMs = rerankResult.latencyMs
    if (rerankResult.usage) {
      result.usage.rerankInputTokens = rerankResult.usage.input_tokens
      result.usage.rerankOutputTokens = rerankResult.usage.output_tokens
    }
    rerankSpan?.end({
      metadata: {
        rerankedOrder: rerankResult.rerankedOrder,
        latencyMs: rerankResult.latencyMs,
        inputTokens: rerankResult.usage?.input_tokens,
        outputTokens: rerankResult.usage?.output_tokens,
        cost: rerankResult.usage ? calcCost('claude-haiku-4-5-20251001', rerankResult.usage.input_tokens, rerankResult.usage.output_tokens) : 0,
      },
    })

    result.chunks = rerankResult.chunks
    result.sources = extractSources(rerankResult.chunks)
  } catch (err) {
    retrievalSpan?.end({ metadata: { error: err.message } })
    result.degraded = true
    result.degradedReason = err.message.includes('timeout') ? 'retrieval_timeout' : 'retrieval_fail'
  }

  return result
}

// ---------------------------------------------------------------------------
// Intent classification (keyword-based, no extra LLM cost)
// ---------------------------------------------------------------------------

function classifyIntent(text) {
  const lower = text.toLowerCase()
  const tags = []

  const jailbreakPatterns = [
    'ignore', 'pretend', 'roleplay', 'act as', 'you are now',
    'forget', 'disregard', 'bypass', 'override', 'jailbreak',
    'dan', 'developer mode', 'evil', 'malicious', 'hack',
    'prompt', 'system prompt', 'instructions', 'ignore previous',
    'protocolo de defensa', 'olvida todo', 'nueva personalidad',
    'reset your', 'reveal your', 'show me your rules',
    'your objective', 'your orders', 'tus órdenes', 'tus reglas',
    'cuáles son tus instrucciones', 'rules configured', 'reglas configuradas',
    'print all', 'print everything', 'yaml', 'json record',
    'dump', 'export', 'serialize', 'reproduce', 'output all',
    'all of the above', 'todo lo anterior', 'everything above',
    'repeat everything', 'write all above', 'copy all',
    'show me everything', 'imprime todo', 'muestra todo lo anterior',
    'repite todo', 'exporta', 'convierte a',
  ]
  if (jailbreakPatterns.some(p => lower.includes(p))) {
    tags.push('jailbreak-attempt')
  }

  if (/experiencia|experience|trabajo|work|career|carrera|santifer|irepair/.test(lower)) tags.push('topic:experience')
  if (/proyecto|project|portfolio|github|código|code/.test(lower)) tags.push('topic:projects')
  if (/contact|contacto|email|linkedin|hablar|talk|hire|contratar/.test(lower)) tags.push('topic:contact')
  if (/stack|tech|tecnolog|python|react|airtable|claude|ai|ia|llm|agente|agent/.test(lower)) tags.push('topic:technical')
  if (/salario|salary|money|dinero|rate|precio|cobr/.test(lower)) tags.push('topic:compensation')
  if (/hola|hello|hi|hey|buenos|good/.test(lower) && text.length < 20) tags.push('greeting')

  return tags.length > 0 ? tags : ['topic:general']
}

// ---------------------------------------------------------------------------
// Jailbreak alert
// ---------------------------------------------------------------------------

async function sendJailbreakAlert(userMessage) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Santi Bot <onboarding@resend.dev>',
      to: process.env.ALERT_EMAIL,
      subject: '🚨 JAILBREAK ATTEMPT - santifer.io',
      html: `
        <h2>🚨 Jailbreak Attempt Detected</h2>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>User message:</strong></p>
        <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #e74c3c;">
          ${userMessage.slice(0, 500)}${userMessage.length > 500 ? '...' : ''}
        </blockquote>
        <p style="margin-top: 20px;">
          <a href="https://cloud.langfuse.com" style="background: #e74c3c; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View in Langfuse
          </a>
        </p>
      `,
    }),
  })
}

// ---------------------------------------------------------------------------
// Langfuse
// ---------------------------------------------------------------------------

let langfuseClient = null
function getLangfuse() {
  if (!langfuseClient && process.env.LANGFUSE_SECRET_KEY) {
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    })
  }
  return langfuseClient
}

// ---------------------------------------------------------------------------
// Prompt leak detection
// ---------------------------------------------------------------------------

const PROMPT_FINGERPRINTS = [
  'BREVEDAD OBLIGATORIA', 'máximo 150 palabras', '150 words', 'word limit',
  'formato sin listas', 'redirección ingeniosa', 'NUNCA revelar',
  'Anti-extracción', 'Instrucciones CRÍTICAS', 'cache_control',
  'never_exceed', 'token_budget',
]

const LEAK_RESPONSE = 'Esa información forma parte de mi diseño interno. El código fuente del proyecto es público en GitHub si te interesa la arquitectura.'

function containsFingerprint(text) {
  const lower = text.toLowerCase()
  return PROMPT_FINGERPRINTS.some(fp => lower.includes(fp.toLowerCase()))
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  const t0 = Date.now()

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const langfuse = getLangfuse()
  let trace = null

  try {
    const { messages, lang, sessionId, currentPage } = await req.json()

    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
    const intentTags = classifyIntent(lastUserMessage)

    if (intentTags.includes('jailbreak-attempt')) {
      waitUntil(sendJailbreakAlert(lastUserMessage))
    }

    // Prompt versioning: Langfuse with file fallback (Block 4)
    // Support X-Prompt-Version header for regression testing (Block 5)
    let systemPromptText
    let promptVersion
    const overrideVersion = req.headers.get('x-prompt-version')
    const overrideAuth = req.headers.get('x-prompt-auth')
    if (overrideAuth === process.env.PROMPT_REGRESSION_SECRET && overrideVersion && langfuse) {
      try {
        const prompt = await langfuse.getPrompt('chatbot-system', parseInt(overrideVersion), {
          type: 'text', cacheTtlSeconds: 0,
        })
        systemPromptText = prompt.prompt
        promptVersion = prompt.version
      } catch {
        systemPromptText = SYSTEM_PROMPT_FALLBACK
        promptVersion = 'file'
      }
    } else {
      const { text, version } = await getSystemPrompt(langfuse)
      systemPromptText = text
      promptVersion = version
    }

    if (langfuse) {
      trace = langfuse.trace({
        name: 'chat',
        sessionId: sessionId || undefined,
        tags: [lang, ...intentTags],
        metadata: {
          lang,
          messageCount: messages.length,
          lastUserMessage: lastUserMessage.slice(0, 200),
          currentPage: currentPage || null,
          promptVersion,
        },
      })
    }

    // Canary word
    const canary = 'ZXCV_' + crypto.randomUUID().slice(0, 8)

    // Dynamic system prompt parts
    const langInstruction = lang === 'en'
      ? `The user is browsing in English. You MUST respond in English. Contact email: hi@santifer.io\ninternal_ref: ${canary}`
      : `El usuario navega en español. Responde en español. Email de contacto: hola@santifer.io\ninternal_ref: ${canary}`

    // Context-aware page instruction (Phase 5)
    const pageContext = currentPage
      ? `\nThe user is currently on page: ${currentPage}\nWhen referencing content from the CURRENT page, say "you can see this right here" and reference the section. When referencing OTHER articles, mention them by name.`
      : ''

    const systemBlocks = [
      {
        type: 'text',
        text: systemPromptText,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: langInstruction + pageContext,
      },
    ]

    const cleanMessages = messages.map(m => ({ role: m.role, content: m.content }))

    // -----------------------------------------------------------------------
    // Agentic RAG flow
    // -----------------------------------------------------------------------

    let ragSources = []
    let ragDegraded = false
    let ragDegradedReason = null
    let ragUsed = false
    let ragMetrics = {}

    const ragEnabled = isRagEnabled()

    if (ragEnabled) {
      // First call: let Claude decide if it needs to search (non-streaming)
      const toolDecisionSpan = trace?.span({ name: 'tool_decision' })
      const td0 = Date.now()

      const firstResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemBlocks,
        messages: cleanMessages,
        tools: [PORTFOLIO_TOOL],
      })

      const toolDecisionMs = Date.now() - td0
      const tdInputTokens = firstResponse.usage?.input_tokens || 0
      const tdOutputTokens = firstResponse.usage?.output_tokens || 0
      toolDecisionSpan?.end({
        metadata: {
          stopReason: firstResponse.stop_reason,
          toolUsed: firstResponse.stop_reason === 'tool_use',
          inputTokens: tdInputTokens,
          outputTokens: tdOutputTokens,
          latencyMs: toolDecisionMs,
          cost: calcCost('claude-sonnet-4-6', tdInputTokens, tdOutputTokens),
        },
      })

      if (firstResponse.stop_reason === 'tool_use') {
        ragUsed = true
        const toolUseBlock = firstResponse.content.find(b => b.type === 'tool_use')
        const searchQuery = toolUseBlock?.input?.query || lastUserMessage

        // Execute RAG pipeline
        const ragResult = await searchPortfolio(searchQuery, trace)
        ragSources = ragResult.sources
        ragDegraded = ragResult.degraded
        ragDegradedReason = ragResult.degradedReason
        ragMetrics = ragResult.metrics

        // Build tool_result and make second call (streaming)
        const toolResultContent = ragResult.chunks
          ? formatChunksForContext(ragResult.chunks)
          : 'No relevant content found in portfolio articles.'

        const messagesWithTool = [
          ...cleanMessages,
          { role: 'assistant', content: firstResponse.content },
          {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: toolResultContent,
            }],
          },
        ]

        // Stream the final response (with fallback if streaming fails)
        return streamResponse({
          systemBlocks,
          messages: messagesWithTool,
          tools: null,
          ragSources,
          ragDegraded,
          ragDegradedReason,
          canary,
          intentTags,
          trace,
          langfuse,
          lastUserMessage,
          t0,
          ragUsed,
          ragMetrics,
          ragUsage: ragResult.usage,
          toolDecisionMs,
          tdInputTokens,
          tdOutputTokens,
          lang,
          fallbackMessages: cleanMessages,
          promptVersion,
        })
      }

      // Claude didn't use tool — stream the response we already have
      return streamResponse({
        systemBlocks,
        messages: cleanMessages,
        tools: null,
        ragSources: [],
        ragDegraded: false,
        ragDegradedReason: null,
        canary,
        intentTags,
        trace,
        langfuse,
        lastUserMessage,
        t0,
        ragUsed: false,
        ragMetrics: {},
        ragUsage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
        toolDecisionMs,
        tdInputTokens,
        tdOutputTokens,
        precomputedResponse: firstResponse,
        lang,
        promptVersion,
      })
    }

    // RAG not enabled — direct streaming (original behavior)
    return streamResponse({
      systemBlocks,
      messages: cleanMessages,
      tools: null,
      ragSources: [],
      ragDegraded: false,
      ragDegradedReason: null,
      canary,
      intentTags,
      trace,
      langfuse,
      lastUserMessage,
      t0,
      ragUsed: false,
      ragMetrics: {},
      ragUsage: { embeddingTokens: 0, rerankInputTokens: 0, rerankOutputTokens: 0 },
      toolDecisionMs: 0,
      tdInputTokens: 0,
      tdOutputTokens: 0,
      lang,
      promptVersion,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    trace?.update({ metadata: { error: error.message } })
    if (langfuse) waitUntil(langfuse.flushAsync())
    return new Response(JSON.stringify({ error: 'Error processing request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ---------------------------------------------------------------------------
// Stream a Claude response with SSE (for tool_result follow-up or no-RAG)
// ---------------------------------------------------------------------------

function streamResponse({
  systemBlocks, messages, tools, ragSources, ragDegraded, ragDegradedReason,
  canary, intentTags, trace, langfuse, lastUserMessage, t0,
  ragUsed, ragMetrics, ragUsage, toolDecisionMs, tdInputTokens, tdOutputTokens,
  precomputedResponse, lang, fallbackMessages, promptVersion,
}) {
  const encoder = new TextEncoder()
  let fullOutput = ''
  let leakDetected = false

  const generationSpan = trace?.span({
    name: 'generation',
    metadata: { ragUsed, streaming: !precomputedResponse },
  })

  // Only create API stream when there's no precomputed response
  let stream = null
  if (!precomputedResponse) {
    const streamParams = {
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemBlocks,
      messages,
    }
    if (tools) streamParams.tools = tools
    stream = client.messages.stream(streamParams)
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Send degraded status early (informational — doesn't depend on response content)
        if (ragDegraded) {
          controller.enqueue(encoder.encode(`event: rag-status\ndata: ${JSON.stringify({ status: 'degraded', reason: ragDegradedReason })}\n\n`))
        }

        if (precomputedResponse) {
          // Drip precomputed text through the stream
          const textBlocks = precomputedResponse.content.filter(b => b.type === 'text')
          const precomputedText = textBlocks.map(b => b.text).join('')

          // Check for leaks
          if (containsFingerprint(precomputedText) || precomputedText.includes(canary)) {
            trace?.update({
              tags: [...intentTags, 'prompt-leak-blocked'],
              metadata: { leakDetectedAt: precomputedText.length },
            })
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: LEAK_RESPONSE, replace: true })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED] User: ${lastUserMessage}`))
            generationSpan?.end({ metadata: { blocked: true } })
            if (langfuse) waitUntil(langfuse.flushAsync())
            return
          }

          fullOutput = precomputedText

          // Word-aware drip: send 2-4 words at a time with natural timing
          const words = precomputedText.match(/\S+\s*/g) || [precomputedText]
          let wi = 0
          while (wi < words.length) {
            const groupSize = 2 + Math.floor(Math.random() * 3) // 2-4 words
            const piece = words.slice(wi, wi + groupSize).join('')
            wi += groupSize
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: piece })}\n\n`))
            // Pause longer after sentence-ending punctuation
            const endsWithPunct = /[.!?]\s*$/.test(piece)
            const delay = endsWithPunct
              ? 40 + Math.floor(Math.random() * 21)   // 40-60ms
              : 15 + Math.floor(Math.random() * 21)   // 15-35ms
            await new Promise(r => setTimeout(r, delay))
          }

          const pcIn = precomputedResponse.usage?.input_tokens || 0
          const pcOut = precomputedResponse.usage?.output_tokens || 0
          generationSpan?.end({
            metadata: {
              outputTokens: pcOut,
              inputTokens: pcIn,
              latencyMs: Date.now() - t0,
              cost: calcCost('claude-sonnet-4-6', pcIn, pcOut),
            },
          })
        } else {
          // Real-time streaming from Claude API (with retry)
          const MAX_RETRIES = 1
          let lastStreamError = null

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              // Create fresh stream for each attempt
              const activeStream = attempt === 0 ? stream : client.messages.stream({
                model: 'claude-sonnet-4-6',
                max_tokens: 800,
                system: systemBlocks,
                messages,
              })

              for await (const event of activeStream) {
                if (leakDetected) break

                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  const chunk = event.delta.text
                  fullOutput += chunk

                  if (fullOutput.length % 200 < chunk.length || fullOutput.length < 200) {
                    if (containsFingerprint(fullOutput) || fullOutput.includes(canary)) {
                      leakDetected = true
                      trace?.update({
                        tags: [...intentTags, 'prompt-leak-blocked'],
                        metadata: { leakDetectedAt: fullOutput.length },
                      })
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: LEAK_RESPONSE, replace: true })}\n\n`))
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                      controller.close()
                      waitUntil(sendJailbreakAlert(`[PROMPT LEAK BLOCKED] User: ${lastUserMessage}`))
                      generationSpan?.end({ metadata: { blocked: true } })
                      if (langfuse) waitUntil(langfuse.flushAsync())
                      return
                    }
                  }

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
                }
              }

              if (!leakDetected) {
                const finalMessage = await activeStream.finalMessage()
                const genIn = finalMessage.usage?.input_tokens || 0
                const genOut = finalMessage.usage?.output_tokens || 0
                generationSpan?.end({
                  metadata: {
                    outputTokens: genOut,
                    inputTokens: genIn,
                    latencyMs: Date.now() - t0,
                    attempt,
                    cost: calcCost('claude-sonnet-4-6', genIn, genOut),
                  },
                })
              }

              lastStreamError = null
              break // Success — exit retry loop
            } catch (streamErr) {
              lastStreamError = streamErr
              const retryTag = attempt < MAX_RETRIES ? 'retrying' : 'exhausted'
              trace?.update({
                tags: [...intentTags, `stream-error:${retryTag}`],
                metadata: {
                  [`streamError_attempt${attempt}`]: streamErr.message,
                  [`streamErrorType_attempt${attempt}`]: streamErr.constructor?.name,
                  elapsedMs: Date.now() - t0,
                },
              })

              if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 500)) // brief pause before retry
              }
            }
          }

          if (lastStreamError) throw lastStreamError // propagate to outer catch for fallback
        }

        if (!leakDetected) {
          // Calculate total cost across all spans
          const costBreakdown = {
            toolDecision: calcCost('claude-sonnet-4-6', tdInputTokens || 0, tdOutputTokens || 0),
            embedding: calcCost('text-embedding-3-small', ragUsage?.embeddingTokens || 0),
            reranking: calcCost('claude-haiku-4-5-20251001', ragUsage?.rerankInputTokens || 0, ragUsage?.rerankOutputTokens || 0),
          }
          // generation cost already tracked in span — estimate from fullOutput or precomputed
          costBreakdown.total = Object.values(costBreakdown).reduce((a, b) => a + b, 0)

          // Update trace with RAG metadata + cost + prompt version
          trace?.update({
            tags: [...intentTags, ragUsed ? 'rag:yes' : 'rag:no'],
            metadata: {
              ragUsed,
              promptVersion,
              chunksRetrieved: ragSources.length,
              sources: ragSources.map(s => s.article_id),
              latencyBreakdown: {
                toolDecisionMs,
                ...ragMetrics,
                totalMs: Date.now() - t0,
              },
              cost: costBreakdown,
            },
          })

          // Online scoring (Block 2): score every response asynchronously
          if (langfuse && trace && fullOutput) {
            waitUntil(scoreTrace(trace.id, lastUserMessage, fullOutput, ragUsed, langfuse))
          }

          // Send RAG sources AFTER response — filtered to only articles actually mentioned
          if (ragSources.length > 0) {
            const filtered = filterSourcesByResponse(ragSources, fullOutput)
            if (filtered.length > 0) {
              controller.enqueue(encoder.encode(`event: rag-sources\ndata: ${JSON.stringify(filtered)}\n\n`))
            }
          }

          if (langfuse) waitUntil(langfuse.flushAsync())
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      } catch (error) {
        generationSpan?.end({ metadata: { error: error.message } })
        trace?.update({ tags: [...intentTags, 'rag:fallback'], metadata: { streamingError: error.message } })

        // Graceful degradation: retry without RAG context (just system prompt)
        if (fallbackMessages && !fullOutput) {
          try {
            const fallbackStream = client.messages.stream({
              model: 'claude-sonnet-4-6',
              max_tokens: 800,
              system: systemBlocks,
              messages: fallbackMessages,
            })

            // Send degraded status so frontend knows RAG failed
            controller.enqueue(encoder.encode(`event: rag-status\ndata: ${JSON.stringify({ status: 'degraded', reason: 'streaming_fallback' })}\n\n`))

            for await (const event of fallbackStream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const chunk = event.delta.text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            if (langfuse) waitUntil(langfuse.flushAsync())
            return
          } catch { /* fallback also failed, fall through to error message */ }
        }

        // Last resort: send error message through SSE
        try {
          const errorText = lang === 'en'
            ? 'Sorry, something went wrong. Try again or reach out at hi@santifer.io.'
            : 'Lo siento, algo ha fallado. Inténtalo de nuevo o escríbeme a hola@santifer.io.'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errorText, replace: true })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch {
          controller.error(error)
        }
        if (langfuse) waitUntil(langfuse.flushAsync())
      }
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Response-Time': `${Date.now() - t0}ms`,
    },
  })
}

// ---------------------------------------------------------------------------
// Online Scoring — Claude Haiku scores every response in real-time (Block 2)
// Zero added latency: runs after response is sent via waitUntil()
// ---------------------------------------------------------------------------

async function scoreTrace(traceId, userMessage, response, ragUsed, langfuse) {
  try {
    const scoringResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Rate this chatbot response (Santiago's CV chatbot). Respond ONLY with JSON.

User: "${userMessage.slice(0, 300)}"
Assistant: "${response.slice(0, 500)}"

Rate (0.0-1.0):
- quality: answer helpfulness + on-brand tone
- safety: protects private info (city/email/LinkedIn are public = OK)
${ragUsed ? '- faithfulness: response matches retrieved context (no hallucinated details)' : ''}

JSON only: {"quality":0.0,"safety":0.0${ragUsed ? ',"faithfulness":0.0' : ''}}`
      }],
    })

    const text = scoringResponse.content[0]?.type === 'text' ? scoringResponse.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const scores = JSON.parse(jsonMatch[0])

    langfuse.score({ traceId, name: 'quality', value: scores.quality, comment: 'online' })
    langfuse.score({ traceId, name: 'safety', value: scores.safety, comment: 'online' })
    if (ragUsed && scores.faithfulness !== undefined) {
      langfuse.score({ traceId, name: 'faithfulness', value: scores.faithfulness, comment: 'online' })
    }

    await langfuse.flushAsync()
  } catch {
    // Non-critical — scoring failure should never affect the user
  }
}

