/**
 * Post-build script: SSR prerender using React's renderToString.
 *
 * Renders the actual App component to HTML so the pre-rendered content
 * matches exactly what React produces. This enables hydrateRoot() on the
 * client to adopt the existing DOM without replacing it (zero CLS).
 *
 * Articles are loaded from the article registry. Only articles whose
 * component files exist will be prerendered (new case studies added to the
 * registry but not yet created will be skipped gracefully).
 *
 * Usage: npx tsx scripts/prerender.tsx  (runs automatically via "npm run build")
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { Suspense, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import Critters from 'critters';
import App from '../src/App.tsx';
import GlobalNav from '../src/GlobalNav.tsx';
import { articleRegistry, type ArticleConfig } from '../src/articles/registry.ts';
import { buildArticleJsonLd } from '../src/articles/json-ld.ts';
import AboutPage from '../src/AboutPage.tsx';
import { aboutContent } from '../src/about-i18n.ts';
import { seo } from '../src/i18n.ts';
import { n8nContent } from '../src/n8n-i18n.ts';
import { jacoboContent } from '../src/jacobo-i18n.ts';
import { businessOsContent } from '../src/business-os-i18n.ts';
import { pseoContent } from '../src/pseo-i18n.ts';
import { chatbotContent } from '../src/chatbot-i18n.ts';
import { careerOpsContent } from '../src/career-ops-i18n.ts';
import { openclawContent } from '../src/openclaw-i18n.ts';

// Map article id → i18n content for JSON-LD generation
const i18nMap: Record<string, { header: { h1: string }; nav: { breadcrumbHome: string; breadcrumbCurrent: string }; faq: { items: readonly { q: string; a: string }[] } }> = {
  'n8n-for-pms': n8nContent,
  'jacobo': jacoboContent,
  'business-os': businessOsContent,
  'programmatic-seo': pseoContent,
  'self-healing-chatbot': chatbotContent,
  'career-ops': careerOpsContent,
  'openclaw': openclawContent,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Strip React 19 SSR-injected <link> tags from inside #root to prevent hydration mismatch */
function stripReactSSRTags(html: string): string {
  return html.replace(/<link[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// SSR render (home page)
// ---------------------------------------------------------------------------
function renderApp(): string {
  return stripReactSSRTags(renderToString(
    <StaticRouter location="/">
      <div>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
          </Routes>
        </Suspense>
      </div>
    </StaticRouter>
  ));
}

function renderArticlePage(slug: string, ArticleComponent: ComponentType): string {
  return stripReactSSRTags(renderToString(
    <StaticRouter location={`/${slug}`}>
      <GlobalNav />
      <div>
        <Suspense fallback={null}>
          <Routes>
            <Route path={`/${slug}`} element={<ArticleComponent />} />
          </Routes>
        </Suspense>
      </div>
    </StaticRouter>
  ));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Inject into built HTML
// ---------------------------------------------------------------------------
const distDir = resolve(root, 'dist');
const indexPath = resolve(distDir, 'index.html');

let indexHtml: string;
try {
  indexHtml = readFileSync(indexPath, 'utf-8');
} catch {
  console.error('Error: dist/index.html not found. Run "vite build" first.');
  process.exit(1);
}

// --- Home page ---
let homeHtml: string;
try {
  homeHtml = renderApp();
} catch (err) {
  console.error('[prerender] SSR failed for home, falling back to empty root:', err);
  homeHtml = '';
}

const injectedHome = indexHtml
  .replace('<div id="root"></div>', `<div id="root">${homeHtml}</div>`)
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
  .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(seo.title)}" />`)
  .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(seo.description)}" />`)
  .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(seo.title)}" />`)
  .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(seo.description)}" />`)
  .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(seo.title)}" />`)
  .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(seo.description)}" />`);

