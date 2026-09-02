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
  DataTable,
  StackGrid,
  FloatingToc,
  DiagramZoom,
  ToolList,
  Timeline,
} from './articles/content-types'
import { archiveBetaLoopContent } from './archive-beta-loop-i18n'

// ---------------------------------------------------------------------------
// Stack icons
// ---------------------------------------------------------------------------
const stackIcons: Record<string, React.ReactNode> = {
  'Claude Code': (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#D97757"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>
  ),
  'tmux + systemd': (
    <svg viewBox="0 0 160 160" className="w-8 h-8"><path fill="#1BB91F" d="m0 116h160v29c0 8.286-6.722 15-15 15h-130c-8.283 0-15-6.707-15-15v-29z"/><path fill="currentColor" d="m83 70v-70h-6v146h6v-70h77v-6h-77zm-83-54.99c0-8.288 6.722-15.01 15-15.01h130c8.283 0 15 6.725 15 15.01v131h-160v-131z"/></svg>
  ),
  Supabase: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#3ECF8E"><path d="M13.976 22.101c-.591.744-1.79.336-1.804-.614l-.208-13.903h9.35c1.693 0 2.638 1.955 1.585 3.281z"/><path d="M10.024 1.9c.591-.745 1.79-.337 1.804.612l.091 13.903h-9.23c-1.694 0-2.639-1.954-1.586-3.28z" opacity="0.8"/></svg>
  ),
}

