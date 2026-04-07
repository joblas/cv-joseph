import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    if (attr === 'name') el.name = key
    else el.setAttribute('property', key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

// ---------------------------------------------------------------------------
// useArticleSeo — full meta/OG/Twitter/hreflang/JSON-LD for articles
// ---------------------------------------------------------------------------

export interface ArticleSeoOpts {
  slug: string
  title: string
  description: string
  image?: string
  publishedTime: string
  modifiedTime?: string
  articleTags: string
  jsonLd: object
}

export function useArticleSeo(opts: ArticleSeoOpts) {
  useEffect(() => {
    const {
      slug, title, description, image,
      publishedTime, modifiedTime, articleTags, jsonLd,
    } = opts

    const url = `https://cv-joseph.vercel.app/${slug}`

    document.title = title

    // Standard meta
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'author', 'Joseph Blas')
    upsertMeta('name', 'robots', 'index, follow')

    // Open Graph
    upsertMeta('property', 'og:type', 'article')
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:site_name', 'cv-joseph.vercel.app')
    upsertMeta('property', 'og:locale', 'en_US')
    upsertMeta('property', 'article:published_time', publishedTime)
    if (modifiedTime) upsertMeta('property', 'article:modified_time', modifiedTime)
    upsertMeta('property', 'article:author', 'https://www.linkedin.com/in/joseph-blas')
    upsertMeta('property', 'article:tag', articleTags)
    if (image) upsertMeta('property', 'og:image', image)

    // Twitter
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    if (image) upsertMeta('name', 'twitter:image', image)

    // Canonical
    upsertLink('canonical', url)

    // JSON-LD — remove any pre-existing (from prerender) before adding
    const existing = document.querySelector('script[type="application/ld+json"]')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(jsonLd)
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [opts.slug, opts.title])
}

// ---------------------------------------------------------------------------
// useHomeSeo — lightweight, only updates existing tags from index.html
// ---------------------------------------------------------------------------

export function useHomeSeo({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = title

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', description)

    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  }, [title, description])
}
