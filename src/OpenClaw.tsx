import { openclawContent, type OpenClawLang } from './openclaw-i18n'
import { buildArticleJsonLd } from './articles/json-ld'
import { useArticleSeo } from './articles/use-article-seo'
import {
  ArticleLayout,
  ArticleHeader,
  ArticleFooter,
  FaqSection,
  ResourcesList,
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
  InfoCard,
  BulletList,
  FloatingToc,
  DiagramZoom,
} from './articles/content-types'

function buildJsonLd(lang: OpenClawLang) {
  const t = openclawContent[lang]
  return buildArticleJsonLd({
    lang,
    url: `https://cv-joseph.vercel.app/${t.slug}`,
    altUrl: `https://cv-joseph.vercel.app/${t.altSlug}`,
    headline: t.header.h1,
    alternativeHeadline: t.seo.title,
    description: t.seo.description,
    datePublished: '2026-04-07',
    dateModified: '2026-04-07',
    keywords: ['AI agents', 'multi-agent system', 'OpenClaw', 'agent architecture', 'small business AI', 'AI automation', 'Claude', 'n8n', 'model tiering', 'AI team'],
    images: [
      'https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp',
    ],
    breadcrumbHome: t.nav.breadcrumbHome,
    breadcrumbCurrent: t.nav.breadcrumbCurrent,
    faq: t.faq.items,
    articleType: 'TechArticle',
    about: [
      { '@type': 'SoftwareApplication', name: 'OpenClaw', applicationCategory: 'Agent Runtime' },
      { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io', applicationCategory: 'Workflow Automation' },
      { '@type': 'Thing', name: 'Multi-Agent AI Systems' },
    ],
    extra: { proficiencyLevel: 'Expert', dependencies: 'OpenClaw, n8n, Claude API, Telegram, Slack, GitHub, Stripe, Tailscale, systemd' },
    mentions: [
      { '@type': 'SoftwareApplication', name: 'OpenClaw' },
      { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
      { '@type': 'SoftwareApplication', name: 'Claude', url: 'https://claude.ai' },
      { '@type': 'SoftwareApplication', name: 'Tailscale', url: 'https://tailscale.com' },
    ],
  })
}

export default function OpenClaw({ lang = 'en' }: { lang?: OpenClawLang }) {
  const t = openclawContent[lang]

  useArticleSeo({
    lang,
    slug: t.slug,
    altSlug: t.altSlug,
    title: t.seo.title,
    description: t.seo.description,
    image: 'https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp',
    publishedTime: '2026-04-07',
    modifiedTime: '2026-04-07',
    articleTags: 'AI agents,multi-agent,OpenClaw,architecture,small business,Claude,n8n',
    jsonLd: buildJsonLd(lang),
    xDefaultSlug: 'openclaw',
  })

  return (
    <ArticleLayout lang={lang}>
      <FloatingToc />
      <ArticleHeader
        editorId="hero-header"
        kicker={t.header.kicker}
        kickerLink="https://www.joestechsolutions.com/blog/22-agent-ai-team-architecture"
        h1={t.header.h1}
        subtitle={t.header.subtitle}
        date={t.header.date}
        dateISO={t.header.dateISO}
        readingTime={t.readingTime}
      />

      <StatusBadge text="Running in production" />

      <article className="prose-custom">

        {/* Intro */}
        <Prose variant="hook">
          {t.intro.hook}
        </Prose>
        <Prose>
          {t.intro.body}
        </Prose>
        <Prose className="mb-8">
          {t.intro.punchline}
        </Prose>

        {/* Key metrics */}
        <MetricsGrid
          items={[
            { value: '22', label: 'AI Agents', detail: 'Specialized roles' },
            { value: '4', label: 'Directors', detail: 'Division leads' },
            { value: '24/7', label: 'Uptime', detail: 'Always running' },
            { value: '3', label: 'Model Tiers', detail: 'Cost-optimized' },
          ]}
          columns={4}
        />

        {/* The Org Chart */}
        <H2 id="org-chart">{t.orgChart.heading}</H2>
        <Prose>{t.orgChart.description}</Prose>

        <DiagramZoom
          src="/articles/openclaw-org-chart.webp"
          hdSrc="/articles/openclaw-org-chart.webp"
          alt={t.orgChart.imgAlt}
          caption={t.orgChart.imgCaption}
          width={1400} height={800}
        />

        {/* CTO Card */}
        <InfoCard heading={`${t.orgChart.cto.name} — ${t.orgChart.cto.role}`}>
          <p className="text-sm text-muted-foreground mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary mr-2">{t.orgChart.cto.model}</span>
          </p>
          <p className="text-muted-foreground">{t.orgChart.cto.description}</p>
        </InfoCard>

        {/* Division breakdown */}
        {t.orgChart.divisions.map((division) => (
          <div key={division.director} className="mb-6">
            <H3 id={`division-${division.director.toLowerCase()}`}>
              {division.director} — {division.domain}
            </H3>
            <div className="grid sm:grid-cols-2 gap-3">
              {division.agents.map((agent) => (
                <div key={agent.name} className="bg-card border border-border rounded-lg p-4">
                  <p className="font-medium text-foreground text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Model Tiering */}
        <H2 id="model-tiers">{t.modelTiers.heading}</H2>
        <Prose>{t.modelTiers.description}</Prose>

        <div className="space-y-3 mb-6">
          {t.modelTiers.tiers.map((tier) => (
            <div key={tier.model} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-primary/10 text-primary shrink-0 self-start">{tier.model}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{tier.role}</p>
                <p className="text-xs text-muted-foreground">{tier.usage}</p>
              </div>
            </div>
          ))}
        </div>

        <Callout>{t.modelTiers.quote}</Callout>

        {/* Infrastructure */}
        <H2 id="infrastructure">{t.infrastructure.heading}</H2>
        <Prose>{t.infrastructure.description}</Prose>

        <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-3 text-muted-foreground font-medium text-sm">Tool</th>
                <th className="py-3 px-3 text-muted-foreground font-medium text-sm">Role</th>
              </tr>
            </thead>
            <tbody>
              {t.infrastructure.tools.map((tool) => (
                <tr key={tool.name} className="border-b border-border/50">
                  <td className="py-3 px-3 font-medium text-sm text-primary">{tool.name}</td>
                  <td className="py-3 px-3 text-sm text-muted-foreground">{tool.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout>{t.infrastructure.quote}</Callout>

        {/* Real Workflows */}
        <H2 id="workflows">{t.workflows.heading}</H2>
        <Prose>{t.workflows.description}</Prose>

        {/* Morning Standups */}
        <H3 id="morning-standups">{t.workflows.morningStandups.heading}</H3>
        <Prose>{t.workflows.morningStandups.description}</Prose>

        <DiagramZoom
          src="/articles/openclaw-standup.webp"
          hdSrc="/articles/openclaw-standup.webp"
          alt={t.workflows.morningStandups.imgAlt}
          caption={t.workflows.morningStandups.imgCaption}
          width={1400} height={800}
        />

        {/* Lead to Invoice */}
        <H3 id="lead-to-invoice">{t.workflows.leadToInvoice.heading}</H3>
        <Prose>{t.workflows.leadToInvoice.description}</Prose>

        <div className="bg-muted/30 rounded-lg p-4 mb-6 font-mono text-sm overflow-x-auto">
          {t.workflows.leadToInvoice.pipeline.map((step, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground"> &rarr; </span>}
              <span className="text-primary">{step.name}</span>
              {step.detail && <span className="text-muted-foreground"> ({step.detail})</span>}
            </span>
          ))}
        </div>

        {/* Engineering Flow */}
        <H3 id="engineering-flow">{t.workflows.engineering.heading}</H3>
        <Prose>{t.workflows.engineering.description}</Prose>

        <div className="bg-muted/30 rounded-lg p-4 mb-6 font-mono text-sm overflow-x-auto">
          {t.workflows.engineering.pipeline.map((step, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground"> &rarr; </span>}
              <span className="text-primary">{step.name}</span>
              {step.detail && <span className="text-muted-foreground"> ({step.detail})</span>}
            </span>
          ))}
        </div>

        {/* Content Pipeline */}
        <H3 id="content-pipeline">{t.workflows.content.heading}</H3>
        <Prose>{t.workflows.content.description}</Prose>

        {/* Why It Matters */}
        <H2 id="why-it-matters">{t.whyItMatters.heading}</H2>
        <Prose>{t.whyItMatters.description}</Prose>

        <BulletList
          items={t.whyItMatters.points.map((p) => ({
            label: p.label,
            detail: p.detail,
          }))}
        />

        {/* Cross-link CTA */}
        <CaseStudyCta
          heading="Want to see another multi-agent system?"
          body="Career-Ops uses a similar multi-agent architecture for AI-powered job search: batch processing, 10D scoring, ATS-optimized CVs. Open source."
          ctaLabel="Read Career-Ops Case Study"
          ctaHref="/career-ops-system"
        />

        {/* Lessons */}
        <LessonsSection heading={t.lessons.heading} items={t.lessons.items} />

        {/* FAQ */}
        <FaqSection heading={t.faq.heading} items={t.faq.items} />

        {/* Resources */}
        <ResourcesList heading={t.resources.heading} items={t.resources.items} />
      </article>

      <ArticleFooter editorId="article-footer" lang={lang} utmCampaign="openclaw" />
    </ArticleLayout>
  )
}
