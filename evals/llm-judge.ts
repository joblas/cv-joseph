/**
 * LLM Judge for subjective evaluations. Defaults to Claude Haiku; override
 * with EVAL_JUDGE_MODEL (and EVAL_JUDGE_MAX_TOKENS for thinking models)
 * when the eval run targets a non-Anthropic endpoint (ANTHROPIC_BASE_URL).
 */

import Anthropic from '@anthropic-ai/sdk'

const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || 'claude-haiku-4-5-20251001'
const parsedJudgeMax = Number(process.env.EVAL_JUDGE_MAX_TOKENS)
const JUDGE_MAX_TOKENS = Number.isFinite(parsedJudgeMax) && parsedJudgeMax > 0 ? Math.floor(parsedJudgeMax) : 200

// Lazy client - initialized when used, not when module is imported
let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic()
  }
  return client
}

export interface JudgeResult {
  pass: boolean
  reason: string
}

/**
 * Uses the judge model to evaluate if a response meets subjective criteria
 */
export async function judgeTone(
  response: string,
  criteria: string
): Promise<JudgeResult> {
  try {
    const result = await getClient().messages.create({
      model: JUDGE_MODEL,
      max_tokens: JUDGE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Evaluate if this chatbot response meets the specified criterion.

Criterion: ${criteria}

Response to evaluate:
"""
${response}
"""

Respond ONLY with valid JSON in this exact format (no markdown):
{"pass": true, "reason": "brief explanation of why it passes"}
or
{"pass": false, "reason": "brief explanation of why it fails"}`,
        },
      ],
    })

    // Thinking models put a `thinking` block before the text block.
    const text = result.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')

    // Clean possible markdown from JSON and take the first flat JSON object
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()
    const jsonMatch = cleanText.match(/\{[^{}]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText)
    return {
      pass: Boolean(parsed.pass),
      reason: String(parsed.reason || 'No reason provided'),
    }
  } catch (error) {
    console.error('LLM Judge error:', error)
    return {
      pass: false,
      reason: `LLM Judge error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