// ---------------------------------------------------------------------------
// About / Entity Home (/about)
// ---------------------------------------------------------------------------

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  dateModified: '2026-03-27',
  mainEntity: {
    '@type': 'Person',
    '@id': 'https://cv-joseph.vercel.app/#person',
    name: 'Joseph Blas',
    alternateName: ['Joseph Blas', 'joblas'],
    url: 'https://cv-joseph.vercel.app',
    image: 'https://cv-joseph.vercel.app/foto-avatar.png',
    email: 'blasj408@gmail.com',
    jobTitle: ['AI Product Manager', 'Solutions Architect (No/Low-Code & AI)', 'AI Forward Deployed Engineer'],
    knowsAbout: [
      { '@type': 'Thing', name: 'Artificial Intelligence', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
      { '@type': 'Thing', name: 'Machine Learning', url: 'https://en.wikipedia.org/wiki/Machine_learning' },
      { '@type': 'Thing', name: 'Multi-Agent System', url: 'https://en.wikipedia.org/wiki/Multi-agent_system' },
      { '@type': 'Thing', name: 'Retrieval-Augmented Generation', url: 'https://en.wikipedia.org/wiki/Retrieval-augmented_generation' },
      { '@type': 'Thing', name: 'No-code development platform', url: 'https://en.wikipedia.org/wiki/No-code_development_platform' },
      { '@type': 'Thing', name: 'Prompt Engineering' },
      { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com' },
      { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
      { '@type': 'SoftwareApplication', name: 'Claude API', url: 'https://docs.anthropic.com' },
    ],
    hasCredential: [
      { '@type': 'EducationalOccupationalCredential', name: 'Introduction to Model Context Protocol', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/4pxam3irsioq' },
      { '@type': 'EducationalOccupationalCredential', name: 'Claude Code in Action', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/eijx7hwc2x89' },
      { '@type': 'EducationalOccupationalCredential', name: 'Advanced MCP Topics', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/eiovmq5qaeyd' },
      { '@type': 'EducationalOccupationalCredential', name: 'Building with the Claude API', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/s4bu5znz53vm' },
      { '@type': 'EducationalOccupationalCredential', name: 'AI Fluency: Framework & Foundations', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/d6rhfox7ktq6' },
      { '@type': 'EducationalOccupationalCredential', name: 'Teaching AI Fluency', recognizedBy: { '@type': 'Organization', name: 'Anthropic' }, url: 'https://verify.skilljar.com/c/x3bzuoz99rq5' },
      { '@type': 'EducationalOccupationalCredential', name: 'AI App Builder Certification', recognizedBy: { '@type': 'Organization', name: 'Airtable' }, url: 'https://verify.skilljar.com/c/gwg7ak9qgf7r' },
      { '@type': 'EducationalOccupationalCredential', name: 'Airtable Builder Certification', recognizedBy: { '@type': 'Organization', name: 'Airtable' }, url: 'https://verify.skilljar.com/c/id2e4zgqtasv' },
      { '@type': 'EducationalOccupationalCredential', name: 'Airtable Admin Certification', recognizedBy: { '@type': 'Organization', name: 'Airtable' }, url: 'https://verify.skilljar.com/c/u3r8kgn5wdit' },
      { '@type': 'EducationalOccupationalCredential', name: 'Make Advanced', recognizedBy: { '@type': 'Organization', name: 'Make Academy' }, url: 'https://www.credly.com/badges/d27b8174-ef20-46bd-9d81-ee05e9c349e8' },
    ],
    alumniOf: [
      { '@type': 'EducationalOrganization', name: 'Maven - AI Product Management Bootcamp' },
      { '@type': 'EducationalOrganization', name: 'BIGSEO - Master en Inteligencia Artificial' },
      { '@type': 'EducationalOrganization', name: 'ETSI - Universidad de Sevilla' },
    ],
    founder: {
      '@type': 'Organization',
      name: 'Joseph Blas',
      url: 'https://cv-joseph.vercel.app',
      foundingDate: '2024',
    },
    sameAs: [
      'https://www.linkedin.com/in/joseph-blas',
      'https://github.com/joblas',
      'https://x.com/joblas',
      'https://dev.to/joblas',
      'https://joblas.substack.com',
      'https://contentdigest.cv-joseph.vercel.app',
      'https://www.youtube.com/@joblas',
      'https://stackoverflow.com/users/32541743',
      'https://orcid.org/0009-0006-2192-7210',
      'https://www.crunchbase.com/person/joseph-blas',
      'https://huggingface.co/joblas',
      'https://www.wikidata.org/wiki/Q138710224',
      'https://www.facebook.com/joblas/',
    ],
    subjectOf: {
      '@type': 'NewsArticle',
      headline: 'Going shopping: A quick fix for the phone',
      publisher: { '@type': 'NewsMediaOrganization', name: 'Diario de Sevilla' },
      datePublished: '2014-06-19',
      url: 'https://www.diariodesevilla.es/vivirensevilla/Salir-compras-solucion-expres-telefono_0_817718799.html',
    },
    address: { '@type': 'PostalAddress', addressLocality: 'Sevilla', addressCountry: 'ES' },
  },
};

const aboutJsonLdScript = `<script type="application/ld+json">\n${JSON.stringify(aboutJsonLd, null, 2)}\n</script>`;

const aboutSlug = aboutContent.slug;
const aboutUrl = `https://cv-joseph.vercel.app/${aboutSlug}`;

let aboutRenderedHtml: string;
try {
  aboutRenderedHtml = stripReactSSRTags(renderToString(
    <StaticRouter location={`/${aboutSlug}`}>
      <GlobalNav />
      <div>
        <Suspense fallback={null}>
          <Routes>
            <Route path={`/${aboutSlug}`} element={<AboutPage />} />
          </Routes>
        </Suspense>
      </div>
    </StaticRouter>
  ));
} catch (err) {
  console.error(`[prerender] SSR failed for ${aboutSlug}, falling back to empty root:`, err);
  aboutRenderedHtml = '';
}

let aboutPage = indexHtml
  .replace('<div id="root"></div>', `<div id="root">${aboutRenderedHtml}</div>`)
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(aboutContent.seo.title)}</title>`)
  .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(aboutContent.seo.title)}" />`)
  .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(aboutContent.seo.description)}" />`)
  .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*/g, '')
  .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${aboutUrl}" />`)
  .replace(/<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="profile" />')
  .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${aboutUrl}" />`)
  .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(aboutContent.seo.title)}" />`)
  .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(aboutContent.seo.description)}" />`)
  .replace(/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${aboutUrl}" />`)
  .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(aboutContent.seo.title)}" />`)
  .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(aboutContent.seo.description)}" />`);

// Replace homepage JSON-LD with ProfilePage JSON-LD
aboutPage = aboutPage.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  aboutJsonLdScript,
);

