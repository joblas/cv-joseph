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
  StepList,
  BulletList,
  DataTable,
  Timeline,
  ToolList,
  FloatingToc,
  Photo1,
  DiagramZoom,
} from './articles/content-types'
import { skateWorkshopLoopContent } from './skate-workshop-loop-i18n'

// ---------------------------------------------------------------------------
// buildJsonLd
// ---------------------------------------------------------------------------
function buildJsonLd() {
  const t = skateWorkshopLoopContent
  return buildArticleJsonLd({
    url: `https://cv-joseph.vercel.app/${t.slug}`,
    headline: t.header.h1,
    alternativeHeadline: t.seo.title,
    description: t.seo.description,
    datePublished: '2026-09-02',
    dateModified: '2026-09-02',
    keywords: [
      'agentic development loop', 'Claude Code', 'Slack bot', 'Supabase edge functions',
      'GitHub Actions', 'OTA updates', 'Expo EAS Update', 'bug triage automation',
      'webhook security', 'HMAC signature verification', 'human in the loop',
      'React Native', 'TestFlight beta', 'agent ops', 'dead loop postmortem',
    ],
    images: ['https://cv-joseph.vercel.app/articles/skate-workshop-loop/og-skate-workshop-loop.webp'],
    breadcrumbHome: t.nav.breadcrumbHome,
    breadcrumbCurrent: t.nav.breadcrumbCurrent,
    faq: t.faq.items,
    articleType: 'TechArticle',
    about: [
      { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
      { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com', applicationCategory: 'Backend Platform' },
      { '@type': 'SoftwareApplication', name: 'Slack', url: 'https://slack.com', applicationCategory: 'Team Communication' },
      { '@type': 'Thing', name: 'Agentic Development Loops' },
      { '@type': 'Thing', name: 'Human-in-the-Loop Automation' },
    ],
    extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Supabase Edge Functions, GitHub Actions, Expo EAS Update, Slack, React Native' },
    mentions: [
      { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai' },
      { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com' },
      { '@type': 'SoftwareApplication', name: 'GitHub Actions', url: 'https://github.com/features/actions' },
      { '@type': 'SoftwareApplication', name: 'Expo', url: 'https://expo.dev' },
      { '@type': 'SoftwareApplication', name: 'Slack', url: 'https://slack.com' },
    ],
  })
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function SkateWorkshopLoop() {
  const t = skateWorkshopLoopContent

  useArticleSeo({
    slug: t.slug,
    title: t.seo.title,
    description: t.seo.description,
    image: 'https://cv-joseph.vercel.app/articles/skate-workshop-loop/og-skate-workshop-loop.webp',
    publishedTime: '2026-09-02',
    modifiedTime: '2026-09-02',
    articleTags: 'agent loop,Claude Code,Slack,Supabase,edge functions,OTA,CI/CD,HITL',
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
        dateISO="2026-09-02"
        readingTime={t.readingTime}
      />

      <img
        src="/articles/skate-workshop-loop/hero-loop-diagram.webp"
        alt={'The Skate Workshop dev loop: athlete bug report to Supabase webhook to edge function to GitHub issue and Slack post; Claude branch to needs-joe gate to 175-test CI to auto-OTA'}
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
        {/*  THE LOOP, AS DESIGNED                                           */}
        {/* ================================================================ */}
        <H2 id="the-loop">{s.theLoop.heading}</H2>
        <Prose>{s.theLoop.body}</Prose>
        <StepList items={s.theLoop.steps.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />
        <Callout>{s.theLoop.punchline}</Callout>

        {/* ================================================================ */}
        {/*  THE DEAD LOOP                                                   */}
        {/* ================================================================ */}
        <H2 id="dead-loop">{s.deadLoop.heading}</H2>
        <Prose>{s.deadLoop.body}</Prose>
        <Timeline items={s.deadLoop.timeline} />
        <Photo1
          src="/articles/skate-workshop-loop/zombie-morning-report.webp"
          alt={'The final Morning Bug Report post in the intake channel, August 5: a bot listing the same five stale bugs, up to 169 days old, in the retired v1 repo'}
          caption={'The zombie\'s last post, August 5: five unfixable bugs, an empty room, a dead repo.'}
          width={1400}
          height={800}
        />
        <Callout>{s.deadLoop.callout}</Callout>
        <H3>{s.deadLoop.zeroesHeading}</H3>
        <BulletList items={s.deadLoop.zeroes} />

        {/* ================================================================ */}
        {/*  THE HALF THAT WORKED                                            */}
        {/* ================================================================ */}
        <H2 id="github-half">{s.githubHalf.heading}</H2>
        <Prose>{s.githubHalf.body}</Prose>
        <MetricsGrid items={s.githubHalf.metrics} columns={4} compact />
        <Prose>{s.githubHalf.honestBeat}</Prose>
        <DiagramZoom
          src="/articles/skate-workshop-loop/ci-relight.webp"
          hdSrc="/articles/skate-workshop-loop/ci-relight.webp"
          alt={'GitHub Actions run list: red CI and skipped CD from August 19, then green CI and successful CD Auto OTA to Preview on September 1'}
          caption={'The receipt: 13 days of red CI and skipped OTA publishes, then the September 1 relight.'}
          width={1400}
          height={800}
        />

        {/* ================================================================ */}
        {/*  THE AUDIT                                                       */}
        {/* ================================================================ */}
        <H2 id="the-audit">{s.audit.heading}</H2>
        <Prose>{s.audit.body}</Prose>
        <DataTable
          headers={[...s.audit.tableHeaders]}
          rows={s.audit.tableRows.map(r => [...r])}
          highlightColumn={0}
        />
        <Callout>{s.audit.punchline}</Callout>

        {/* ================================================================ */}
        {/*  THE RELIGHT                                                     */}
        {/* ================================================================ */}
        <H2 id="the-relight">{s.relight.heading}</H2>
        <Prose>{s.relight.body}</Prose>
        <StepList items={s.relight.steps.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />
        <Callout>{s.relight.callout}</Callout>

        {/* ================================================================ */}
        {/*  WHERE IT STANDS                                                 */}
        {/* ================================================================ */}
        <H2 id="current-state">{s.currentState.heading}</H2>
        <MetricsGrid items={s.currentState.metrics} columns={4} />
        <Prose>{s.currentState.body}</Prose>
        <H3>{s.currentState.missingHeading}</H3>
        <BulletList items={s.currentState.missing} />

        <H3>{s.stack.heading}</H3>
        <ToolList items={s.stack.items.map(item => ({
          name: item.name,
          desc: item.desc,
        }))} />

        {/* ================================================================ */}
        {/*  LESSONS                                                         */}
        {/* ================================================================ */}
        <LessonsSection
          heading={t.lessons.heading}
          items={t.lessons.items.map(l => ({
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
        <H2 id="related">{s.related.heading}</H2>
        <Prose>{s.related.body}</Prose>
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

      <ArticleFooter editorId="article-footer" utmCampaign="skate-workshop-loop" />
    </ArticleLayout>
  )
}
