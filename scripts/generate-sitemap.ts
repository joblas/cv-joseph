/**
 * Auto-generates sitemap.xml from the article registry.
 *
 * Runs as part of the build pipeline (after vite build, before prerender).
 * Ensures every registered article has a proper <url> entry.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.app.json scripts/generate-sitemap.ts
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articleRegistry } from '../src/articles/registry.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, '..', 'dist')

const today = new Date().toISOString().slice(0, 10)

const base = 'https://cv-joseph.vercel.app'

interface SitemapUrl {
  loc: string
  lastmod: string
  priority: string
}

function urlBlock(u: SitemapUrl): string {
  return `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`
}

const urls: SitemapUrl[] = []

// Home
urls.push({
  loc: `${base}/`,
  lastmod: today,
  priority: '1.0',
})

// About
urls.push({
  loc: `${base}/about`,
  lastmod: today,
  priority: '0.9',
})

// Articles from registry
for (const article of articleRegistry) {
  const articleLastmod = article.seoMeta?.dateModified ?? today

  urls.push({
    loc: `${base}/${article.slug}`,
    lastmod: articleLastmod,
    priority: '0.8',
  })
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlBlock).join('\n')}
</urlset>
`

writeFileSync(resolve(dist, 'sitemap.xml'), xml, 'utf-8')
console.log(`[sitemap] Generated ${urls.length} URLs in dist/sitemap.xml`)