// ---------------------------------------------------------------------------
// Article pages — build from registry
// ---------------------------------------------------------------------------
interface ArticlePage {
  slug: string;
  html: string;
}

function buildArticlePageHtml(
  config: ArticleConfig,
  ArticleComponent: ComponentType,
): string {
  const slug = config.slug;
  const url = `https://cv-joseph.vercel.app/${slug}`;
  const articleSeo = config.seo;

  let renderedHtml: string;
  try {
    renderedHtml = renderArticlePage(slug, ArticleComponent);
  } catch (err) {
    console.error(`[prerender] SSR failed for ${slug}, falling back to empty root:`, err);
    renderedHtml = '';
  }

  let result = indexHtml
    .replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(articleSeo.title)}</title>`)
    .replace(/<meta name="title" content="[^"]*" \/>/, `<meta name="title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(articleSeo.description)}" />`)
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*/g, '')
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="article" />')
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(articleSeo.description)}" />`)
    .replace(/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(articleSeo.description)}" />`)
    // OG image — replace with article-specific image if configured
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${esc(config.ogImage || 'https://cv-joseph.vercel.app/og-image.webp')}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${esc(articleSeo.title)}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, config.ogImage ? `<meta name="twitter:image" content="${esc(config.ogImage)}" />` : '');

  // Inject article:published_time + article:modified_time + article:tag
  const seoMeta = config.seoMeta;
  if (seoMeta) {
    const articleMetaTags = [
      `<meta property="article:published_time" content="${seoMeta.datePublished}" />`,
      `<meta property="article:modified_time" content="${seoMeta.dateModified}" />`,
      `<meta property="article:author" content="https://www.linkedin.com/in/joseph-blas" />`,
      `<meta property="article:tag" content="${esc(seoMeta.articleTags)}" />`,
    ].join('\n    ');
    result = result.replace('</head>', `    ${articleMetaTags}\n  </head>`);
  }

  // Inject article JSON-LD (replace homepage Person/WebSite schema)
  const i18n = i18nMap[config.id];
  if (seoMeta && i18n) {
    const jsonLd = buildArticleJsonLd({
      url,
      headline: i18n.header.h1,
      alternativeHeadline: articleSeo.title,
      description: articleSeo.description,
      datePublished: seoMeta.datePublished,
      dateModified: seoMeta.dateModified,
      keywords: seoMeta.keywords,
      images: config.heroImage ? [config.heroImage] : seoMeta.images,
      breadcrumbHome: i18n.nav.breadcrumbHome,
      breadcrumbCurrent: i18n.nav.breadcrumbCurrent,
      faq: i18n.faq.items,
      articleType: seoMeta.articleType,
      about: seoMeta.about,
      extra: seoMeta.extra,
      citation: seoMeta.citation,
      isBasedOn: seoMeta.isBasedOn,
      mentions: seoMeta.mentions,
      discussionUrl: seoMeta.discussionUrl,
      relatedLink: seoMeta.relatedLink,
    });
    const jsonLdScript = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
    result = result.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      jsonLdScript,
    );
  }

  return result;
}

