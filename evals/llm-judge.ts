/**
 * LLM Judge using Claude Haiku for subjective evaluations
 */

import Anthropic from '@anthropic-ai/sdk'

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
 * Uses Claude Haiku to evaluate if a response meets subjective criteria
 */
export async function judgeTone(
  response: string,
  criteria: string
): Promise<JudgeResult> {
  try {
    const result = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
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
o
{"pass": false, "reason": "brief explanation of why it fails"}`,
        },
      ],
    })

    const text =
      result.content[0].type === 'text' ? result.content[0].text : ''

    // Clean possible markdown from JSON
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()

    const parsed = JSON.parse(cleanText)
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
