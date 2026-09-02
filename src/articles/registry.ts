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
  altSlug?: string
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
      description: 'How I evaluated, forked, and customized Career-Ops — an open-source multi-agent job search tool by santifer — for my AI Developer and Autonomous Systems job search. A showcase of OSS adoption and optimization.',
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
    id: 'hermes',
    slug: 'hermes',
    altSlug: 'openclaw',
    title: 'OpenClaw → Hermes Migration',
    seo: {
      title: 'I Retired a 22-Agent AI System. Here\'s Why. | Joseph Blas',
      description: 'Case study: how I migrated OpenClaw (22 specialized agents, 4 directors, 1 CTO) to Hermes (composable workers behind C-suite + VPs, 40+ scheduled automations). The lesson: design for composability, not specialization.',
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
      datePublished: '2026-06-16',
      dateModified: '2026-06-16',
      keywords: ['AI agents', 'multi-agent system', 'OpenClaw', 'Hermes', 'agent migration', 'agent architecture', 'composability', 'small business AI', 'AI automation', 'Claude', 'n8n', 'Ollama Cloud', 'model selection', 'AI team', 'agent runtime', 'AI orchestration', 'business automation', 'AI consultancy'],
      articleType: 'TechArticle',
      articleTags: 'AI agents,multi-agent,Hermes,OpenClaw,architecture,migration,composability,specialization,small business,Claude,n8n,automation',
      images: ['https://cv-joseph.vercel.app/articles/openclaw-org-chart.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'OpenClaw', applicationCategory: 'Agent Runtime (retired)' },
        { '@type': 'SoftwareApplication', name: 'Hermes', url: 'https://github.com/NousResearch/hermes-agent', applicationCategory: 'Agent Runtime' },
        { '@type': 'Thing', name: 'Multi-Agent AI Systems' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Hermes, OpenClaw (retired), n8n, Claude API, Telegram, Slack, GitHub, Stripe, Tailscale, systemd, Ollama, MemPalace' },
      citation: [
        { '@type': 'WebPage', name: 'Hermes agent runtime on GitHub', url: 'https://github.com/NousResearch/hermes-agent' },
        { '@type': 'WebPage', name: 'Original blog post: 22-Agent AI Team Architecture (superseded by this case study)', url: 'https://www.joestechsolutions.com/blog/22-agent-ai-team-architecture' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'OpenClaw' },
        { '@type': 'SoftwareApplication', name: 'Hermes', url: 'https://github.com/NousResearch/hermes-agent' },
        { '@type': 'SoftwareApplication', name: 'n8n', url: 'https://n8n.io' },
        { '@type': 'SoftwareApplication', name: 'Claude', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Tailscale', url: 'https://tailscale.com' },
        { '@type': 'SoftwareApplication', name: 'Ollama', url: 'https://ollama.com' },
      ],
    },
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
