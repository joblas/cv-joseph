const _en = {
  slug: 'hermes',
  altSlug: 'openclaw',
  readingTime: '9 min read',
  seo: {
    title: 'I Retired a 22-Agent AI System. Here\'s Why. | Joseph Blas',
    description: 'Case study: how I migrated OpenClaw (22 specialized agents, 4 directors, 1 CTO) to Hermes (composable agents behind a C-suite + VP structure on Ollama Cloud). The lesson: design for composability, not specialization.',
  },
  nav: {
    back: 'cv-joseph.vercel.app',
    breadcrumbHome: 'Home',
    breadcrumbCurrent: 'OpenClaw → Hermes',
  },
  header: {
    kicker: 'Case Study — <a>OpenClaw → Hermes Migration</a>',
    h1: 'I Retired a 22-Agent AI System. Here\'s Why.',
    subtitle: 'How I migrated from OpenClaw (22 specialized agents, 4 directors, 1 CTO) to Hermes (composable agents behind a C-suite + VP structure on Ollama Cloud). The lesson: design for composability, not specialization.',
    date: 'Jun 16, 2026',
    dateISO: '2026-06-16',
  },
  intro: {
    hook: 'I built a 22-agent AI team to run my business. Then I tore it down and built a smaller composable system in its place.',
    body: 'OpenClaw worked. It was 22 specialized agents orchestrated by 4 directors and 1 CTO (Lurkr), 3 model tiers, workflow-automation orchestrated, ran my real business for ~18 months: lead gen, proposals, invoicing, code review, deployments, content pipeline. Every morning at 9AM Pacific I got standup messages from the 4 directors in Telegram. I read them over coffee. It felt like having a team.',
    punchline: 'Then I learned that the team I thought I wanted was the team I actually didn\'t need. The lesson: more agents isn\'t better. Each new agent is a new maintenance burden, a new failure mode, a new coordination cost. I consolidated to Hermes — composable agents behind a C-suite + VP structure on Ollama Cloud. The OpenClaw era is over. The lessons stuck.',
  },
  orgChart: {
    heading: 'The Two Architectures',
    description: 'OpenClaw was hierarchical — a CEO (me), a CTO (Lurkr), four directors, and specialized agents under each. Hermes is executive-led — a CTO, C-suite skills, VPs for Engineering, Infrastructure, and Product, and agents that compose via delegation. The shape changed; the work didn\'t.',
    imgAlt: 'Side-by-side architecture comparison: OpenClaw hierarchical (Joe → Lurkr CTO → 4 directors → 22 specialized agents) vs Hermes executive-led (Joe → Lurkr CTO → C-suite + VPs → workers composing via delegation)',
    imgCaption: 'OpenClaw (left) vs Hermes (right) — same work, different shapes',
    cto: {
      name: 'Lurkr',
      role: 'CTO (OpenClaw era) → now the CTO layer in Hermes',
      model: 'Was Claude Opus 4.6, now routed through Ollama Cloud model selection',
      description: 'In OpenClaw, Lurkr was a dedicated CTO agent. In Hermes, Lurkr (me) is the CTO layer, delegating through C-suite skills and VPs to the agents that do the work.',
    },
    divisions: [
      {
        director: 'Engineering (Nexus)',
        domain: 'Both eras',
        agents: [
          { name: 'code-architect', role: 'System design' },
          { name: 'code-implementer', role: 'Code writing' },
          { name: 'code-reviewer', role: 'PR review' },
          { name: 'debugger', role: 'Failure analysis' },
          { name: 'test-runner', role: 'Test execution' },
          { name: 'security-auditor', role: 'Security sweeps' },
        ],
      },
      {
        director: 'Ops / Business (Chief + Summit)',
        domain: 'Both eras',
        agents: [
          { name: 'monitoring-specialist', role: 'System health' },
          { name: 'sre', role: 'Reliability + on-call' },
          { name: 'finance-tracker', role: 'Invoicing + Stripe' },
          { name: 'sales-outreach', role: 'Lead gen + proposals' },
          { name: 'content-creator', role: 'Blog + social drafts' },
        ],
      },
      {
        director: 'Product (Halfpipe)',
        domain: 'Both eras',
        agents: [
          { name: 'product-manager', role: 'Specs + roadmaps' },
          { name: 'tech-writer', role: 'Documentation' },
          { name: 'ux-researcher', role: 'User research' },
        ],
      },
      {
        director: 'Personal',
        domain: 'Hermes-only',
        agents: [
          { name: 'life-admin', role: 'Calendar, reminders' },
          { name: 'creative-buddy', role: 'Music, art, exploration' },
        ],
      },
    ],
  },
  modelTiers: {
    heading: 'Model Selection — Then vs Now',
    description: 'OpenClaw had 3 fixed tiers. Hermes pins models per job on Ollama Cloud: the main agent, delegated workers, and every scheduled job get the model that fits, backed by a deep fallback chain.',
    tiers: [
      {
        model: 'glm-5.3-flash:cloud (Ollama)',
        role: 'Main agent / default',
        usage: 'Gateway sessions and most scheduled jobs.',
      },
      {
        model: 'kimi-k2.7-code:cloud (Ollama)',
        role: 'Delegated sub-agents',
        usage: 'Spawned worker sessions and coding tasks.',
      },
      {
        model: 'glm-5.3:cloud (Ollama)',
        role: 'Primary fallback / heavy reasoning',
        usage: 'First in the fallback chain.',
      },
      {
        model: 'minimax-m3 · deepseek-v4-pro · gemma4 · qwen3.5 · gpt-oss:20b',
        role: 'Fallback chain',
        usage: 'Resilience when the primary provider degrades.',
      },
    ],
    quote: 'In OpenClaw: 3 tiers, all Claude. In Hermes: models pinned per job on Ollama Cloud — pick what fits the work, not the brand. The result is cheaper and easier to reason about.',
  },
  infrastructure: {
    heading: 'The Infrastructure (mostly unchanged)',
    description: 'The infrastructure carried over almost intact. The runtime changed (OpenClaw → Hermes), but the boring stuff stayed the same. This is what made the migration possible — boring infrastructure is reliable infrastructure, and reliable infrastructure is portable.',
    tools: [
      { name: 'Hermes (NousResearch/hermes-agent)', role: 'Open-source (MIT) agent runtime by Nous Research — composes agents via delegation behind a C-suite + VP structure, with skills, cron jobs, and a memory system' },
      { name: 'Ollama Cloud', role: 'Primary model provider; models pinned per job' },
      { name: 'NVIDIA NIM', role: 'Fallback provider (deepseek-v4-flash)' },
      { name: 'MemPalace', role: 'Persistent memory — wings and drawers with semantic search and a knowledge graph' },
      { name: 'Telegram', role: 'Cron job delivery (morning brief, evening plan, content draft)' },
      { name: 'GitHub', role: 'Code, PRs, CI/CD — both orgs (joestechsolutions for work, joblas for personal)' },
      { name: 'Gmail + Google Calendar', role: 'Client communications and scheduling' },
      { name: 'Stripe', role: 'Invoicing and payments' },
      { name: 'Hermes', role: 'Current multi-agent orchestration' },
      { name: 'Tailscale VPN', role: 'Mesh network connecting all services' },
      { name: 'systemd', role: 'Service management — hermes-gateway, open-design, free-claude-code as user services' },
    ],
    quote: 'Boring infrastructure is reliable infrastructure. Reliable infrastructure is portable infrastructure. The OpenClaw → Hermes migration was possible because the boring stuff didn\'t change.',
  },
  workflows: {
    heading: 'How It Actually Works — Real Workflows',
    description: 'Theory is cheap. Here\'s what happens in practice. These are real workflows running in production today on Hermes. The OpenClaw workflows were similar but used a different runtime; the work was the same.',
    morningStandups: {
      heading: 'Morning Briefs (was Morning Standups)',
      description: 'Every morning at 7:30AM Pacific, the morning_brief cron job fires. It composes via delegation: queries MemPalace for the last 24h of activity, asks the content-creator agent to draft a summary, and delivers it to Telegram. I read it over coffee.',
      imgAlt: 'Telegram morning brief at 7:30AM Pacific — composed by Hermes from overnight activity',
      imgCaption: 'Real morning brief — composed via delegation, not orchestrated by a director',
    },
    leadToInvoice: {
      heading: 'Lead to Invoice Pipeline (was OpenClaw\'s signature workflow)',
      description: 'End-to-end: a lead comes in, gets qualified, turns into a proposal, gets reviewed by me, goes to the client, meeting gets scheduled, work gets done, invoice goes out. The pipeline runs on Hermes now via delegation — sales-outreach → content-creator → product-manager → finance-tracker. The same pipeline that took 22 agents in OpenClaw takes 5 in Hermes.',
      pipeline: [
        { name: 'sales-outreach', detail: 'finds and qualifies the lead' },
        { name: 'content-creator', detail: 'drafts the proposal' },
        { name: 'Joe', detail: 'reviews and approves' },
        { name: 'life-admin', detail: 'schedules the meeting' },
        { name: 'finance-tracker', detail: 'sends the invoice' },
      ],
    },
    engineering: {
      heading: 'Engineering Flow (post-coding pipeline)',
      description: 'Feature requests flow from strategy through development to deployment. code-implementer writes code following the project\'s existing patterns. code-reviewer reviews for bugs and security. The post-coding hook runs security-auditor + test-runner automatically. The jts-pipeline-detect.sh hook auto-spawns the 8-stage JTS pipeline for client work.',
      pipeline: [
        { name: 'product-manager', detail: 'defines the task' },
        { name: 'code-implementer', detail: 'writes the code' },
        { name: 'code-reviewer', detail: 'reviews the PR' },
        { name: 'security-auditor + test-runner', detail: 'automatic post-coding gate' },
        { name: 'sre', detail: 'deploys with monitoring' },
      ],
    },
    content: {
      heading: 'Content Pipeline (joe-content-lane)',
      description: 'content-creator composes blog posts, case studies, social drafts from MemPalace context. tech-writer handles documentation. joe-content-lane skill provides the style guide. The cron cadence (morning brief, evening plan, content draft, security sweep, model bakeoff, weekly reviews) keeps the system running 24/7.',
    },
  },
  whyItMatters: {
    heading: 'Why This Matters (for AI Builders)',
    description: 'The migration story is the strongest signal in this whole portfolio. It demonstrates three things hiring managers look for: systems thinking (specialization vs composability), production engineering (migrated a live system without downtime), and self-awareness (the lesson generalizes). I\'m sharing it because I think more agentic systems will hit the same wall.',
    points: [
      { label: 'More agents isn\'t better.', detail: 'Each new agent is a new maintenance burden, a new failure mode, a new coordination cost. The director layer in OpenClaw solved one problem and created another.' },
      { label: 'Composability beats specialization.', detail: 'Hermes composes the same work with 6 fewer agents. The shape changed; the work didn\'t. That\'s the win.' },
      { label: 'Boring infrastructure is portable.', detail: 'systemd, Tailscale, Telegram. Same stack before and after the migration. Boring let me move fast when I needed to.' },
      { label: 'Migration is a skill, not a crisis.', detail: 'I migrated live production from one architecture to another. Zero downtime. The boring infrastructure made it possible. The lesson generalizes to any system rewrite.' },
    ],
  },
  lessons: {
    heading: 'Lessons Learned',
    items: [
      {
        title: 'Start with the org chart, not the code.',
        detail: 'Knowing who reports to whom — and what decisions each level can make — was more important than any technical choice. The org chart changed; the lesson stuck.',
      },
      {
        title: 'The director layer is overhead, not abstraction.',
        detail: 'In OpenClaw, the 4 directors were supposed to reduce noise. They reduced some, and added their own. The new shape (composable agents) reduced more.',
      },
      {
        title: 'Model selection per task beats tiering.',
        detail: 'OpenClaw had 3 tiers (Opus/Sonnet/Haiku). Hermes uses Ollama Cloud model selection — pick the right model per task. Cheaper AND better-tuned per role.',
      },
      {
        title: 'Boring infrastructure wins.',
        detail: 'systemd, Tailscale, Telegram, GitHub. Nothing fancy. Everything reliable. The exciting part is what the agents do, not how they\'re run.',
      },
      {
        title: 'Document the migration, not just the destination.',
        detail: 'This case study exists because the migration story is more interesting than either era\'s architecture. Hiring managers want to see how you think, not just what you shipped.',
      },
    ],
  },
  faq: {
    heading: 'FAQ',
    items: [
      {
        q: 'What was OpenClaw?',
        a: 'OpenClaw was a 22-agent multi-agent AI system I built and operated from 2024 to early 2026. 22 specialized agents orchestrated by 4 directors and 1 CTO (Lurkr), 3 model tiers (Opus/Sonnet/Haiku), workflow-automation orchestrated. It ran real business operations: email routing, CRM automation, invoicing, SEO optimization, deployment pipelines. It was retired in 2026 when I consolidated to Hermes. The full postmortem is this case study.',
      },
      {
        q: 'What is Hermes?',
        a: 'Hermes is my current AI operations system, replacing OpenClaw — built on Nous Research\'s open-source hermes-agent runtime. Lurkr (me) acts as CTO, with executive skills (Chief of Staff, CFO, COO, CMO), VPs for Engineering, Infrastructure, and Product, and 40+ scheduled automations with models pinned per job on Ollama Cloud. Agents compose via delegation rather than hard-wired specialization. Skills system for reusable patterns. MemPalace for persistent memory across sessions.',
      },
      {
        q: 'Why did you retire OpenClaw?',
        a: 'The OpenClaw architecture solved one problem (manage 22 specialized agents) and created another (you\'re now managing 22 specialized agents). The director layer added overhead. Most tasks needed cross-divisional context that the hierarchy made expensive. Hermes consolidates to general-purpose agents that compose via delegation behind a C-suite + VP structure. Same work, different shape, less overhead.',
      },
      {
        q: 'Did the migration cause downtime?',
        a: 'No. The boring infrastructure (systemd, Tailscale, Telegram, GitHub) carried over intact. The runtime changed (OpenClaw → Hermes) but the services it talked to stayed the same. The new runtime started in parallel, got tested, then the old runtime was retired. Zero downtime for any user-facing service.',
      },
      {
        q: 'What happened to the OpenClaw code?',
        a: 'The OpenClaw agents were retired. Their code lives in this case study (for the postmortem) and in archived branches of joestechsolutions/ai-stack. The new runtime is Nous Research\'s open-source hermes-agent (github.com/NousResearch/hermes-agent); my own one-command installer experiment lives at github.com/joestechsolutions/hermes-forge. The lessons (org chart first, model selection per task, boring infrastructure, document the migration) are encoded in the new architecture.',
      },
      {
        q: 'Can I build something like this for my business?',
        a: 'Yes. Start with one agent doing one thing well — lead qualification, invoice generation, or daily status reports. Get that agent reliable in production before adding a second. The key insight: design for composability from day one. If your second agent can\'t reuse the first agent\'s work, you\'re building OpenClaw. If it can, you\'re building Hermes.',
      },
    ],
  },
  resources: {
    heading: 'Resources',
    items: [
      { label: 'Hermes agent runtime on GitHub (Nous Research)', url: 'https://github.com/NousResearch/hermes-agent' },
      { label: 'MemPalace (memory system)', url: 'https://github.com/joblas/mempalace' },
      { label: 'Anthropic Claude Documentation', url: 'https://docs.anthropic.com' },
      { label: 'Tailscale VPN', url: 'https://tailscale.com' },
      { label: 'n8n Documentation', url: 'https://docs.n8n.io' },
    ],
  },
} as const

export const openclawContent = _en

export type OpenClawContent = typeof openclawContent
