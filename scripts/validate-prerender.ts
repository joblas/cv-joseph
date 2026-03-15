/**
 * Post-prerender validation for SEO invariants.
 *
 * Runs AFTER prerender to validate the static HTML output in dist/.
 * Checks that article pages have proper JSON-LD, meta tags, alt text,
 * and description lengths in the actual HTML that bots will see.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.app.json scripts/validate-prerender.ts
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articleRegistry } from '../src/articles/registry.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warn'
interface Issue { severity: Severity; msg: string }
interface ArticleResult { id: string; slug: string; issues: Issue[] }

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validatePrerenderHtml(id: string, slug: string, lang: 'es' | 'en'): Issue[] {
  const issues: Issue[] = []
  const htmlPath = resolve(dist, slug, 'index.html')

  if (!existsSync(htmlPath)) {
    issues.push({ severity: 'error', msg: `Prerendered HTML not found: dist/${slug}/index.html` })
    return issues
  }

  const html = readFileSync(htmlPath, 'utf-8')

  // 1. JSON-LD: article schema must be present (not just homepage Person/WebSite)
  const jsonLdBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []
  const hasArticleSchema = jsonLdBlocks.some(block =>
    block.includes('"TechArticle"') || block.includes('"Article"') || block.includes('"BlogPosting"')
  )
  if (!hasArticleSchema) {
    issues.push({
      severity: 'error',
      msg: `Article JSON-LD missing in prerender (only homepage schema found). Article pages need TechArticle/Article schema for Google.`,
    })
  }

  // 2. Meta description length
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)
  if (descMatch) {
    const descLen = descMatch[1].length
    if (descLen > 160) {
      issues.push({
        severity: 'warn',
        msg: `Meta description too long: ${descLen} chars (max 160). Google will truncate.`,
      })
    }
    if (descLen < 70) {
      issues.push({
        severity: 'warn',
        msg: `Meta description too short: ${descLen} chars (min ~70 for good CTR).`,
      })
    }
  } else {
    issues.push({ severity: 'error', msg: 'Meta description tag not found in prerender' })
  }

  // 3. Title tag
  const titleMatch = html.match(/<title>([^<]*)<\/title>/)
  if (titleMatch) {
    const titleLen = titleMatch[1].length
    if (titleLen > 65) {
      issues.push({
        severity: 'warn',
        msg: `Title tag long: ${titleLen} chars (ideal ≤60, max ~65).`,
      })
    }
  } else {
    issues.push({ severity: 'error', msg: 'Title tag not found in prerender' })
  }

  // 4. OG article meta tags
  if (!html.includes('article:published_time')) {
    issues.push({ severity: 'warn', msg: 'article:published_time missing in prerender (injected client-side only)' })
  }

  // 5. Canonical tag points to correct URL
  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)
  if (canonicalMatch) {
    if (!canonicalMatch[1].includes(slug)) {
      issues.push({
        severity: 'error',
        msg: `Canonical URL doesn't match slug: ${canonicalMatch[1]} (expected to contain "${slug}")`,
      })
    }
  } else {
    issues.push({ severity: 'error', msg: 'Canonical tag not found in prerender' })
  }

  // 6. Hreflang tags
  if (!html.includes('hreflang="en"') || !html.includes('hreflang="es"')) {
    issues.push({ severity: 'warn', msg: 'Hreflang tags incomplete (need both en + es)' })
  }

  // 7. OG image
  if (!html.includes('og:image')) {
    issues.push({ severity: 'error', msg: 'og:image meta tag not found in prerender' })
  }

  // 8. Images without alt text
  const imgTags = html.match(/<img\s[^>]*>/g) || []
  const noAlt = imgTags.filter(tag => !tag.includes('alt='))
  if (noAlt.length > 0) {
    issues.push({
      severity: 'warn',
      msg: `${noAlt.length} image(s) without alt text in prerender`,
    })
  }

  // 9. H1 tag present and unique
  const h1s = html.match(/<h1[\s>]/g) || []
  if (h1s.length === 0) {
    issues.push({ severity: 'error', msg: 'No H1 tag found in prerender' })
  } else if (h1s.length > 1) {
    issues.push({ severity: 'warn', msg: `Multiple H1 tags found: ${h1s.length} (should be exactly 1)` })
  }

  // 10. article:published_time and article:modified_time present
  if (!html.includes('article:published_time')) {
    issues.push({ severity: 'warn', msg: 'article:published_time missing in prerender' })
  }
  if (!html.includes('article:modified_time')) {
    issues.push({ severity: 'warn', msg: 'article:modified_time missing in prerender' })
  }

  // 11. JSON-LD has image property (Google recommends for Article rich results)
  const articleJsonLd = jsonLdBlocks.find(block =>
    block.includes('"TechArticle"') || block.includes('"Article"')
  )
  if (articleJsonLd && !articleJsonLd.includes('"image"')) {
    issues.push({ severity: 'warn', msg: 'Article JSON-LD missing "image" property (recommended for rich results)' })
  }

  // 12. Title tag length (ideal ≤60)
  if (titleMatch) {
    const titleLen = titleMatch[1].length
    if (titleLen > 70) {
      issues.push({ severity: 'warn', msg: `Title tag very long: ${titleLen} chars (ideal ≤60, Google truncates ~65-70)` })
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Global checks (not per-article)
// ---------------------------------------------------------------------------

function validateGlobalFiles(): Issue[] {
  const issues: Issue[] = []

  // robots.txt: key AI crawlers present
  const robotsPath = resolve(dist, 'robots.txt')
  if (existsSync(robotsPath)) {
    const robots = readFileSync(robotsPath, 'utf-8')
    const requiredCrawlers = ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'OAI-SearchBot']
    for (const crawler of requiredCrawlers) {
      if (!robots.includes(crawler)) {
        issues.push({ severity: 'warn', msg: `robots.txt missing AI crawler: ${crawler}` })
      }
    }
    if (!robots.includes('Sitemap:')) {
      issues.push({ severity: 'warn', msg: 'robots.txt missing Sitemap directive' })
    }
  } else {
    issues.push({ severity: 'error', msg: 'robots.txt not found in dist/' })
  }

  // llms.txt: present and not stale
  const llmsPath = resolve(dist, 'llms.txt')
  if (existsSync(llmsPath)) {
    const llms = readFileSync(llmsPath, 'utf-8')
    // Check that eval count matches (search for the number in registry seoMeta)
    if (llms.includes('56 automated evals') || llms.includes('56 evals')) {
      issues.push({ severity: 'warn', msg: 'llms.txt contains stale eval count "56" — should match current count' })
    }
  } else {
    issues.push({ severity: 'warn', msg: 'llms.txt not found in dist/' })
  }

  // security headers: check vercel.json
  const vercelJsonPath = resolve(dist, '..', 'vercel.json')
  if (existsSync(vercelJsonPath)) {
    const vercelJson = readFileSync(vercelJsonPath, 'utf-8')
    const requiredHeaders = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']
    for (const header of requiredHeaders) {
      if (!vercelJson.includes(header)) {
        issues.push({ severity: 'warn', msg: `vercel.json missing security header: ${header}` })
      }
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\n[validate-prerender] Post-prerender SEO validation\n')

let totalErrors = 0
let totalWarnings = 0

// Per-article checks
for (const article of articleRegistry) {
  if (article.type === 'bridge') continue

  for (const [lang, slug] of Object.entries(article.slugs) as ['es' | 'en', string][]) {
    const issues = validatePrerenderHtml(article.id, slug, lang)
    const errors = issues.filter(i => i.severity === 'error').length
    const warnings = issues.filter(i => i.severity === 'warn').length
    totalErrors += errors
    totalWarnings += warnings

    if (issues.length > 0) {
      const icon = errors > 0 ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m'
      console.log(`${icon} ${article.id} [${lang}] — ${errors} errors, ${warnings} warnings`)
      for (const issue of issues) {
        const prefix = issue.severity === 'error' ? '\x1b[31m  ERR\x1b[0m' : '\x1b[33m  WARN\x1b[0m'
        console.log(`${prefix}  ${issue.msg}`)
      }
    } else {
      console.log(`\x1b[32m✓\x1b[0m ${article.id} [${lang}] — clean`)
    }
  }
}

// Global checks (robots.txt, llms.txt, vercel.json)
const globalIssues = validateGlobalFiles()
const globalErrors = globalIssues.filter(i => i.severity === 'error').length
const globalWarnings = globalIssues.filter(i => i.severity === 'warn').length
totalErrors += globalErrors
totalWarnings += globalWarnings

if (globalIssues.length > 0) {
  const icon = globalErrors > 0 ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m'
  console.log(`\n${icon} Global files — ${globalErrors} errors, ${globalWarnings} warnings`)
  for (const issue of globalIssues) {
    const prefix = issue.severity === 'error' ? '\x1b[31m  ERR\x1b[0m' : '\x1b[33m  WARN\x1b[0m'
    console.log(`${prefix}  ${issue.msg}`)
  }
} else {
  console.log(`\n\x1b[32m✓\x1b[0m Global files — clean`)
}

console.log(`\nArticle pages: ${articleRegistry.filter(a => a.type !== 'bridge').length * 2} | Errors: ${totalErrors} | Warnings: ${totalWarnings}\n`)

if (totalErrors > 0) {
  console.error('\x1b[31m✗ Prerender validation failed. Fix errors before deploying.\x1b[0m\n')
  process.exit(1)
}

console.log('\x1b[32m✓ Prerender validation passed.\x1b[0m\n')
