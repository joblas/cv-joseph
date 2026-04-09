import type { ComponentType } from 'react'

export interface ArticleSeo {
  title: string
  description: string
}

export interface ArticleSeoMeta {
  datePublished: string
  dateModified: string
  keywords: string[]
  articleType: 'Article' | 'TechArticle'
  articleTags: string
  images: string[]
  about: Array<Record<string, string>>
  extra?: Record<string, string>
  citation?: Array<{ '@type': string; name: string; url: string }>
  isBasedOn?: Record<string, unknown>
  mentions?: Array<Record<string, string>>
  discussionUrl?: string
  relatedLink?: string
}

export interface ArticleConfig {
  id: string
  slug: string
  title: string
  seo: ArticleSeo
  sectionLabels: Record<string, string>
  type: 'collab' | 'case-study' | 'bridge' | 'tool-showcase'
  /** Absolute OG image URL for prerender (social cards: LinkedIn, Twitter) */
  ogImage?: string
  /** Hero image path for JSON-LD / GEO (what AI search engines see). Falls back to ogImage if not set. */
  heroImage?: string
  component: () => Promise<{ default: ComponentType }>
  /** Whether this article is ready for RAG indexing (default: false) */
  ragReady?: boolean
  /** Path to i18n content file relative to project root (required when ragReady=true) */
  i18nFile?: string
  /** SEO metadata for prerender JSON-LD + article meta tags */
  seoMeta?: ArticleSeoMeta
}

