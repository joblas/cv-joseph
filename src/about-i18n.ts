export type AboutLang = 'es' | 'en'

const _en = {
    slug: 'about',
    altSlug: 'sobre-mi',
    seo: {
      title: 'Joseph Fernández de Valderrama | AI Product Manager & Solutions Architect',
      description: 'Spanish tech entrepreneur, AI Product Manager and Solutions Architect. Founded Joe\'s Tech Solutions (30,000+ repairs). Builds production AI systems.',
    },
    heading: 'Joseph Fernández de Valderrama',
    subtitle: 'AI Product Manager · Solutions Architect · AI Forward Deployed Engineer',
    location: 'Seville, Spain',
    lastUpdated: 'March 2026',
    bio: [
      'Spanish tech entrepreneur with 16+ years building products. Founded Joe\'s Tech Solutions in 2009, scaling it to 30,000+ repairs with AI-powered automation achieving 90% self-service before selling the business in 2025.',
      'Now builds production AI systems: the omnichannel AI agent Jacobo (n8n + ElevenLabs + tool calling), a Self-Healing Chatbot with 71 automated evals and 6-layer jailbreak defense, Career-Ops (a multi-agent job search system with 631 evaluations), and a custom Business OS with 12 Airtable bases and 2,100 fields.',
      'Certified by Anthropic (Claude Code, MCP, AI Fluency, Teaching AI Fluency) and Airtable (Builder, Admin, AI App Builder). Teaching Fellow at Maven AI Product Academy.',
    ],
    seeking: 'Seeking senior remote roles in EU/USA',
    roles: ['AI Product Manager', 'Solutions Architect (No/Low-Code & AI)', 'AI Forward Deployed Engineer'],
    timelineHeading: 'Experience',
    timeline: [
      { period: '2009–2025', role: 'Founder & Product Lead', company: 'Joe\'s Tech Solutions', desc: '30,000+ repairs, 90% AI self-service, exit in 2025' },
      { period: '2024–2025', role: 'Airtable Consultant', company: 'LICO Cosmetics', desc: 'D2C architecture with Airtable for cosmetics brand' },
      { period: '2007–2009', role: 'Test Coordinator', company: 'Everis / NTT DATA', desc: 'Analyst, medical coding thesaurus with RL' },
    ],
    projectsHeading: 'Projects',
    projects: [
      { name: 'Self-Healing Chatbot', desc: 'Production LLMOps with 71 evals, 6-layer defense, agentic RAG', href: '/self-healing-chatbot' },
      { name: 'AI Agent Jacobo', desc: 'Omnichannel AI agent with sub-agents, 90% self-service', href: '/ai-agent-jacobo' },
      { name: 'Career-Ops', desc: 'Multi-agent job search system, 631 evaluations', href: '/career-ops-system' },
      { name: 'Business OS', desc: 'Custom ERP with 12 Airtable bases, 2,100 fields, 50+ automations', href: '/business-os-for-airtable' },
      { name: 'Programmatic SEO', desc: '4,730 pages from Airtable as headless CMS, 2M+ impressions', href: '/programmatic-seo' },
    ],
    certificationsHeading: 'Certifications',
    certifications: [
      { org: 'Anthropic', items: ['Claude Code in Action', 'Introduction to MCP', 'Advanced MCP Topics', 'Building with the Claude API', 'AI Fluency (incl. Teaching)'] },
      { org: 'Airtable', items: ['AI App Builder', 'Builder Certification', 'Admin Certification'] },
      { org: 'Make Academy', items: ['Make Advanced'] },
    ],
    educationHeading: 'Education',
    education: [
      'Maven — AI Product Management Bootcamp (Teaching Fellow)',
      'BIGSEO — Master in Artificial Intelligence',
      'BIGSEO — Master in SEO',
      'ETSI — Universidad de Sevilla',
    ],
    pressHeading: 'Press',
    press: [
      { title: 'Salir de compras: Una solución exprés para el teléfono', publisher: 'Diario de Sevilla', date: '2014', href: 'https://www.diariodesevilla.es/vivirensevilla/Salir-compras-solucion-expres-telefono_0_817718799.html' },
    ],
    communityHeading: 'Community',
    community: [
      { title: 'I automated my job search with AI agents (516+ upvotes)', platform: 'Reddit r/SideProject', href: 'https://www.reddit.com/r/SideProject/comments/1rw1lg4/' },
      { title: 'How I Built an AI Agent That Handled 90% of Customer Requests', platform: 'Dev.to', href: 'https://dev.to/joblas/how-i-built-an-ai-agent-that-handled-90-of-customer-requests-without-human-intervention-4pci' },
      { title: 'I Built a Multi-Agent Job Search System with Claude Code', platform: 'Dev.to', href: 'https://dev.to/joblas/i-built-a-multi-agent-job-search-system-with-claude-code-631-evaluations-12-modes-2cd0' },
    ],
    faqHeading: 'Frequently Asked Questions',
    faq: [
      { q: 'Who is Joseph Fernández de Valderrama?', a: 'Joseph Fernández de Valderrama (also known as santifer) is a Spanish tech entrepreneur, AI Product Manager, and Solutions Architect based in Seville, Spain. He founded Joe\'s Tech Solutions in 2009, scaling it to 30,000+ mobile device repairs with AI-powered automation that achieved 90% self-service. He sold the business in 2025 as a going concern. He now builds production AI systems: multi-agent orchestration with n8n and ElevenLabs, self-healing chatbots with automated evaluations and prompt injection defense, LLMOps tooling with Langfuse, and agentic RAG with Supabase pgvector. He is certified by Anthropic in Claude Code, MCP, and AI Fluency, and by Airtable as Builder and Admin. He serves as Teaching Fellow at Maven AI Product Academy. His full portfolio is at cv-joseph.vercel.app.' },
      { q: 'What has Joseph built?', a: 'Joseph has built five major production AI systems. Jacobo is an omnichannel AI agent handling WhatsApp, voice (ElevenLabs), and phone calls with specialized sub-agents, achieving 90% self-service. The Self-Healing Chatbot is a production LLMOps system with 71 automated evals, 6-layer jailbreak defense, agentic RAG with Supabase pgvector, and a closed-loop that generates tests from real production failures. Career-Ops is a multi-agent job search system with 631 evaluations, 10-dimension scoring, and ATS-optimized AI resume generation using Playwright and Puppeteer. The Business OS is a custom ERP with 12 Airtable bases, 2,100 fields, and 50+ automations powered by n8n. His Programmatic SEO engine generated 4,730 static pages from Airtable as a headless CMS, driving 2M+ impressions on Google.' },
      { q: 'What certifications does Joseph have?', a: 'Joseph holds 12 professional certifications from three organizations. From Anthropic: Claude Code in Action, Introduction to Model Context Protocol, Advanced MCP Topics, Building with the Claude API, AI Fluency Framework and Foundations, Teaching AI Fluency, AI Fluency for Educators, and AI Fluency for Students. From Airtable: AI App Builder Certification, Airtable Builder Certification, and Airtable Admin Certification (earned 2024-2025). From Make Academy: Make Advanced (2024). He also serves as Teaching Fellow at the AI Product Management Bootcamp at Maven, led by Marily Nika (ex-Google PM), where he assists in training product managers on AI integration.' },
    ],
    connectHeading: 'Connect',
    email: 'hi@cv-joseph.vercel.app',
  }

export const aboutContent = { es: _en, en: _en } as const
