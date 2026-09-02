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
  Timeline,
  FloatingToc,
  DiagramZoom,
  BulletList,
} from './articles/content-types'
import { cbarrgsAgentContent } from './cbarrgs-agent-i18n'

// ---------------------------------------------------------------------------
// Stack icons
// ---------------------------------------------------------------------------
const stackIcons: Record<string, React.ReactNode> = {
  'Claude Code': (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#D97757"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>
  ),
  tmux: (
    <svg viewBox="0 0 160 160" className="w-8 h-8"><path fill="#1BB91F" d="m0 116h160v29c0 8.286-6.722 15-15 15h-130c-8.283 0-15-6.707-15-15v-29z"/><path fill="currentColor" d="m83 70v-70h-6v146h6v-70h77v-6h-77zm-83-54.99c0-8.288 6.722-15.01 15-15.01h130c8.283 0 15 6.725 15 15.01v131h-160v-131z"/></svg>
  ),
}

// ---------------------------------------------------------------------------
// buildJsonLd
// ---------------------------------------------------------------------------
function buildJsonLd() {
  const t = cbarrgsAgentContent
  return buildArticleJsonLd({
    url: `https://cv-joseph.vercel.app/${t.slug}`,
    headline: t.header.h1,
    alternativeHeadline: t.seo.title,
    description: t.seo.description,
    datePublished: '2026-09-01',
    dateModified: '2026-09-01',
    keywords: [
      'AI agent for clients', 'Claude Code agent', 'Telegram bot agent', 'website maintenance automation',
      'coding agent', 'agent operations', 'agent charter', 'artist website',
      'systemd watchdog', 'tmux agent session', 'Cloudflare Pages', 'agent guardrails',
    ],
    images: ['https://cv-joseph.vercel.app/articles/cbarrgs-agent/og-cbarrgs-agent.webp'],
    breadcrumbHome: t.nav.breadcrumbHome,
    breadcrumbCurrent: t.nav.breadcrumbCurrent,
    faq: t.faq.items,
    articleType: 'TechArticle',
    about: [
      { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
      { '@type': 'Thing', name: 'AI Agent Operations' },
      { '@type': 'Thing', name: 'Website Maintenance Automation' },
    ],
    extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Telegram, tmux, systemd, Cloudflare Pages, GitHub' },
  })
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function CbarrgsAgent() {
  const t = cbarrgsAgentContent

  useArticleSeo({
    slug: t.slug,
    title: t.seo.title,
    description: t.seo.description,
    image: 'https://cv-joseph.vercel.app/articles/cbarrgs-agent/og-cbarrgs-agent.webp',
    publishedTime: '2026-09-01',
    modifiedTime: '2026-09-01',
    articleTags: 'AI agents,client work,Claude Code,Telegram,tmux,systemd,Cloudflare Pages,guardrails',
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

      {/* PLACEHOLDER — Joe supplies: hero image (e.g. phone showing the Telegram
          chat next to a terminal with the tmux session, or a styled composite). */}
      <img
        src="/articles/cbarrgs-agent/hero-cbarrgs-agent.webp"
        alt={'The Cbarrgs agent: a Telegram chat on a phone next to a terminal running the Claude Code session inside the website repo'}
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

        {/* ================================================================ */}
        {/*  ARCHITECTURE                                                    */}
        {/* ================================================================ */}
        <H2 id="architecture">{s.architecture.heading}</H2>
        <Prose>{s.architecture.body}</Prose>
        <StepList items={s.architecture.flow.map(step => ({
          label: step.label,
          detail: step.detail,
        }))} />

        {/* PLACEHOLDER — Joe supplies: architecture diagram (Telegram → pairing
            allowlist → Claude Code session in tmux → edit/build/push → Cloudflare
            Pages → verify → reply; watchdog + steward on the side). */}
        <DiagramZoom
          src="/articles/cbarrgs-agent/architecture-cbarrgs-agent.webp"
          hdSrc="/articles/cbarrgs-agent/architecture-cbarrgs-agent.webp"
          alt={'Architecture diagram: a Telegram message passes a two-person pairing allowlist into a Claude Code session in tmux with the site repo as working directory, ships a change to Cloudflare Pages, verifies the live site, and replies'}
          caption={'From a DM to a deployed site — with a 5-minute watchdog and a weekly steward watching from the side'}
          width={1400} height={800}
        />

        <H3>{s.architecture.keepalive.heading}</H3>
        <Prose>{s.architecture.keepalive.body}</Prose>
        <Callout>{s.architecture.keepalive.callout}</Callout>

        <H3>{s.architecture.sameScript.heading}</H3>
        <Prose>{s.architecture.sameScript.body}</Prose>
        <Callout>{s.architecture.sameScript.callout}</Callout>

        <H3>{s.architecture.zeroDeploy.heading}</H3>
        <Prose>{s.architecture.zeroDeploy.body}</Prose>

        {/* ================================================================ */}
        {/*  THE CHARTER                                                     */}
        {/* ================================================================ */}
        <H2 id="charter">{s.charter.heading}</H2>
        <Prose>{s.charter.body}</Prose>

        <H3>{s.charter.autonomousHeading}</H3>
        <CardStack items={s.charter.autonomous.map(item => ({
          title: item.title,
          detail: item.detail,
        }))} />

        <H3>{s.charter.escalationHeading}</H3>
        <CardStack items={s.charter.escalations.map(item => ({
          title: item.title,
          detail: item.detail,
        }))} />

        <H3>{s.charter.hardRulesHeading}</H3>
        <BulletList items={s.charter.hardRules.map(r => ({
          label: r.label,
          detail: r.detail,
        }))} />

        <Callout>{s.charter.trustCallout}</Callout>

        {/* ================================================================ */}
        {/*  GUARDRAILS                                                      */}
        {/* ================================================================ */}
        <H2 id="guardrails">{s.guardrails.heading}</H2>
        <Prose>{s.guardrails.body}</Prose>
        <CardStack items={s.guardrails.items.map(item => ({
          title: item.title,
          detail: item.detail,
        }))} />

        {/* ================================================================ */}
        {/*  THE STEWARD                                                     */}
        {/* ================================================================ */}
        <H2 id="steward">{s.steward.heading}</H2>
        <Prose>{s.steward.body}</Prose>
        <Prose>{s.steward.story}</Prose>
        <MetricsGrid items={s.steward.metrics} columns={4} />

        {/* PLACEHOLDER — Joe supplies: screenshot of the steward's pull request
            (file list + diff stat) on the public site repo. Redact commit
            author email before exporting. */}
        <DiagramZoom
          src="/articles/cbarrgs-agent/steward-pr-cbarrgs.webp"
          hdSrc="/articles/cbarrgs-agent/steward-pr-cbarrgs.webp"
          alt={'The steward\'s pull request updating the site for the Solitude single: five files changed — structured data, share tags, llms.txt, hero fallback, /new page, sitemap'}
          caption={'The catch, as a pull request: a release the humans missed for 12 days, staged behind a human merge gate'}
          width={1400} height={800}
        />

        <H3>{s.steward.readability.heading}</H3>
        <Prose>{s.steward.readability.body}</Prose>
        <Prose>{s.steward.healthNote}</Prose>

        {/* ================================================================ */}
        {/*  SCORECARD                                                       */}
        {/* ================================================================ */}
        <H2 id="scorecard">{s.scorecard.heading}</H2>
        <Prose>{s.scorecard.body}</Prose>
        <DataTable
          headers={[...s.scorecard.table.headers]}
          rows={s.scorecard.table.rows.map(r => [...r])}
          highlightColumn={1}
        />

        <H3>{s.scorecard.timelineHeading}</H3>
        <Timeline items={s.scorecard.timeline} />

        <Prose>{s.scorecard.closing}</Prose>

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
        <H2 id="related">{'More Systems in Production'}</H2>
        <Prose>{'The Cbarrgs agent is one client\'s slice of a larger operation. These case studies cover the agent infrastructure it grew out of and the production AI-ops discipline behind it.'}</Prose>
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

      <ArticleFooter editorId="article-footer" utmCampaign="cbarrgs-agent" />
    </ArticleLayout>
  )
}