export const articleRegistry: ArticleConfig[] = [
  {
    id: 'n8n-for-pms',
    slug: 'n8n-for-pms',
    title: 'n8n for PMs',
    seo: {
      title: 'n8n for PMs: Cheat Sheet + Free AI Templates | Joseph Blas',
      description: 'n8n cheat sheet for Product Managers: automate sprint reports and classify feedback with AI. 2 free importable workflow templates. Step-by-step tutorial.',
    },
    sectionLabels: {
      'time-sinks': 'Time Sinks',
      'workflow-1': 'Workflow 1',
      'workflow-2': 'Workflow 2',
      'the-pattern': 'The Pattern',
      'get-started': 'Get Started',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'import': 'Import',
      'resources': 'Resources',
    },
    type: 'collab',
    ragReady: true,
    i18nFile: 'src/n8n-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/workflows/n8n-ai-feedback-classification-workflow.webp',
    heroImage: 'https://cv-joseph.vercel.app/workflows/n8n-sprint-report-automation-workflow.webp',
    component: () => import('../N8nForPMs.tsx'),
    seoMeta: {
      datePublished: '2026-02-24',
      dateModified: '2026-04-07',
      keywords: ['n8n', 'n8n tutorial', 'n8n templates', 'n8n AI', 'n8n workflow', 'n8n automation', 'n8n cheat sheet', 'product manager', 'AI workflow automation', 'sprint report automation', 'feedback classification AI', 'no-code automation', 'n8n for product managers', 'workflow templates free'],
      articleType: 'TechArticle',
      articleTags: 'n8n,product manager,automation,AI,workflow,no-code',
      images: ['https://cv-joseph.vercel.app/workflows/n8n-sprint-report-automation-workflow.webp', 'https://cv-joseph.vercel.app/workflows/n8n-ai-feedback-classification-workflow.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io', applicationCategory: 'Workflow Automation' },
        { '@type': 'Thing', name: 'Product Management Automation' },
      ],
      extra: { proficiencyLevel: 'Beginner', dependencies: 'n8n Cloud (free tier), Airtable, Slack' },
      isBasedOn: {
        '@type': 'Course',
        name: 'Masterclass: n8n for PMs',
        provider: { '@type': 'Organization', name: 'Maven', url: 'https://maven.com' },
        url: 'https://maven.com/p/52fc7d/masterclass-n8n-for-p-ms',
      },
      citation: [
        { '@type': 'WebPage', name: 'Asana Anatomy of Work Index 2025', url: 'https://asana.com/work-index' },
        { '@type': 'WebPage', name: 'n8n Documentation', url: 'https://docs.n8n.io' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com' },
      ],
    },
  },
  {
    id: 'jacobo',
    slug: 'ai-agent-jacobo',
    title: 'AI Agent Jacobo',
    seo: {
      title: 'Jacobo: Multi-Agent AI — 90% Self-Service',
      description: 'Case study: omnichannel AI agent with sub-agents, tool calling & multi-model orchestration (n8n + ElevenLabs). 90% self-service.',
    },
    sectionLabels: {
      'the-problem': 'The Problem',
      'architecture': 'Architecture',
      'e2e-flows': 'E2E Flows',
      'main-router': 'The Two Brains',
      'natural-language-booking': 'Deep Dive: Booking',
      'deep-dive-quotes': 'Deep Dive: Quotes',
      'deep-dive-others': 'Deep Dive: Tools',
      'results': 'Results',
      'decisions': 'ADRs',
      'platform-evolution': 'Evolution',
      'what-id-do-differently': 'Lessons',
      'enterprise-patterns': 'Patterns',
      'run-it-yourself': 'Workflows',
      'faq': 'FAQ',
      'resources': 'Resources',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/jacobo-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/jacobo/og-jacobo-agent.webp',
    heroImage: 'https://cv-joseph.vercel.app/jacobo/santiago-headphones-thinking.webp',
    component: () => import('../JacoboAgent.tsx'),
    seoMeta: {
      datePublished: '2026-02-25',
      dateModified: '2026-04-07',
      keywords: ['multi-agent AI', 'multi agent orchestration', 'AI agent', 'sub-agent architecture', 'tool calling production', 'n8n workflows', 'n8n ai agent', 'ai agent case study', 'customer service AI', 'WhatsApp AI agent', 'ElevenLabs voice agent', 'voice AI', 'HITL', 'human in the loop', 'ia para pymes', 'agente ia whatsapp', 'multi-model orchestration', 'OpenRouter', 'FDE portfolio', 'solutions architect AI', 'AI production manager', 'enterprise AI patterns', 'voice AI platform', 'conversational AI case study', 'agentic workflows'],
      articleType: 'TechArticle',
      articleTags: 'AI agent,multi-agent,n8n,ElevenLabs,HITL,tool calling,WhatsApp,voice AI',
      images: ['https://cv-joseph.vercel.app/jacobo/og-jacobo-agent.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io', applicationCategory: 'Workflow Automation' },
        { '@type': 'SoftwareApplication', name: 'ElevenLabs', url: 'https://elevenlabs.io', applicationCategory: 'Voice AI' },
        { '@type': 'Thing', name: 'Multi-Agent Orchestration' },
        { '@type': 'Thing', name: 'AI Customer Service' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'n8n, OpenRouter, ElevenLabs, WATI, Airtable, Aircall, YouCanBookMe' },
      citation: [
        { '@type': 'WebPage', name: 'n8n Documentation', url: 'https://docs.n8n.io' },
        { '@type': 'WebPage', name: 'ElevenLabs Voice AI Documentation', url: 'https://elevenlabs.io/docs' },
        { '@type': 'WebPage', name: 'OpenRouter API Documentation', url: 'https://openrouter.ai/docs' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
        { '@type': 'SoftwareApplication', name: 'ElevenLabs', url: 'https://elevenlabs.io' },
        { '@type': 'SoftwareApplication', name: 'OpenRouter', url: 'https://openrouter.ai' },
        { '@type': 'SoftwareApplication', name: 'WATI', url: 'https://www.wati.io' },
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com' },
      ],
      discussionUrl: 'https://www.reddit.com/r/n8n/comments/1sc3i30/i_built_a_whatsapp_voice_ai_agent_in_n8n_that/',
    },
  },
  {
    id: 'business-os',
    slug: 'business-os-for-airtable',
    title: 'Business OS',
    seo: {
      title: 'Custom Business OS: Airtable + n8n — 170h/Mo',
      description: 'Case study: custom Business OS with 12 Airtable bases, 2100 fields, and n8n saving 170h/month at a phone repair business.',
    },
    sectionLabels: {
      'why-custom': 'Why Custom?',
      'overview': 'Overview',
      'e2e-flows': 'E2E Flows',
      'cross-cutting': 'Cross-Cutting',
      'day-in-life': 'A Day',
      'before-after': 'Before/After',
      'impact': 'Impact',
      'decisions': 'ADRs',
      'platform-evolution': 'Evolution',
      'lessons': 'Lessons',
      'replicability': 'Patterns',
      'faq': 'FAQ',
      'resources': 'Resources',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/business-os-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/business-os/og-business-os.webp',
    heroImage: 'https://cv-joseph.vercel.app/business-os/web-landing-hero.webp',
    component: () => import('../BusinessOS.tsx'),
    seoMeta: {
      datePublished: '2026-02-25',
      dateModified: '2026-04-07',
      keywords: ['Business OS', 'Airtable ERP', 'Airtable as ERP', 'no-code ERP', 'Airtable automation', 'CRM gamification', 'phone repair', 'inventory management', 'custom ERP case study', 'repair shop management', 'programmatic SEO', 'Airtable CRM', 'single source of truth', 'business operating system', 'multi-base architecture'],
      articleType: 'TechArticle',
      articleTags: 'Business OS,Airtable,n8n,ERP,CRM,automation,phone repair',
      images: ['https://cv-joseph.vercel.app/business-os/og-business-os.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com', applicationCategory: 'Database Platform' },
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io', applicationCategory: 'Workflow Automation' },
        { '@type': 'Thing', name: 'Enterprise Resource Planning' },
        { '@type': 'Thing', name: 'Business Process Automation' },
      ],
      extra: { proficiencyLevel: 'Advanced', dependencies: 'Airtable Pro, n8n, YouCanBookMe, WATI (WhatsApp API), DataForSEO' },
      citation: [
        { '@type': 'WebPage', name: 'Airtable Enterprise Platform', url: 'https://airtable.com/platform' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com' },
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
      ],
    },
  },
  {
    id: 'programmatic-seo',
    slug: 'programmatic-seo',
    title: 'Programmatic SEO',
    seo: {
      title: 'Programmatic SEO: 4,000+ Pages from an ERP | Joseph Blas',
      description: 'Case study: 4,730 static landing pages from Airtable as headless CMS with DataForSEO crawl budget optimization and Astro SSG. 2M+ impressions, 19K+ clicks.',
    },
    sectionLabels: {
      'opportunity': 'The Opportunity',
      'the-numbers': 'The Numbers',
      'two-strategies': 'Two Strategies',
      'architecture': 'The Architecture',
      'url-taxonomy': 'URL Taxonomy',
      'cms-deep-dive': 'The CMS',
      'page-anatomy': 'Page Anatomy',
      'decision-engine': 'Decision Engine',
      'crawl-budget': 'Crawl Budget',
      'pipeline': 'Pipeline',
      'content-automation': 'Automation',
      'image-pipeline': 'Image Pipeline',
      'reviews-pipeline': 'Reviews Pipeline',
      'before-after-pipeline': 'Before/After Pipeline',
      'growth': 'Growth',
      'results': 'Results',
      'starting-point': 'The Starting Point',
      'stack': 'Stack',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'resources': 'Resources',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/pseo-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/pseo/og-programmatic-seo.webp',
    heroImage: 'https://cv-joseph.vercel.app/pseo/ss-repair-page-hero.webp',
    component: () => import('../ProgrammaticSeo.tsx'),
    seoMeta: {
      datePublished: '2026-02-25',
      dateModified: '2026-04-07',
      keywords: ['programmatic SEO', 'Airtable', 'headless CMS', 'Astro', 'DataForSEO', 'crawl budget', 'phone repair', 'static site generation', 'local SEO', 'ERP'],
      articleType: 'TechArticle',
      articleTags: 'programmatic SEO,Airtable,Astro,DataForSEO,crawl budget,phone repair,ERP,local SEO',
      images: ['https://cv-joseph.vercel.app/pseo/og-programmatic-seo.png'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com', applicationCategory: 'Database Platform' },
        { '@type': 'SoftwareApplication', name: 'Astro', url: 'https://astro.build', applicationCategory: 'Static Site Generator' },
        { '@type': 'SoftwareApplication', name: 'DataForSEO', url: 'https://dataforseo.com', applicationCategory: 'SEO Data API' },
      ],
      extra: { proficiencyLevel: 'Intermediate', dependencies: 'Airtable, Astro, DataForSEO API, Node.js' },
      citation: [
        { '@type': 'WebPage', name: 'Google Search Central: Crawl Budget', url: 'https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Airtable', url: 'https://airtable.com' },
        { '@type': 'SoftwareApplication', name: 'Astro', url: 'https://astro.build' },
        { '@type': 'SoftwareApplication', name: 'DataForSEO', url: 'https://dataforseo.com' },
      ],
    },
  },
  {
    id: 'self-healing-chatbot',
    slug: 'self-healing-chatbot',
    title: 'The Self-Healing Chatbot',
    seo: {
      title: 'The Self-Healing Chatbot: From Widget to Production LLMOps',
      description: 'Case study: production LLMOps with agentic observability, 6-layer defense, 71 evals, voice mode, and a closed-loop that generates tests from real failures.',
    },
    sectionLabels: {
      'genesis': 'The Genesis',
      'evolution': 'The Evolution',
      'architecture': 'Architecture',
      'how-it-was-built': 'How It Was Built',
      'rag': 'Agentic RAG',
      'defense': 'Defense',
      'agentic-observability': 'Agentic Observability',
      'evals': 'The 71 Tests',
      'closed-loop': 'The Closed Loop',
      'cost': 'Real Cost',
      'voice': 'Voice Mode',
      'lessons': 'Lessons',
      'faq': 'FAQ',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/chatbot-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/chatbot/og-self-healing-chatbot.webp',
    heroImage: 'https://cv-joseph.vercel.app/chatbot/hero-self-healing-chatbot.webp',
    component: () => import('../SelfHealingChatbot.tsx'),
    seoMeta: {
      datePublished: '2026-03-11',
      dateModified: '2026-04-07',
      keywords: ['LLMOps', 'self-healing chatbot', 'agentic RAG', 'jailbreak defense', 'prompt injection', 'LLM evaluation', 'closed loop LLM', 'Langfuse', 'prompt versioning', 'adversarial testing', 'trace-to-eval', 'hybrid search pgvector', 'AI portfolio', 'chatbot evals', 'CI gate LLM', 'voice mode chatbot', 'OpenAI Realtime API', 'speech-to-speech AI', 'agentic observability', 'developer feedback loop', 'AI maintaining AI'],
      articleType: 'TechArticle',
      articleTags: 'LLMOps,self-healing chatbot,agentic RAG,jailbreak defense,Langfuse,evals,closed-loop,prompt injection',
      images: ['https://cv-joseph.vercel.app/chatbot/og-self-healing-chatbot.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Langfuse', url: 'https://langfuse.com', applicationCategory: 'LLM Observability' },
        { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com', applicationCategory: 'Database' },
        { '@type': 'Thing', name: 'LLMOps' },
        { '@type': 'Thing', name: 'Retrieval-Augmented Generation' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Claude, Langfuse, Supabase, Vercel, OpenAI, Resend, GitHub Actions' },
      citation: [
        { '@type': 'SocialMediaPosting', name: 'Han hackeado a mi chatbot — LinkedIn post (300+ reactions)', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7421984735024816128/' },
        { '@type': 'WebPage', name: 'OWASP Top 10 for LLM Applications', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
        { '@type': 'TechArticle', name: 'Anthropic Tool Use Documentation', url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Langfuse', url: 'https://langfuse.com' },
        { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com' },
        { '@type': 'SoftwareApplication', name: 'OpenAI Realtime API', url: 'https://platform.openai.com' },
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Vercel', url: 'https://vercel.com' },
      ],
    },
  },
  {
    id: 'career-ops',
    slug: 'career-ops-system',
    title: 'Career-Ops',
    seo: {
      title: 'Career-Ops: Finding, Forking & Customizing the Right Open-Source Tool',
      description: 'How I evaluated, forked, and customized Career-Ops — an open-source multi-agent job search tool by santifer — for my AI Developer and DevOps job search. A showcase of OSS adoption and optimization.',
    },
    sectionLabels: {
      'the-problem': 'The Problem',
      'architecture': 'Multi-Agent System',
      'scoring': '10D Scoring',
      'pipeline': 'The Pipeline',
      'pdf': 'AI Resume Builder',
      'before-after': 'Before/After',
      'results': 'Results',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'related': 'Related',
    },
    type: 'tool-showcase',
    ragReady: true,
    i18nFile: 'src/career-ops-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/career-ops/og-career-ops.webp',
    heroImage: 'https://cv-joseph.vercel.app/career-ops/hero-career-ops.webp',
    component: () => import('../CareerOps.tsx'),
    seoMeta: {
      datePublished: '2026-03-17',
      dateModified: '2026-04-07',
      keywords: ['ai job search', 'ai job search tool', 'ai powered job search', 'ai resume builder', 'ai resume', 'multi agent system', 'multi agent orchestration', 'automated job application', 'ATS-optimized resume', 'Claude Code', 'batch processing', 'HITL', 'job search automation', 'career-ops', 'ai auto apply', 'agente ia', 'crear cv con ia', 'automatizacion con ia', 'sistema multiagente', 'busqueda de empleo ia'],
      articleType: 'TechArticle',
      articleTags: 'multi-agent,job search,Claude Code,ATS,batch processing,HITL,automation,Playwright',
      images: ['https://cv-joseph.vercel.app/career-ops/og-career-ops.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
        { '@type': 'SoftwareApplication', name: 'Playwright', url: 'https://playwright.dev', applicationCategory: 'Browser Automation' },
        { '@type': 'Thing', name: 'Multi-Agent Orchestration' },
        { '@type': 'Thing', name: 'Job Search Automation' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Playwright, Puppeteer, Node.js, tmux' },
      citation: [
        { '@type': 'WebPage', name: 'Anthropic Claude Code Documentation', url: 'https://docs.anthropic.com/en/docs/claude-code' },
        { '@type': 'WebPage', name: 'Playwright Browser Automation Documentation', url: 'https://playwright.dev/docs/intro' },
        { '@type': 'DiscussionForumPosting', name: 'I built an AI job search system with Claude Code — r/ClaudeAI (250+ upvotes)', url: 'https://www.reddit.com/r/ClaudeAI/comments/1sd2f37/i_built_an_ai_job_search_system_with_claude_code/' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Playwright', url: 'https://playwright.dev' },
        { '@type': 'SoftwareApplication', name: 'Puppeteer', url: 'https://pptr.dev' },
        { '@type': 'SoftwareApplication', name: 'Node.js', url: 'https://nodejs.org' },
      ],
      discussionUrl: 'https://www.reddit.com/r/SideProject/comments/1rw1lg4/i_automated_my_job_search_with_ai_agents_516/',
      relatedLink: 'https://github.com/santifer/career-ops',
    },
  },
  {
    id: 'openclaw',
    slug: 'openclaw',
    title: 'OpenClaw',
    seo: {
      title: 'I Built a 22-Agent AI Team to Run My Business | Joseph Blas',
      description: '22 specialized AI agents running real business operations 24/7. Org chart, model tiering, infrastructure, and real workflows. Built on OpenClaw.',
    },
    sectionLabels: {
      'org-chart': 'Org Chart',
      'model-tiers': 'Model Tiers',
      'infrastructure': 'Infrastructure',
      'workflows': 'Workflows',
      'why-it-matters': 'Why It Matters',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'resources': 'Resources',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/openclaw-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp',
    heroImage: 'https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp',
    component: () => import('../OpenClaw.tsx'),
    seoMeta: {
      datePublished: '2026-02-18',
      dateModified: '2026-04-07',
      keywords: ['AI agents', 'multi-agent system', 'OpenClaw', 'agent architecture', 'small business AI', 'AI automation', 'Claude', 'n8n', 'model tiering', 'AI team', '22 agents', 'agent runtime', 'AI orchestration', 'business automation', 'AI consultancy'],
      articleType: 'TechArticle',
      articleTags: 'AI agents,multi-agent,OpenClaw,architecture,small business,Claude,n8n,automation',
      images: ['https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'OpenClaw', applicationCategory: 'Agent Runtime' },
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io', applicationCategory: 'Workflow Automation' },
        { '@type': 'Thing', name: 'Multi-Agent AI Systems' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'OpenClaw, n8n, Claude API, Telegram, Slack, GitHub, Stripe, Tailscale, systemd' },
      citation: [
        { '@type': 'WebPage', name: 'Original blog post: 22-Agent AI Team Architecture', url: 'https://www.joestechsolutions.com/blog/22-agent-ai-team-architecture' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'OpenClaw' },
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
        { '@type': 'SoftwareApplication', name: 'Claude', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Tailscale', url: 'https://tailscale.com' },
      ],
    },
  },
  {
    id: 'av-career',
    slug: 'av-career',
    title: 'AV Career',
    seo: {
      title: 'Joseph Blas | 15+ Years in Autonomous Vehicles',
      description: "From Google's Self-Driving Car to Pronto.ai. 15+ years building autonomous vehicles: Firefly, Uber ATG, 2,900-mile cross-country demo.",
    },
    sectionLabels: {},
    type: 'bridge',
    component: () => import('../SantiferIRepair.tsx'),
  },
]

// Derived maps for GlobalNav and routing
export function getAltPaths(): Record<string, string> {
  const map: Record<string, string> = {
    '/': '/',
    '/about': '/about',
    '/privacy': '/privacy',
  }
  for (const article of articleRegistry) {
    map[`/${article.slug}`] = `/${article.slug}`
  }
  return map
}

export function getPageTitles(): Record<string, string> {
  const map: Record<string, string> = {
    '/': "Joseph's Portfolio",
    '/about': 'About',
  }
  for (const article of articleRegistry) {
    map[`/${article.slug}`] = article.title
  }
  return map
}

export function getSectionLabels(): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {}
  for (const article of articleRegistry) {
    map[`/${article.slug}`] = article.sectionLabels
  }
  return map
}
