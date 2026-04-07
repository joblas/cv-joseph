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
    description: 'Boring infrastructure is reliable infrastructure. Every tool here was chosen because it\'s proven, self-hostable where it matters, and doesn\'t require babysitting. The stack runs on a single Linux server behind Tailscale — no Kubernetes, no cloud functions, no managed services that bill per invocation. Each agent is a systemd unit with automatic restart on failure, structured logging to journald, and resource limits via cgroups. The entire stack can be redeployed from a git push in under 90 seconds.',
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
    description: 'Theory is cheap. Here\'s what happens in practice, every day. These are real workflows running in production — not demos, not proofs of concept. Each one has been refined through months of daily operation.',
    morningStandups: {
      heading: 'Morning Standups',
      description: 'Every morning at 9AM Pacific, I get 4 messages in Telegram. One from each director. They summarize what their division did yesterday, what\'s planned today, and any blockers. I read them over coffee.',
      imgAlt: 'Telegram standup messages from 4 AI directors at 9AM Pacific',
      imgCaption: 'Real morning standup — 4 director summaries in Telegram',
    },
    leadToInvoice: {
      heading: 'Lead to Invoice Pipeline',
      description: 'End-to-end: a lead comes in, gets qualified, turns into a proposal, gets reviewed by me, goes to the client, meeting gets scheduled, work gets done, invoice goes out. The entire pipeline runs autonomously with one human checkpoint — my approval on the proposal. Average time from lead to sent proposal: under 30 minutes, compared to 2-3 hours when I did it manually.',
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
      description: 'Feature requests flow from strategy through development to deployment. Every PR gets reviewed. Every deployment gets monitored. Forge writes code following the project\'s existing patterns and conventions. Sentinel reviews for bugs, security issues, and style violations. Helm handles zero-downtime deployments with automatic rollback on health check failures.',
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
      description: 'Muse creates written content — blog posts, case studies, social media drafts. Canvas handles visuals — diagrams, social cards, OG images. Deck coordinates distribution across channels and schedules publication. The content pipeline runs in parallel with everything else, producing a steady stream of marketing material without me writing a single word. I review and approve before anything goes live, but the creative heavy lifting is handled.',
    },
  },
  whyItMatters: {
    heading: 'Why This Matters (for Small Business)',
    description: 'This isn\'t about replacing humans. It\'s about what happens when a solo operator gets a team that doesn\'t sleep. The real value isn\'t any single agent — it\'s the compound effect of 22 specialized agents working together around the clock. While I sleep, agents are monitoring infrastructure, processing overnight inquiries, and preparing my morning briefing.',
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
        a: 'The model tiering strategy is what makes the system economically viable. The 16 worker agents handle routine tasks on Claude Haiku — classification, routing, simple data transformations — at fractions of a cent per operation. The four directors and most specialized agents run on Claude Sonnet for day-to-day operations including content generation, code writing, proposal drafting, and analysis. Only the CTO agent Lurkr uses Claude Opus, and only for complex cross-division decisions that require multi-step reasoning across the full organizational context. If every agent ran on Opus, monthly costs would be approximately ten times higher with minimal quality improvement on routine tasks. The total monthly cost across all 22 agents is comparable to one part-time contractor, while delivering around-the-clock availability across every business function simultaneously.',
      },
      {
        q: 'What happens when an agent makes a mistake?',
        a: 'The director layer is the first line of defense. Each division director agent reviews outputs from its team before anything propagates upstream. If a worker agent produces an output that fails validation — malformed data, confidence below threshold, or a flagged anomaly — the director either retries with adjusted parameters or escalates to the CTO agent. For client-facing actions like proposals, invoices, and outbound emails, there is always a human-in-the-loop checkpoint: the agent drafts, I approve. Every agent action is logged with full input/output traces, and alerts fire on error rates exceeding baseline. Critical failures trigger an automatic pause on that agent\'s queue until I review. The hierarchy means most errors are caught two levels before they could reach a customer, and the logging gives me a complete audit trail to diagnose root causes.',
      },
      {
        q: 'Can I build something like this for my business?',
        a: 'Yes, and the key lesson is to start small. Begin with one agent doing one thing well — lead qualification, invoice generation, or daily status reports. Get that agent reliable in production before adding a second. The org chart structure scales naturally because each new agent slots into an existing division under a director, inheriting the communication patterns and escalation paths already established. You do not need 22 agents on day one. I started with three: a lead qualifier, a proposal drafter, and a deployment agent. The director layer came when managing individual agents became overhead. The infrastructure requirements are minimal: a Linux server, systemd for process management, and Tailscale for secure networking. Most of the investment is in designing clear agent responsibilities and the inter-agent communication contracts.',
      },
      {
        q: 'Why not just use ChatGPT / Claude directly?',
        a: 'A single ChatGPT or Claude conversation has no persistent memory across sessions, cannot trigger actions in external systems like Stripe or GitHub, cannot coordinate with other AI instances, and loses all context when you close the browser tab. Using ChatGPT for business operations is like hiring an employee who forgets everything at the end of each shift and has no access to any company tools. OpenClaw agents have persistent state across sessions, authenticated access to production systems through tool integrations, structured inter-agent communication via the director hierarchy, and automatic restart on failure via systemd. When Radar finds a lead, it passes structured data to Summit, who routes it to Quill, who drafts using templates and client history. That multi-step orchestration across specialized agents with shared context is fundamentally impossible in a single conversation interface.',
      },
      {
        q: 'What is OpenClaw?',
        a: 'OpenClaw is the custom agent runtime I built to orchestrate the entire 22-agent system. It handles the complete agent lifecycle: initialization with role-specific system prompts, health monitoring with automatic restart on failure, and graceful shutdown during deployments. Inter-agent communication flows through structured message passing with typed payloads, routed through the director hierarchy so worker agents never communicate directly across divisions. Each agent has a declared set of tool permissions — Forge can access GitHub but not Stripe, Ledger can access Stripe but not GitHub — enforcing least-privilege access across the organization. The director hierarchy is encoded in the runtime configuration: escalation paths, approval requirements, and delegation rules are all declarative. Think of OpenClaw as the operating system for the AI team, handling the same concerns as Kubernetes handles for containers: scheduling, networking, health checking, and access control.',
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

export const openclawContent = _en

export type OpenClawContent = typeof openclawContent
