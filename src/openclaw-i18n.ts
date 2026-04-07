export type OpenClawLang = 'es' | 'en'

const _en = {
  slug: 'openclaw',
  altSlug: 'openclaw',
  readingTime: '8 min read',
  seo: {
    title: 'I Built a 22-Agent AI Team to Run My Business — Here\'s the Architecture | Joseph Blas',
    description: '22 specialized AI agents running real business operations 24/7. Org chart, model tiering, infrastructure, and real workflows. Built on OpenClaw.',
  },
  nav: {
    back: 'cv-joseph.vercel.app',
    breadcrumbHome: 'Home',
    breadcrumbCurrent: 'OpenClaw',
  },
  header: {
    kicker: 'Case Study — <a>OpenClaw Multi-Agent System</a>',
    h1: 'I Built a 22-Agent AI Team to Run My Business — Here\'s the Architecture',
    subtitle: '22 specialized AI agents orchestrated across 4 divisions, running real business operations 24/7. Morning standups, lead gen, proposal writing, code reviews, deployments, invoicing — all automated.',
    date: 'Feb 18, 2026',
    dateISO: '2026-02-18',
  },
  intro: {
    hook: 'I run a one-man AI consultancy in San Diego. But I have a team of 22.',
    body: 'They work 24/7. They hold standups every morning. They find leads, write proposals, build code, review PRs, deploy services, send invoices, and create marketing content. They don\'t take PTO. They don\'t have opinions about the office snacks.',
    punchline: 'They\'re AI agents. They report to 4 directors, who report to a CTO (named Lurkr), who reports to me. All of them running in production on OpenClaw — the multi-agent runtime I built to make this work.',
  },
  orgChart: {
    heading: 'The Org Chart',
    description: 'The system is structured like a real company. One CEO (me), one CTO (Lurkr), four directors, and specialized agents under each.',
    imgAlt: 'OpenClaw org chart: Joe at top, Lurkr CTO, 4 directors (Chief, Summit, Nexus, Halfpipe), 16+ agents',
    imgCaption: 'OpenClaw org chart — 22 agents across 4 divisions',
    cto: {
      name: 'Lurkr',
      role: 'CTO',
      model: 'Claude Opus 4.6',
      description: 'Complex reasoning, cross-division coordination, strategic decisions. Lurkr is the brain.',
    },
    divisions: [
      {
        director: 'Chief',
        domain: 'Operations',
        agents: [
          { name: 'Bridge', role: 'Client communications' },
          { name: 'Dispatch', role: 'Calendar and scheduling' },
          { name: 'Ledger', role: 'Invoicing and Stripe' },
        ],
      },
      {
        director: 'Summit',
        domain: 'Business',
        agents: [
          { name: 'Radar', role: 'Lead generation' },
          { name: 'Quill', role: 'Proposals' },
          { name: 'Muse', role: 'Marketing content' },
          { name: 'Compass', role: 'Strategy' },
        ],
      },
      {
        director: 'Nexus',
        domain: 'Engineering',
        agents: [
          { name: 'Forge', role: 'Development' },
          { name: 'Nimbus', role: 'Cloud infrastructure' },
          { name: 'Tensor', role: 'ML and data' },
          { name: 'Sentinel', role: 'Code review' },
          { name: 'Helm', role: 'Deployment' },
        ],
      },
      {
        director: 'Halfpipe',
        domain: 'Skate Workshop',
        agents: [
          { name: 'Kickflip', role: 'Product' },
          { name: 'Grind', role: 'Development' },
          { name: 'Ollie', role: 'QA' },
          { name: 'Canvas', role: 'Design' },
          { name: 'Rail', role: 'Backend' },
          { name: 'Deck', role: 'Marketing' },
        ],
      },
    ],
  },
  modelTiers: {
    heading: 'Model Tiering',
    description: 'Not every agent needs the most expensive model. The tiering strategy is what makes this affordable instead of a money pit.',
    tiers: [
      {
        model: 'Claude Opus 4.6',
        role: 'CTO (Lurkr)',
        usage: 'Complex reasoning, cross-division coordination, strategic decisions',
      },
      {
        model: 'Claude Sonnet 4.5',
        role: 'Directors + most agents',
        usage: 'Day-to-day operations, content generation, code writing, analysis',
      },
      {
        model: 'Claude Haiku',
        role: 'Routine tasks',
        usage: 'Classification, routing, simple transformations — high volume, low cost',
      },
    ],
    quote: 'This tiering is the difference between this being affordable and this being a money pit.',
  },
  infrastructure: {
    heading: 'The Infrastructure',
    description: 'Boring infrastructure is reliable infrastructure. Every tool here was chosen because it\'s proven, self-hostable where it matters, and doesn\'t require babysitting.',
    tools: [
      { name: 'OpenClaw', role: 'Agent runtime — the core orchestration layer' },
      { name: 'Telegram', role: 'Morning standups from directors' },
      { name: 'Slack', role: 'Engineering coordination' },
      { name: 'GitHub', role: 'Code, PRs, CI/CD' },
      { name: 'Gmail + Google Calendar', role: 'Client communications and scheduling' },
      { name: 'Stripe', role: 'Invoicing and payments' },
      { name: 'n8n', role: 'Webhook orchestration' },
      { name: 'Tailscale VPN', role: 'Mesh network connecting all services' },
      { name: 'systemd', role: 'Service management — every agent is a systemd unit' },
    ],
    quote: 'Boring infrastructure is reliable infrastructure.',
  },
  workflows: {
    heading: 'How It Actually Works — Real Workflows',
    description: 'Theory is cheap. Here\'s what happens in practice, every day.',
    morningStandups: {
      heading: 'Morning Standups',
      description: 'Every morning at 9AM Pacific, I get 4 messages in Telegram. One from each director. They summarize what their division did yesterday, what\'s planned today, and any blockers. I read them over coffee.',
      imgAlt: 'Telegram standup messages from 4 AI directors at 9AM Pacific',
      imgCaption: 'Real morning standup — 4 director summaries in Telegram',
    },
    leadToInvoice: {
      heading: 'Lead to Invoice Pipeline',
      description: 'End-to-end: a lead comes in, gets qualified, turns into a proposal, gets reviewed by me, goes to the client, meeting gets scheduled, work gets done, invoice goes out.',
      pipeline: [
        { name: 'Radar', detail: 'finds and qualifies the lead' },
        { name: 'Summit', detail: 'routes to Quill' },
        { name: 'Quill', detail: 'drafts the proposal' },
        { name: 'Joe', detail: 'reviews and approves' },
        { name: 'Bridge', detail: 'sends to client' },
        { name: 'Dispatch', detail: 'schedules the meeting' },
        { name: 'Ledger', detail: 'sends the invoice' },
      ],
    },
    engineering: {
      heading: 'Engineering Flow',
      description: 'Feature requests flow from strategy through development to deployment. Every PR gets reviewed. Every deployment gets monitored.',
      pipeline: [
        { name: 'Compass', detail: 'defines the task' },
        { name: 'Forge', detail: 'writes the code' },
        { name: 'Sentinel', detail: 'reviews the PR' },
        { name: 'Helm', detail: 'deploys' },
        { name: 'Nimbus/Tensor', detail: 'infra + ML support' },
      ],
    },
    content: {
      heading: 'Content Pipeline',
      description: 'Muse creates written content. Canvas handles visuals. Deck coordinates distribution. The content pipeline runs in parallel with everything else.',
    },
  },
  whyItMatters: {
    heading: 'Why This Matters (for Small Business)',
    description: 'This isn\'t about replacing humans. It\'s about what happens when a solo operator gets a team that doesn\'t sleep.',
    points: [
      { label: 'Every agent is specialized.', detail: 'No jack-of-all-trades. Each agent does one thing and does it well.' },
      { label: 'Directors reduce noise.', detail: 'I don\'t manage 22 agents. I manage 4 directors. They manage their teams.' },
      { label: 'Tiered models keep costs sane.', detail: 'Opus for the CTO. Sonnet for directors. Haiku for grunt work. Same logic, different price points.' },
      { label: 'It scales without hiring.', detail: 'Adding a new agent is a config file and a systemd unit. Not a job posting, interview loop, and onboarding plan.' },
    ],
  },
  lessons: {
    heading: 'Lessons Learned',
    items: [
      {
        title: 'Start with the org chart, not the code.',
        detail: 'Knowing who reports to whom — and what decisions each level can make — was more important than any technical choice.',
      },
      {
        title: 'Model tiering is non-negotiable.',
        detail: 'Running Opus for everything would cost 10x more and perform worse. The right model for the right task is the entire game.',
      },
      {
        title: 'Directors are the key abstraction.',
        detail: 'Without the director layer, you\'re managing 22 agents directly. With it, you\'re managing 4. That\'s the difference between a tool and a team.',
      },
      {
        title: 'Boring infrastructure wins.',
        detail: 'systemd, Tailscale, Telegram. Nothing fancy. Everything reliable. The exciting part is what the agents do, not how they\'re run.',
      },
    ],
  },
  faq: {
    heading: 'FAQ',
    items: [
      {
        q: 'How much does this cost to run?',
        a: 'The model tiering keeps it reasonable. Most agents run on Sonnet or Haiku. Only the CTO uses Opus, and only for complex cross-division decisions. Total cost is comparable to one part-time contractor.',
      },
      {
        q: 'What happens when an agent makes a mistake?',
        a: 'Directors catch most issues before they reach me. For anything client-facing (proposals, invoices, emails), there\'s always a human-in-the-loop step. I review before it goes out.',
      },
      {
        q: 'Can I build something like this for my business?',
        a: 'Yes. Start with one agent doing one thing well. Then add a second. The org chart structure scales naturally — you don\'t need 22 agents on day one.',
      },
      {
        q: 'Why not just use ChatGPT / Claude directly?',
        a: 'A single conversation doesn\'t have memory across tasks, can\'t trigger actions in other systems, and can\'t coordinate with other agents. This is the difference between asking an AI a question and having an AI team run operations.',
      },
      {
        q: 'What is OpenClaw?',
        a: 'OpenClaw is the agent runtime I built to orchestrate all of this. It handles agent lifecycle, inter-agent communication, tool access, and the director hierarchy. Think of it as the operating system for the AI team.',
      },
    ],
  },
  resources: {
    heading: 'Resources',
    items: [
      { label: 'Original blog post', url: 'https://www.joestechsolutions.com/blog/22-agent-ai-team-architecture' },
      { label: 'n8n Documentation', url: 'https://docs.n8n.io' },
      { label: 'Anthropic Claude Documentation', url: 'https://docs.anthropic.com' },
      { label: 'Tailscale VPN', url: 'https://tailscale.com' },
    ],
  },
} as const

export const openclawContent = { es: _en, en: _en } as const

export type OpenClawContent = (typeof openclawContent)['en']
