/**
 * Deterministic assertion functions for evals
 */

export interface Assertion {
  type: string
  value?: string | number
  values?: string[]
  expected?: string
  pattern?: string
  flags?: string
  criteria?: string
}

export interface AssertionResult {
  passed: boolean
  assertion: Assertion
  reason?: string
}

/**
 * Verifies that the response contains exact text (case insensitive)
 */
export function assertContains(response: string, value: string): boolean {
  return response.toLowerCase().includes(value.toLowerCase())
}

/**
 * Verifies that the response contains at least one of the values (case insensitive)
 */
export function assertContainsAny(response: string, values: string[]): boolean {
  return values.some((v) => response.toLowerCase().includes(v.toLowerCase()))
}

/**
 * Verifies that the response does NOT contain text (case insensitive)
 */
export function assertNotContains(response: string, value: string): boolean {
  return !response.toLowerCase().includes(value.toLowerCase())
}

/**
 * Verifies that the response has at most N words
 */
export function assertMaxWords(response: string, maxWords: number): boolean {
  const wordCount = response.trim().split(/\s+/).length
  return wordCount <= maxWords
}

/**
 * Verifies that the response has at least N words
 */
export function assertMinWords(response: string, minWords: number): boolean {
  const wordCount = response.trim().split(/\s+/).length
  return wordCount >= minWords
}

/**
 * Verifies that the response matches a regex pattern
 */
export function assertRegex(
  response: string,
  pattern: string,
  flags: string = ''
): boolean {
  try {
    const regex = new RegExp(pattern, flags)
    return regex.test(response)
  } catch {
    console.error(`Invalid regex pattern: ${pattern}`)
    return false
  }
}

/**
 * Detects the language of the response (simple heuristic)
 * Looks for common words in Spanish vs English
 */
export function assertLanguage(response: string, expected: 'es' | 'en'): boolean {
  const spanishWords = [
    'el',
    'la',
    'los',
    'las',
    'de',
    'en',
    'que',
    'es',
    'un',
    'una',
    'mi',
    'con',
    'para',
    'por',
    'del',
    'al',
    'como',
    'más',
    'pero',
    'su',
    'sus',
    'este',
    'esta',
    'estos',
    'estas',
    'he',
    'ha',
    'años',
  ]
  const englishWords = [
    'the',
    'is',
    'are',
    'was',
    'were',
    'have',
    'has',
    'had',
    'my',
    'your',
    'with',
    'for',
    'and',
    'but',
    'or',
    'from',
    'this',
    'that',
    'these',
    "i'm",
    "i've",
    'years',
  ]

  const words = response.toLowerCase().split(/\s+/)

  let spanishCount = 0
  let englishCount = 0

  for (const word of words) {
    if (spanishWords.includes(word)) spanishCount++
    if (englishWords.includes(word)) englishCount++
  }

  if (expected === 'es') {
    return spanishCount > englishCount
  } else {
    return englishCount > spanishCount
  }
}

/**
 * Executes an assertion and returns the result
 */
export function runAssertion(
  response: string,
  assertion: Assertion,
  ragSources?: Array<{ article_id: string; section_id: string }>
): AssertionResult {
  let passed = false
  let reason = ''

  switch (assertion.type) {
    case 'contains':
      passed = assertContains(response, assertion.value as string)
      reason = passed
        ? `Contains "${assertion.value}"`
        : `Missing "${assertion.value}"`
      break

    case 'contains_any':
      passed = assertContainsAny(response, assertion.values as string[])
      reason = passed
        ? `Contains one of: ${assertion.values?.join(', ')}`
        : `Missing all of: ${assertion.values?.join(', ')}`
      break

    case 'not_contains':
      passed = assertNotContains(response, assertion.value as string)
      reason = passed
        ? `Does not contain "${assertion.value}"`
        : `Unexpectedly contains "${assertion.value}"`
      break

    case 'max_words':
      const wordCount = response.trim().split(/\s+/).length
      passed = assertMaxWords(response, assertion.value as number)
      reason = passed
        ? `Word count ${wordCount} <= ${assertion.value}`
        : `Word count ${wordCount} exceeds max ${assertion.value}`
      break

    case 'min_words':
      const minWordCount = response.trim().split(/\s+/).length
      passed = assertMinWords(response, assertion.value as number)
      reason = passed
        ? `Word count ${minWordCount} >= ${assertion.value}`
        : `Word count ${minWordCount} below min ${assertion.value}`
      break

    case 'regex':
      passed = assertRegex(
        response,
        assertion.pattern as string,
        assertion.flags
      )
      reason = passed
        ? `Matches pattern /${assertion.pattern}/`
        : `Does not match pattern /${assertion.pattern}/`
      break

    case 'language':
      passed = assertLanguage(response, assertion.expected as 'es' | 'en')
      reason = passed
        ? `Language detected as ${assertion.expected}`
        : `Language is not ${assertion.expected}`
      break

    case 'rag_used':
      passed = (ragSources?.length ?? 0) > 0
      reason = passed
        ? `RAG was used (${ragSources!.length} sources)`
        : 'RAG was NOT used (no sources returned)'
      break

    case 'rag_not_used':
      passed = (ragSources?.length ?? 0) === 0
      reason = passed
        ? 'RAG was not used (as expected)'
        : `RAG was unexpectedly used (sources: ${ragSources?.map(s => s.article_id).join(', ')})`
      break

    case 'source_includes':
      passed = ragSources?.some(s => s.article_id === assertion.value) ?? false
      reason = passed
        ? `Sources include "${assertion.value}"`
        : `Sources do not include "${assertion.value}" (got: ${ragSources?.map(s => s.article_id).join(', ') || 'none'})`
      break

    case 'source_not_includes':
      passed = !ragSources?.some(s => s.article_id === assertion.value) ?? true
      reason = passed
        ? `Sources do not include "${assertion.value}" (correct)`
        : `Sources unexpectedly include "${assertion.value}"`
      break

    case 'llm_judge':
      // LLM judge is handled in llm-judge.ts
      passed = true // Placeholder, gets overwritten
      reason = 'LLM judge evaluation pending'
      break

    default:
      reason = `Unknown assertion type: ${assertion.type}`
  }

  return { passed, assertion, reason }
}
