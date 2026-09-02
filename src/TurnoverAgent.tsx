import { Link } from 'react-router-dom'
import { buildArticleJsonLd } from './articles/json-ld'
import { useArticleSeo } from './articles/use-article-seo'
import {
  ArticleLayout,
  ArticleHeader,
  ArticleFooter,
  FaqSection,
  LessonsSection,
  MetricsGrid,
  StatusBadge,
  CaseStudyCta,
} from './articles/components'
import {
  H2,
  H3,
  Prose,
  Callout,
  CardStack,
  StepList,
  BulletList,
  ConditionList,
  DataTable,
  StackGrid,
  Timeline,
  FloatingToc,
  DiagramZoom,
  ToolList,
} from './articles/content-types'
import { turnoverAgentContent } from './turnover-agent-i18n'

// ---------------------------------------------------------------------------
// buildJsonLd
// ---------------------------------------------------------------------------
function buildJsonLd() {
  const t = turnoverAgentContent
  return buildArticleJsonLd({
    url: `https://cv-joseph.vercel.app/${t.slug}`,
    headline: t.header.h1,
    alternativeHeadline: t.seo.title,
    description: t.seo.description,
    datePublished: '2026-09-01',
    dateModified: '2026-09-01',
    keywords: [
      'LLM agent', 'tool calling', 'Telegram bot', 'operations agent', 'ai agent for small business',
      'short-term rental automation', 'turnover management', 'iCal automation', 'Airbnb calendar sync',
      'escalation automation', 'FastAPI', 'Supabase', 'self-healing infrastructure', 'watchdog',
      'LLM fallback chain', 'client case study', 'property management AI',
    ],
    images: ['https://cv-joseph.vercel.app/articles/turnover-agent/og-turnover-agent.webp'],
    breadcrumbHome: t.nav.breadcrumbHome,
    breadcrumbCurrent: t.nav.breadcrumbCurrent,
    faq: t.faq.items,
    articleType: 'TechArticle',
    about: [
      { '@type': 'SoftwareApplication', name: 'FastAPI', url: 'https://fastapi.tiangolo.com', applicationCategory: 'Web Framework' },
      { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com', applicationCategory: 'Database' },
      { '@type': 'SoftwareApplication', name: 'Telegram', url: 'https://telegram.org', applicationCategory: 'Messaging' },
      { '@type': 'Thing', name: 'LLM Agents' },
      { '@type': 'Thing', name: 'Short-Term Rental Operations' },
    ],
    extra: { proficiencyLevel: 'Expert', dependencies: 'Python, FastAPI, python-telegram-bot, Supabase, Twilio, Ollama Cloud, Anthropic, Docker, Caddy' },
  })
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function TurnoverAgent() {
  const t = turnoverAgentContent

  useArticleSeo({
    slug: t.slug,
    title: t.seo.title,
    description: t.seo.description,
    image: 'https://cv-joseph.vercel.app/articles/turnover-agent/og-turnover-agent.webp',
    publishedTime: '2026-09-01',
    modifiedTime: '2026-09-01',
    articleTags: 'LLM agent,Telegram,operations,short-term rentals,FastAPI,Supabase,watchdogs,client work',
    jsonLd: buildJsonLd(),
  })

  const s = t.sections

  return (
    <ArticleLayout>
      <FloatingToc />
      <ArticleHeader
        editorId="hero-header"
        kicker={t.header.kicker}
        h1={t.header.h1}
        subtitle={t.header.subtitle}
        date={t.header.date}
        dateISO="2026-09-01"
        readingTime={t.readingTime}
      />

      {/* PLACEHOLDER — Joe: supply /articles/turnover-agent/hero-turnover-agent.webp
          (suggested: Telegram chat with the bot creating a turnover — redact phone
          numbers, chat IDs, and guest names before exporting) */}
      <img
        src="/articles/turnover-agent/hero-turnover-agent.webp"
        alt={'The Turnover Agent in Telegram: a plain-English conversation where the bot reports a detected checkout and the created turnover'}
        className="w-full rounded-2xl mb-8"
        width={1400}
        height={875}
        fetchPriority="high"
      />

      <StatusBadge text={t.header.badge} />
      <MetricsGrid items={t.heroMetrics} columns={5} compact />

      <Callout className="bg-accent/10 border-accent/40">{t.tldr}</Callout>
      <Callout>{t.metaCallout}</Callout>

      <article className="prose-custom">
        {/* ================================================================ */}
        {/*  INTRO                                                           */}
        {/* ================================================================ */}
        <Prose variant="hook">{s.intro.hook}</Prose>
        <Prose>{s.intro.body}</Prose>

        {/* ================================================================ */}
        {/*  THE PROBLEM                                                     */}
        {/* ================================================================ */}
        <H2 id="the-problem">{s.theProblem.heading}</H2>
        <Prose>{s.theProblem.body}</Prose>
        <StepList items={s.theProblem.painPoints.map(p => ({
          label: p.label,
          detail: p.detail,
        }))} />
        <Callout>{s.theProblem.punchline}</Callout>

        <H3>{s.theProblem.whyNotN8n.heading}</H3>
        <Prose>{s.theProblem.whyNotN8n.body}</Prose>

        {/* ================================================================ */}
        {/*  ARCHITECTURE                                                    */}
        {/* ================================================================ */}
        <H2 id="architecture">{s.architecture.heading}</H2>
        <Prose>{s.architecture.body}</Prose>
        <CardStack items={s.architecture.toolFamilies.map(f => ({
          title: f.title,
          detail: f.detail,
        }))} />

        <H3>{s.architecture.guest.heading}</H3>
        <Prose>{s.architecture.guest.body}</Prose>

        {/* ================================================================ */}
        {/*  CALENDAR WATCHER                                                */}
        {/* ================================================================ */}
        <H2 id="calendar">{s.calendar.heading}</H2>
        <Prose>{s.calendar.body}</Prose>
        <StepList items={s.calendar.steps.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />
        <Prose>{s.calendar.results}</Prose>
        <Callout>{s.calendar.honestCallout}</Callout>

        {/* ================================================================ */}
        {/*  DISPATCH & ESCALATION                                           */}
        {/* ================================================================ */}
        <H2 id="escalation">{s.escalation.heading}</H2>
        <Prose>{s.escalation.body}</Prose>
        <ConditionList items={s.escalation.ladder.map(step => ({
          condition: step.condition,
          action: step.action,
        }))} />
        <Callout>{s.escalation.honestCallout}</Callout>

        {/* ================================================================ */}
        {/*  FEATURE REQUESTS                                                */}
        {/* ================================================================ */}
        <H2 id="feature-requests">{s.featureRequests.heading}</H2>
        <Prose>{s.featureRequests.body}</Prose>
        <ToolList items={s.featureRequests.tools.map(tool => ({
          name: tool.name,
          desc: tool.desc,
        }))} />

        {/* PLACEHOLDER — Joe: supply /articles/turnover-agent/feature-request-dm.webp
            (suggested: the instant Telegram DM a filed request triggers — redact
            chat IDs and any phone numbers) */}
        <DiagramZoom
          src="/articles/turnover-agent/feature-request-dm.webp"
          hdSrc="/articles/turnover-agent/feature-request-dm.webp"
          alt={'The instant Telegram DM the bot sends when the client files a feature request through it'}
          caption={'A client feature request the moment it lands: logged to the database, DM sent to my phone'}
          width={1400} height={800}
        />

        <Prose>{s.featureRequests.stats}</Prose>
        <Callout>{s.featureRequests.honestCallout}</Callout>
        <Prose>{s.featureRequests.stillUsing}</Prose>

        {/* ================================================================ */}
        {/*  RESILIENCE                                                      */}
        {/* ================================================================ */}
        <H2 id="resilience">{s.resilience.heading}</H2>
        <H3>{s.resilience.llm.heading}</H3>
        <Prose>{s.resilience.llm.body}</Prose>
        <CardStack items={s.resilience.layers.map(layer => ({
          title: layer.title,
          detail: layer.detail,
        }))} />
        <Callout>{s.resilience.selfHealCallout}</Callout>

        {/* PLACEHOLDER — Joe: supply /articles/turnover-agent/watchdog-log.webp
            (suggested: the PROBLEM → RECOVERED lines from the watchdog log — safe
            to screenshot, contains no secrets) */}
        <DiagramZoom
          src="/articles/turnover-agent/watchdog-log.webp"
          hdSrc="/articles/turnover-agent/watchdog-log.webp"
          alt={'Watchdog log excerpt: PROBLEM health — the app is up but not answering — followed by RECOVERED five minutes later'}
          caption={'The Aug 31 self-heal, as the watchdog logged it: detected, restarted, recovered — no human involved'}
          width={1400} height={600}
        />

        <Prose>{s.resilience.uptime}</Prose>

        {/* ================================================================ */}
        {/*  SECURITY                                                        */}
        {/* ================================================================ */}
        <H2 id="security">{s.security.heading}</H2>
        <Prose>{s.security.body}</Prose>
        <BulletList items={s.security.items.map(item => ({
          label: item.label,
          detail: item.detail,
        }))} />
        <Callout>{s.security.honestCallout}</Callout>

        {/* ================================================================ */}
        {/*  THE BUILD                                                       */}
        {/* ================================================================ */}
        <H2 id="build">{s.build.heading}</H2>
        <Prose>{s.build.body}</Prose>
        <Timeline items={s.build.timeline.map(item => ({
          year: item.year,
          event: item.event,
          detail: item.detail,
        }))} />

        {/* ================================================================ */}
        {/*  HONEST NUMBERS                                                  */}
        {/* ================================================================ */}
        <H2 id="numbers">{s.numbers.heading}</H2>
        <Prose>{s.numbers.body}</Prose>
        <DataTable
          headers={[...s.numbers.table.headers]}
          rows={s.numbers.table.rows.map(r => [...r])}
          highlightColumn={1}
        />
        <Callout>{s.numbers.callout}</Callout>

        {/* ================================================================ */}
        {/*  STACK                                                           */}
        {/* ================================================================ */}
        <H3>{s.stack.heading}</H3>
        <StackGrid items={s.stack.items.map(item => ({
          icon: <span className="w-8 h-8 flex items-center justify-center text-lg font-bold text-primary">{item.name[0]}</span>,
          name: item.name,
          desc: item.role,
        }))} columns={3} />

        {/* ================================================================ */}
        {/*  LESSONS                                                         */}
        {/* ================================================================ */}
        <LessonsSection
          heading={s.lessons.heading}
          items={s.lessons.items.map(l => ({
            title: l.title,
            detail: l.detail,
          }))}
        />

        {/* ================================================================ */}
        {/*  FAQ                                                             */}
        {/* ================================================================ */}
        <FaqSection heading={t.faq.heading} items={t.faq.items} />

        {/* ================================================================ */}
        {/*  RELATED SYSTEMS                                                 */}
        {/* ================================================================ */}
        <H2 id="related">{'More Case Studies'}</H2>
        <Prose>{'The Turnover Agent is a client system. These are systems I run my own operations on — each with its own case study, architecture, and honestly audited numbers.'}</Prose>
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {Object.values(t.internalLinks).map(link => (
            <Link key={link.href} to={link.href} className="block p-4 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors">
              <p className="text-sm font-medium text-primary">{link.text}</p>
            </Link>
          ))}
        </div>

        {/* ================================================================ */}
        {/*  CTA                                                             */}
        {/* ================================================================ */}
        <CaseStudyCta
          heading={s.cta.heading}
          body={s.cta.body}
          ctaLabel={s.cta.ctaLabel}
          ctaHref={s.cta.ctaHref}
        />
      </article>

      <ArticleFooter editorId="article-footer" utmCampaign="turnover-agent" />
    </ArticleLayout>
  )
}
