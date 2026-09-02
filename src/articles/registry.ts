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
  {
    id: 'turnover-agent',
    slug: 'turnover-agent',
    title: 'The Turnover Agent',
    seo: {
      title: 'The Turnover Agent: The Bot a Client Runs His Business On',
      description: 'Case study: a Telegram-first LLM ops agent for a short-term-rental manager — 32 tools, iCal turnover detection, escalation ladders, triple watchdogs.',
    },
    sectionLabels: {
      'the-problem': 'The Problem',
      'architecture': 'Architecture',
      'calendar': 'Calendar Watcher',
      'escalation': 'Dispatch & Escalation',
      'feature-requests': 'Feature Requests',
      'resilience': 'Resilience',
      'security': 'Security',
      'build': 'The Build',
      'numbers': 'Honest Numbers',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'related': 'Related',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/turnover-agent-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/articles/turnover-agent/og-turnover-agent.webp',
    heroImage: 'https://cv-joseph.vercel.app/articles/turnover-agent/hero-turnover-agent.webp',
    component: () => import('../TurnoverAgent.tsx'),
    seoMeta: {
      datePublished: '2026-09-01',
      dateModified: '2026-09-01',
      keywords: ['LLM agent', 'tool calling agent', 'Telegram bot', 'operations agent', 'short-term rental automation', 'turnover management', 'iCal automation', 'Airbnb calendar sync', 'escalation automation', 'FastAPI', 'Supabase', 'self-healing infrastructure', 'LLM fallback chain', 'property management AI', 'client case study', 'AI agent for small business'],
      articleType: 'TechArticle',
      articleTags: 'LLM agent,Telegram,operations,short-term rentals,FastAPI,Supabase,watchdogs,client work',
      images: ['https://cv-joseph.vercel.app/articles/turnover-agent/og-turnover-agent.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'FastAPI', url: 'https://fastapi.tiangolo.com', applicationCategory: 'Web Framework' },
        { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com', applicationCategory: 'Database' },
        { '@type': 'Thing', name: 'LLM Agents' },
        { '@type': 'Thing', name: 'Short-Term Rental Operations' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Python, FastAPI, python-telegram-bot, Supabase, Twilio, Ollama Cloud, Anthropic, Docker, Caddy' },
      citation: [
        { '@type': 'WebPage', name: 'FastAPI Documentation', url: 'https://fastapi.tiangolo.com' },
        { '@type': 'WebPage', name: 'python-telegram-bot Documentation', url: 'https://docs.python-telegram-bot.org' },
        { '@type': 'WebPage', name: 'Supabase Row Level Security Documentation', url: 'https://supabase.com/docs/guides/database/postgres/row-level-security' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'FastAPI', url: 'https://fastapi.tiangolo.com' },
        { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com' },
        { '@type': 'SoftwareApplication', name: 'Twilio', url: 'https://www.twilio.com' },
        { '@type': 'SoftwareApplication', name: 'Docker', url: 'https://www.docker.com' },
        { '@type': 'SoftwareApplication', name: 'Caddy', url: 'https://caddyserver.com' },
        { '@type': 'SoftwareApplication', name: 'Ollama', url: 'https://ollama.com' },
      ],
    },
  },
  {
    id: 'archive-beta-loop',
    slug: 'archive-beta-loop',
    title: 'Archive Beta Loop',
    seo: {
      title: 'The Archive Beta Loop: Client Texts Become Shipped Features',
      description: 'Case study: a client\'s Telegram messages become shipped app features through an always-on agent loop — 20 issues, 13 PRs, median fix in under 14 minutes.',
    },
    sectionLabels: {
      'the-client': 'The Client',
      'the-loop': 'The Loop',
      'guardrails': 'Guardrails',
      'numbers': 'The Numbers',
      'speed': 'Speed, Honestly',
      'one-night': 'One Night',
      'self-healing': 'Self-Healing',
      'what-broke': 'What Broke',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'related': 'Related',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/archive-beta-loop-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/articles/archive-beta-loop/og-archive-beta-loop.webp',
    heroImage: 'https://cv-joseph.vercel.app/articles/archive-beta-loop/hero-archive-beta-loop.webp',
    component: () => import('../ArchiveBetaLoop.tsx'),
    seoMeta: {
      datePublished: '2026-09-01',
      dateModified: '2026-09-01',
      keywords: ['autonomous agent', 'agentic development loop', 'Claude Code', 'AI feedback loop', 'over-the-air updates', 'expo-updates', 'EAS', 'test-driven development', 'human in the loop', 'AI guardrails', 'prompt injection defense', 'self-healing infrastructure', 'beta feedback automation', 'agent pre-authorization', 'Telegram bot feedback', 'solo founder AI'],
      articleType: 'TechArticle',
      articleTags: 'autonomous agents,Claude Code,OTA updates,TDD,guardrails,human-in-the-loop,beta feedback',
      images: ['https://cv-joseph.vercel.app/articles/archive-beta-loop/og-archive-beta-loop.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
        { '@type': 'SoftwareApplication', name: 'Expo Application Services', url: 'https://expo.dev', applicationCategory: 'Mobile CI/CD' },
        { '@type': 'Thing', name: 'Autonomous Software Delivery' },
        { '@type': 'Thing', name: 'Human-in-the-Loop AI' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Telegram, GitHub, EAS, expo-updates, Supabase, Jest, tmux, systemd' },
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Expo', url: 'https://expo.dev' },
        { '@type': 'SoftwareApplication', name: 'Supabase', url: 'https://supabase.com' },
        { '@type': 'SoftwareApplication', name: 'Telegram', url: 'https://telegram.org' },
        { '@type': 'SoftwareApplication', name: 'GitHub', url: 'https://github.com' },
        { '@type': 'SoftwareApplication', name: 'Jest', url: 'https://jestjs.io' },
      ],
    },
  },
  {
    id: 'cbarrgs-agent',
    slug: 'cbarrgs-agent',
    title: 'The Cbarrgs Agent',
    seo: {
      title: 'The Cbarrgs Agent: A Coding Agent That Maintains a Musician\'s Website',
      description: 'Case study: a musician\'s website maintained by a coding agent living in the repo — Telegram-paired, charter-governed, self-healing every 5 minutes.',
    },
    sectionLabels: {
      'the-problem': 'The Problem',
      'architecture': 'Architecture',
      'charter': 'The Charter',
      'guardrails': 'Guardrails',
      'steward': 'The Steward',
      'scorecard': 'Six Days In',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'related': 'Related',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/cbarrgs-agent-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/articles/cbarrgs-agent/og-cbarrgs-agent.webp',
    heroImage: 'https://cv-joseph.vercel.app/articles/cbarrgs-agent/hero-cbarrgs-agent.webp',
    component: () => import('../CbarrgsAgent.tsx'),
    seoMeta: {
      datePublished: '2026-09-01',
      dateModified: '2026-09-01',
      keywords: ['AI agent for clients', 'Claude Code agent', 'Telegram bot agent', 'website maintenance automation', 'coding agent', 'AI agent operations', 'agent charter', 'artist website', 'musician website', 'systemd watchdog', 'tmux', 'Cloudflare Pages', 'agent guardrails', 'llms.txt', 'AI for small business'],
      articleType: 'TechArticle',
      articleTags: 'AI agents,client work,Claude Code,Telegram,tmux,systemd,Cloudflare Pages,guardrails',
      images: ['https://cv-joseph.vercel.app/articles/cbarrgs-agent/og-cbarrgs-agent.webp'],
      about: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai', applicationCategory: 'AI Agent' },
        { '@type': 'Thing', name: 'AI Agent Operations' },
        { '@type': 'Thing', name: 'Website Maintenance Automation' },
      ],
      extra: { proficiencyLevel: 'Expert', dependencies: 'Claude Code, Telegram, tmux, systemd, Cloudflare Pages, GitHub' },
      citation: [
        { '@type': 'WebPage', name: 'cbarrgs.com — the live artist site', url: 'https://cbarrgs.com' },
        { '@type': 'WebPage', name: 'Anthropic Claude Code Documentation', url: 'https://docs.anthropic.com/en/docs/claude-code' },
      ],
      mentions: [
        { '@type': 'SoftwareApplication', name: 'Claude Code', url: 'https://claude.ai' },
        { '@type': 'SoftwareApplication', name: 'Telegram', url: 'https://telegram.org' },
        { '@type': 'SoftwareApplication', name: 'tmux', url: 'https://github.com/tmux/tmux' },
        { '@type': 'SoftwareApplication', name: 'systemd', url: 'https://systemd.io' },
        { '@type': 'SoftwareApplication', name: 'Cloudflare Pages', url: 'https://pages.cloudflare.com' },
      ],
      relatedLink: 'https://github.com/joblas/cbarrgs-vibe-haven',
    },
  },
{
    id: 'skate-workshop-loop',
    slug: 'skate-workshop-loop',
    title: 'The Skate Workshop Loop',
    seo: {
      title: 'Relighting a Dead Agent Loop: The Skate Workshop, Round Two',
      description: 'Case study: relighting a dead Slack agent loop — what v1\'s zombie bot taught, and the verified round-two rewire into the live TestFlight build.',
    },
    sectionLabels: {
      'the-loop': 'The Loop',
      'dead-loop': 'The Dead Loop',
      'github-half': 'The Half That Worked',
      'the-audit': 'The Audit',
      'the-relight': 'The Relight',
      'current-state': 'Where It Stands',
      'lessons': 'Lessons',
      'faq': 'FAQ',
      'related': 'Related',
    },
    type: 'case-study',
    ragReady: true,
    i18nFile: 'src/skate-workshop-loop-i18n.ts',
    ogImage: 'https://cv-joseph.vercel.app/articles/skate-workshop-loop/og-skate-workshop-loop.webp',
    heroImage: 'https://cv-joseph.vercel.app/articles/skate-workshop-loop/hero-loop-diagram.webp',
    component: () => import('../SkateWorkshopLoop.tsx'),
    seoMeta: {
      datePublished: '2026-09-02',
      dateModified: '2026-09-02',
      keywords: ['agentic development loop', 'Claude Code', 'Slack bot', 'Supabase edge functions', 'GitHub Actions', 'OTA updates', 'Expo EAS Update', 'bug triage automation', 'webhook security', 'HMAC signature verification', 'human in the loop', 'React Native', 'TestFlight beta', 'agent ops', 'dead loop postmortem'],
      articleType: 'TechArticle',
      articleTags: 'agent loop,Claude Code,Slack,Supabase,edge functions,OTA,CI/CD,HITL',
      images: ['https://cv-joseph.vercel.app/articles/skate-workshop-loop/og-skate-workshop-loop.webp'],
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