// Load article components and build pages
const articlePages: ArticlePage[] = [];

for (const config of articleRegistry) {
  let ArticleComponent: ComponentType;
  try {
    const mod = await config.component();
    ArticleComponent = mod.default;
  } catch {
    console.log(`[prerender] Skipping ${config.id} — component not found yet`);
    continue;
  }

  const html = buildArticlePageHtml(config, ArticleComponent);
  articlePages.push({ slug: config.slug, html });
}

// ---------------------------------------------------------------------------
// Critical CSS inlining with Critters
// ---------------------------------------------------------------------------
const critters = new Critters({
  path: distDir,
  publicPath: '/',
  inlineFonts: false,
  preload: 'media',
  compress: true,
  reduceInlineStyles: true,
});

function dedupePreloads(html: string): string {
  return html.replace(/<link rel="preload" as="image" href="\/foto-avatar\.webp">/g, '');
}

async function writePage(html: string, outputPath: string, label: string) {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  try {
    const processed = dedupePreloads(await critters.process(html));
    writeFileSync(outputPath, processed, 'utf-8');
    console.log(`[prerender] ${label} (with critical CSS)`);
  } catch {
    writeFileSync(outputPath, html, 'utf-8');
    console.log(`[prerender] ${label} (no critical CSS)`);
  }
}

async function inlineCriticalCSS() {
  // Home page
  await writePage(injectedHome, indexPath, 'Home: dist/index.html updated');

  // About page
  await writePage(aboutPage, resolve(distDir, aboutSlug, 'index.html'), `${aboutSlug}: dist/${aboutSlug}/index.html created`);

  // Article pages
  for (const { slug, html } of articlePages) {
    await writePage(html, resolve(distDir, slug, 'index.html'), `${slug}: dist/${slug}/index.html created`);
  }
}

await inlineCriticalCSS();

// ---------------------------------------------------------------------------
// 404 page — Vercel serves this with HTTP 404 status automatically
// ---------------------------------------------------------------------------
const notFoundHtml = indexHtml
  .replace('<div id="root"></div>', `<div id="root"><div style="min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 1.5rem"><p style="font-size:6rem;font-weight:bold;color:var(--primary);margin-bottom:1rem;font-family:var(--font-display)">404</p><h1 style="font-size:1.5rem;font-weight:600;color:var(--foreground);margin-bottom:0.5rem">Page not found</h1><p style="color:var(--muted-foreground);margin-bottom:2rem;max-width:28rem">The page you're looking for doesn't exist or has been moved.</p><a href="/" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;border-radius:0.75rem;background:var(--primary);color:var(--primary-foreground);font-weight:500;text-decoration:none">← Back to home</a></div></div>`)
  .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
  .replace(/<title>[^<]*<\/title>/, '<title>404 — Page not found | cv-joseph.vercel.app</title>');

// Add noindex if no robots meta exists
if (!notFoundHtml.includes('name="robots"')) {
  const withNoindex = notFoundHtml.replace('</head>', '<meta name="robots" content="noindex, nofollow" /></head>');
  writeFileSync(resolve(distDir, '404.html'), withNoindex, 'utf-8');
} else {
  writeFileSync(resolve(distDir, '404.html'), notFoundHtml, 'utf-8');
}
console.log('[prerender] 404: dist/404.html created');

// ---------------------------------------------------------------------------
// Hydration structure validation
// ---------------------------------------------------------------------------
function validateHydrationStructure(html: string, label: string) {
  const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/);
  if (!rootMatch || !rootMatch[1].trim()) return; // empty root = OK (fallback)
  const content = rootMatch[1];

  // Must NOT contain <link> tags (React 19 SSR artifacts)
  if (/<link\s/.test(content)) {
    console.error(`[hydration-check] FAIL ${label}: <link> tags found inside #root — will cause hydration mismatch`);
    process.exit(1);
  }

  // Must have <div> wrapper (PageTransition)
  if (!content.includes('<div')) {
    console.error(`[hydration-check] FAIL ${label}: missing <div> wrapper (PageTransition) inside #root`);
    process.exit(1);
  }
}

// Validate pages
validateHydrationStructure(injectedHome, 'home');
validateHydrationStructure(aboutPage, aboutSlug);
for (const { slug, html } of articlePages) {
  validateHydrationStructure(html, slug);
}

console.log('[hydration-check] All pages pass structural validation');
console.log('[prerender] Done.');