// ---------------------------------------------------------------------------
// buildJsonLd
// ---------------------------------------------------------------------------
function buildJsonLd() {
  const t = archiveBetaLoopContent
  return buildArticleJsonLd({
    url: `https://cv-joseph.vercel.app/${t.slug}`,
    headline: t.header.h1,
    alternativeHeadline: t.seo.title,
    description: t.seo.description,
    datePublished: '2026-09-01',
    dateModified: '2026-09-01',
    keywords: [
      'autonomous agent', 'agentic development loop', 'Claude Code', 'AI feedback loop',
      'over-the-air updates', 'expo-updates', 'EAS', 'test-driven development',
      'human in the loop', 'AI guardrails', 'prompt injection defense', 'self-healing infrastructure',
      'beta feedback automation', 'agent pre-authorization',
    ],
    images: ['https://cv-joseph.vercel.app/articles/archive-beta-loop/og-archive-beta-loop.webp'],
    breadcrumbHome: t.nav.breadcrumbHome,
    breadcrumbCurrent: t.nav.breadcrumbCurrent,
    faq: t.faq.items,
    articleType: 'TechArticle',
    about: [
      { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
      { '@type': 'SoftwareApplication', name: 'Expo Application Services', url: 'https://expo.dev', applicationCategory: 'Mobile CI/CD' },
      { '@type': 'Thing', name: 'Autonomous Software Delivery' },
      { '@type': 'Thing', name: 'Human-in-the-Loop AI' },
    ],
    extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Telegram, GitHub, EAS, expo-updates, Supabase, Jest, tmux, systemd' },
  })
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function ArchiveBetaLoop() {
  const t = archiveBetaLoopContent

  useArticleSeo({
    slug: t.slug,
    title: t.seo.title,
    description: t.seo.description,
    image: 'https://cv-joseph.vercel.app/articles/archive-beta-loop/og-archive-beta-loop.webp',
    publishedTime: '2026-09-01',
    modifiedTime: '2026-09-01',
    articleTags: 'autonomous agents,Claude Code,OTA updates,TDD,guardrails,human-in-the-loop,beta feedback',
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
        readingTime={t.readingTime}
      />

      <img
        src="/articles/archive-beta-loop/hero-archive-beta-loop.webp"
        alt={'The Archive beta loop: a Telegram message from the client on the left, the merged pull request and over-the-air update it produced on the right'}
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
        {/*  THE CLIENT                                                      */}
        {/* ================================================================ */}
        <H2 id="the-client">{s.theClient.heading}</H2>
        <Prose>{s.theClient.body}</Prose>
        <MetricsGrid items={s.theClient.usageMetrics} columns={4} compact />
        <Callout>{s.theClient.callout}</Callout>

        {/* ================================================================ */}
        {/*  THE LOOP                                                        */}
        {/* ================================================================ */}
        <H2 id="the-loop">{s.theLoop.heading}</H2>
        <Prose>{s.theLoop.body}</Prose>
        <StepList items={s.theLoop.steps.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />

        <DiagramZoom
          src="/articles/archive-beta-loop/loop-architecture.webp"
          hdSrc="/articles/archive-beta-loop/loop-architecture.webp"
          alt={'Architecture diagram: Telegram bot to always-on Claude Code session to labeled GitHub issue, splitting into a test-first OTA fix path and a needs-joe pull request path'}
          caption={'The loop end to end: her message becomes an issue, then either a shipped fix or a PR waiting on me'}
          width={1400} height={800}
        />

        <ToolList items={s.theLoop.skills.map(sk => ({
          name: sk.name,
          desc: sk.desc,
        }))} />
        <Callout>{s.theLoop.intakeCallout}</Callout>

        {/* ================================================================ */}
        {/*  GUARDRAILS                                                      */}
        {/* ================================================================ */}
        <H2 id="guardrails">{s.guardrails.heading}</H2>
        <Prose>{s.guardrails.body}</Prose>
        <DataTable
          headers={[...s.guardrails.table.headers]}
          rows={s.guardrails.table.rows.map(r => [...r])}
          highlightColumn={1}
        />
        <Callout>{s.guardrails.injectionCallout}</Callout>
        <Prose>{s.guardrails.autonomySplit}</Prose>

        {/* ================================================================ */}
        {/*  THE NUMBERS                                                     */}
        {/* ================================================================ */}
        <H2 id="numbers">{s.numbers.heading}</H2>
        <Prose>{s.numbers.body}</Prose>
        <MetricsGrid items={s.numbers.metrics} columns={4} />
        <Prose>{s.numbers.detail}</Prose>

        <DiagramZoom
          src="/articles/archive-beta-loop/ota-timeline.webp"
          hdSrc="/articles/archive-beta-loop/ota-timeline.webp"
          alt={'The production update channel: one store binary followed by ten over-the-air update groups, each labeled with the feedback issues it closed'}
          caption={'One binary, ten over-the-air updates — each group message names the issues it closed'}
          width={1400} height={800}
        />

        {/* ================================================================ */}
        {/*  SPEED                                                           */}
        {/* ================================================================ */}
        <H2 id="speed">{s.speed.heading}</H2>
        <Prose>{s.speed.body}</Prose>
        <CardStack items={s.speed.caveats.map(c => ({
          title: c.title,
          detail: c.detail,
        }))} />

        {/* ================================================================ */}
        {/*  ONE NIGHT                                                       */}
        {/* ================================================================ */}
        <H2 id="one-night">{s.rapidFire.heading}</H2>
        <Prose>{s.rapidFire.body}</Prose>
        <Timeline items={s.rapidFire.timeline} />
        <Callout>{s.rapidFire.callout}</Callout>

        {/* ================================================================ */}
        {/*  SELF-HEALING                                                    */}
        {/* ================================================================ */}
        <H2 id="self-healing">{s.selfHealing.heading}</H2>
        <Prose>{s.selfHealing.body}</Prose>
        <StepList items={s.selfHealing.steps.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />
        <MetricsGrid items={s.selfHealing.metrics} columns={3} />
        <Prose>{s.selfHealing.scopeNote}</Prose>

        {/* ================================================================ */}
        {/*  WHAT BROKE                                                      */}
        {/* ================================================================ */}
        <H2 id="what-broke">{s.whatBroke.heading}</H2>
        <Prose>{s.whatBroke.body}</Prose>
        <CardStack items={s.whatBroke.items.map(item => ({
          title: item.title,
          detail: item.detail,
        }))} />

        {/* ================================================================ */}
        {/*  STACK                                                           */}
        {/* ================================================================ */}
        <H3>{s.stack.heading}</H3>
        <StackGrid items={s.stack.items.map(item => ({
          icon: stackIcons[item.name] ?? <span className="w-8 h-8 flex items-center justify-center text-lg font-bold text-primary">{item.name[0]}</span>,
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

      <ArticleFooter editorId="article-footer" utmCampaign="archive-beta-loop" />
    </ArticleLayout>
  )
}
