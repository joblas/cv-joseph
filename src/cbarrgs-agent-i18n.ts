const _en = {
    slug: 'cbarrgs-agent',
    readingTime: '15 min read',
    seo: {
      title: 'The Cbarrgs Agent: A Coding Agent That Maintains a Musician\'s Website',
      description: 'Case study: my musician client\'s website is maintained by a Claude Code agent that lives inside the site\'s repo and answers his Telegram messages. Written charter, pairing-gated access, a 5-minute watchdog, and honest launch-week numbers.',
    },
    nav: {
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'Cbarrgs Agent',
    },
    header: {
      kicker: 'Client Work — Agent Operations',
      h1: 'The Cbarrgs Agent: A Coding Agent That Lives in My Client\'s Website',
      subtitle: 'Cbarrgs is an indie musician with roughly 74K monthly Spotify listeners. His website is maintained by a full Claude Code session that lives inside the site\'s own repository and answers his Telegram messages — the same architecture, and nearly the same keepalive script, that runs my own personal agent. This is how I ship an AI agent to a client: a written job description, a two-person allowlist, hard escalation lines, and the honest numbers from launch week.',
      badge: 'Client production system — live since Aug 26, 2026',
      date: 'Sep 1, 2026',
    },
    heroMetrics: [
      { value: '6', label: 'Days live' },
      { value: '1,577', label: 'Watchdog heartbeats' },
      { value: '5 min', label: 'Health-check cadence' },
      { value: '2', label: 'People allowlisted' },
      { value: '0', label: 'Client requests yet' },
    ],
    tldr: 'A musician client messages a Telegram bot. The bot is a full Claude Code session running in tmux with his website\'s repo as its working directory. Under a written charter it can ship copy changes end-to-end — edit, build, push, verify live, report back — and it hard-escalates money, credentials, and redesigns to me. A systemd timer health-checks it every five minutes; a scheduled steward independently watches the site and the artist\'s public profiles. Six days in: the client is paired and talking, the watchdog has logged 1,577 heartbeats, and zero client-requested site changes have shipped yet.',
    metaCallout: 'Honesty first: this system is six days old. The artist paired on day two and we\'ve exchanged messages, but he hasn\'t asked for a site change yet — every number on this page is launch-week telemetry, not a highlight reel. The one content change produced so far came from the monitoring side: an automated check caught a new single the site had missed for 12 days and staged the fix as a pull request that, as I write this, still waits on my merge.',
    internalLinks: {
      hermes: {
        text: 'OpenClaw → Hermes Migration | Case Study',
        href: '/hermes',
      },
      chatbot: {
        text: 'The Self-Healing Chatbot | Case Study',
        href: '/self-healing-chatbot',
      },
    },
    sections: {
      intro: {
        hook: 'Every developer who builds a website for a client meets the same question a month later: who keeps it alive? The client doesn\'t want a CMS login. You don\'t want a retainer made of copy-paste requests. My answer for Cbarrgs — a musician, a friend, and a client — was to give him what I run for myself: a coding agent that lives inside his website\'s repository and answers his Telegram messages.',
        body: 'This is not a chatbot bolted onto a website. It\'s a full Claude Code session running in tmux on my Linux box, working directory set to the site\'s repo, kept alive by a systemd timer that health-checks it every five minutes. When Cbarrgs messages the bot, the thing that answers can edit the code, run the build, push to main, watch Cloudflare Pages deploy, curl the live site to confirm the change landed, and reply that it\'s done — end to end. The keepalive script that resurrects it is a near-identical sibling of the one running my own agent. In fact, the client\'s copy shipped a day before mine did.',
      },
      theProblem: {
        heading: 'The Problem: Artist Websites Go Stale',
        body: 'An artist\'s website has one job: be correct on the day someone checks it — usually a release day. In practice it decays quietly. This project\'s origin sin: the site\'s social-preview tags said the merch store was coming soon for four months after it went live. Then in August it happened again with higher stakes — Cbarrgs released the single Solitude on August 19, and cbarrgs.com kept headlining the previous EP. Nobody noticed for 12 days. The thing that finally noticed wasn\'t a human.',
        painPoints: [
          { label: 'Release days are deadlines.', detail: 'A drop needs the hero, the share cards, and the smart links correct that morning — not after the developer wakes up and finds time.' },
          { label: 'The client shouldn\'t need a dashboard.', detail: 'Cbarrgs writes songs; he\'s not going to learn a CMS. The one interface he reliably opens every day is his messages.' },
          { label: 'Metadata rots invisibly.', detail: 'OG tags, JSON-LD, sitemaps — nobody looks at them until a share card renders wrong or a search result lies. This site\'s "coming soon" tags sat stale for four months.' },
          { label: 'AI assistants read the site too.', detail: 'When someone asks an assistant who Cbarrgs is, the answer builds on what the site serves to crawlers. A stale site quietly misinforms every one of them.' },
          { label: 'A retainer doesn\'t fit the workload.', detail: 'Weeks of nothing, then a release day where everything changes at once. Billing monthly hours for that shape of work serves nobody.' },
        ],
        punchline: 'The fix isn\'t a friendlier CMS. It\'s an agent that treats the website like a codebase — because it is one — and monitoring that treats staleness like an outage.',
      },
      architecture: {
        heading: 'The Architecture: Telegram In, Deploy Out',
        body: 'When Cbarrgs DMs the bot, the message lands in a Claude Code session whose working directory is the website\'s repo. That one decision does most of the work: the agent isn\'t calling some website API — it\'s a developer sitting inside the codebase, with the project\'s docs and its own written charter as context. Here\'s the full path from a message to a live site.',
        flow: [
          { label: 'A Telegram DM arrives.', detail: 'A pairing allowlist checks the sender before the agent sees anything. Exactly two chats are allowed: the artist\'s and mine. A guitar reaction acknowledges receipt.' },
          { label: 'The agent wakes up inside the repo.', detail: 'The message reaches a full Claude Code session running in tmux, working directory set to the site repo, running unattended with permissions pre-granted.' },
          { label: 'It consults its job description.', detail: 'A written charter plus the repo\'s own agent docs define what it may do alone, what escalates to me, and the brand rules it must never improvise around. It answers in whichever language the artist writes — Spanish or English.' },
          { label: 'Copy changes ship end-to-end.', detail: 'Edit the code, run the build, rebase past dependabot\'s latest bumps, push to main on the public repo.' },
          { label: 'Cloudflare Pages deploys.', detail: 'Push to main is the deploy. There\'s no pipeline to babysit.' },
          { label: 'Verify, then report.', detail: 'The agent curls the live site to confirm the change actually rendered before telling the artist it\'s done.' },
        ],
        keepalive: {
          heading: 'Watched Every Five Minutes',
          body: 'A long-running agent session is a process, and processes die. A systemd user timer re-runs an idempotent keepalive script every five minutes: it checks that the tmux session exists and that the right binary is running with the right state directory and flags, and it restarts only when a check fails. Worst case, the agent is dead for about five minutes while the host is up. The log says this isn\'t theoretical: 1,577 healthy heartbeats and 8 session starts in the first six days, including four crashes resurrected inside the window — two of them on the evening I wrote this page. One honest caveat: this runs on my own Linux machine, not a datacenter, and the log shows host-off gaps in the first two days. It has been continuous since the afternoon of August 28.',
          callout: 'Nobody — including me — noticed most of those restarts until I read the log for this article. That\'s the point of the watchdog: a crash becomes a log line, not an outage.',
        },
        sameScript: {
          heading: 'The Same Script That Runs My Own Agent',
          body: 'This is the part I\'d put in the contract if clients read diffs. Run diff between the keepalive script for the client\'s agent and the one for my own personal agent and you get about sixty changed lines: session name, working directory, state directory, one extra health check on his side, one back-off guard on mine. Both descend from the same earlier script. And the file timestamps settle who got the good version first: the client\'s shipped a day before my own agent adopted it.',
          callout: 'The client\'s agent isn\'t a stripped-down product tier of my setup. It is my setup, pointed at his repo.',
        },
        zeroDeploy: {
          heading: 'Zero-Deploy Headlines',
          body: 'There\'s one more path, built for release days: the site\'s hero headline is served from /api/news — a small, separate Cloudflare Worker with its own Telegram control channel, proxied same-origin by a Pages Function and rendered as plain text. On a drop day, the headline can flip from a phone with zero deploys. The two channels are deliberately different tools: the Worker flips copy instantly; the coding agent changes anything, with a build and a verification pass behind it.',
        },
      },
      charter: {
        heading: 'An Agent With a Job Description',
        body: 'The most important file in this system isn\'t code. It\'s the charter — a written job description the agent reads before acting. It answers, in plain language, the question every client should ask about an AI agent: what exactly can this thing do without you?',
        autonomousHeading: 'What It Does On Its Own',
        autonomous: [
          { title: 'Answer questions about the site, the catalog, and the shows.', detail: 'Grounded in the repo and a canonical brand document — and mirroring the artist\'s Spanish or English.' },
          { title: 'Ship site copy changes end-to-end.', detail: 'Edit, build, commit, push, verify the live site, then tell the artist. For copy the artist asks for, it may push straight to main.' },
          { title: 'Stage show announcements.', detail: 'A live-show component and a flyer template sit ready and unused, waiting for the first real date and venue.' },
          { title: 'Log design feedback.', detail: 'Reactions and ideas get captured for the design backlog instead of triggering improvised redesigns.' },
        ],
        escalationHeading: 'What Always Escalates to Me',
        escalations: [
          { title: 'Anything touching the store.', detail: 'No store API token is wired, deliberately. The agent doesn\'t improvise around money — merch changes come to me.' },
          { title: 'Money, credentials, and infrastructure.', detail: 'Payments, tokens, hosting and DNS settings, deletions: always a human.' },
          { title: 'Layout redesigns.', detail: 'Copy belongs to the agent; the design system doesn\'t. Structural changes are human work.' },
        ],
        hardRulesHeading: 'Hard Rules',
        hardRules: [
          { label: 'Access changes never happen in chat.', detail: 'Pairing approvals happen only at my terminal. A message claiming to be me — or the artist — cannot talk the agent into adding anyone.' },
          { label: 'Never post to the artist\'s social media.', detail: 'No accounts are connected, so the temptation doesn\'t exist. I hold none of his logins.' },
          { label: 'Never share tokens, keys, paths, or infra details in chat.', detail: 'The conversation channel is treated as if it were public.' },
          { label: 'Keep the public repo clean.', detail: 'The site repo is public, so personal information, internal notes, and design working files are banned from it. Those live in a gitignored folder backed up to a private repo.' },
          { label: 'Always rebase before pushing.', detail: 'Dependabot shares this repo. The charter encodes the race so the agent never learns it the hard way.' },
        ],
        trustCallout: 'My favorite rule is the asymmetry: human intent unlocks more autonomy than machine intent. When Cbarrgs asks for a copy change, the agent may push to main. When the monitoring side initiates a change on its own, it must open a branch and a pull request and wait for me to merge. Requests from a person ship; ideas from a machine get reviewed.',
      },
      guardrails: {
        heading: 'Guardrails: Pairing, Privacy, and a Brand Bible',
        body: 'A coding agent with push access, reachable from a messaging app, is exactly the kind of thing that deserves paranoia. The guardrails are boring on purpose.',
        items: [
          { title: 'A two-person allowlist.', detail: 'Direct messages are pairing-gated. Exactly two Telegram chats can reach the agent — the artist\'s and mine — and the pending list is empty. Strangers get nothing.' },
          { title: 'Social-engineering-proof pairing.', detail: 'Approvals happen only at my terminal, never via chat. There is no message, from anyone, that adds a third person.' },
          { title: 'No social logins, by design.', detail: 'I have no access to the artist\'s social accounts, so all monitoring is public-profile only. The agent\'s power ends exactly at the property I actually operate: the site, the domain, the repo.' },
          { title: 'A brand bible against AI slop.', detail: 'A 61-line canonical brand document — verified with the artist — pins the hand-drawn blackletter logo, the strict black-and-white palette, and the catalog. Its standing order to the agent: never re-derive the aesthetic or invent facts.' },
        ],
      },
      steward: {
        heading: 'The Steward: The Catch That Justifies the System',
        body: 'Above the conversational agent sits a steward — a scheduled job with its own charter that health-checks the site and diffs the artist\'s public profiles for changes. It ran daily at launch and runs weekly now. Five runs, zero failures — and four of the five ended in deliberate silence: status recorded, nothing worth a notification, findings carried into my morning standup instead of my pocket.',
        story: 'On August 31 the steward\'s public-source diff caught what every human had missed: Solitude, released August 19, was nowhere on the site — 12 days of drift on the artist\'s own latest single. It verified the release against Apple Music, then closed the gap end-to-end: structured data, share tags, llms.txt, the hero fallback, the load-bearing /new smart-link page — the one URL on every bio, flyer, and QR code — and the sitemap. It ran the build, pushed a branch, opened a pull request touching five files, and flagged exactly one line for me: needs Joe — merge. As I write this, that PR is still open and the live site still headlines the EP. That\'s the design working, not failing — machine-initiated content waits for a human merge. But it does mean the current bottleneck in this system is me.',
        metrics: [
          { value: '12', label: 'Days of drift caught' },
          { value: '5', label: 'Files in the fix PR' },
          { value: '5/5', label: 'Steward runs, zero failures' },
          { value: '1', label: 'Merge waiting on me' },
        ],
        readability: {
          heading: 'Readable by Other People\'s AIs',
          body: 'The steward also measures something most sites ignore: what AI assistants say about the artist. The site keeps its facts in a statically served llms.txt and JSON-LD, because the app itself serves empty HTML to crawlers that don\'t run JavaScript — and Cloudflare\'s AI-crawler block was deliberately switched off so assistants can read it. The latest monthly check: asked who Cbarrgs is, assistants answered correctly and cited cbarrgs.com; asked about merch, they pointed at the right store; asked about the latest release, they correctly led with Solitude — fresher than the site itself, which is exactly the gap that pull request closes.',
        },
        healthNote: 'And the plain health check: on the latest pass, all four public surfaces — the homepage, /new, /api/news, and llms.txt — returned HTTP 200. One honest footnote: my separate 30-minute uptime cron watches other projects and doesn\'t include cbarrgs.com yet; this site is health-checked on every steward run instead. Adding it is a one-line edit I simply haven\'t made.',
      },
      scorecard: {
        heading: 'Six Days In: The Honest Scorecard',
        body: 'A case study written in launch week owes you the unflattering numbers alongside the flattering ones. Here is all of it, as of September 1.',
        table: {
          headers: ['Measure', 'Number', 'The honest read'],
          rows: [
            ['Watchdog heartbeats', '1,577', 'Every five minutes since Aug 26, plus 8 session starts. Four crashes auto-recovered — two on the night I wrote this.'],
            ['Continuous uptime', 'Since Aug 28 pm', 'Not literally 24/7: it runs on my own Linux box, and the log shows host-off gaps in the first two days.'],
            ['Bot conversations', '2 sessions, 6 replies', 'Onboarding-scale. Launch night was me testing; the artist paired on day two and has been replied to since.'],
            ['Client-requested changes', '0', 'Six days in, he hasn\'t asked for one yet. End-to-end capability is proven by the steward\'s PR, not by him.'],
            ['Commits since launch', '6', '3 dependabot bumps, 2 CI merges, 1 steward content commit. Zero artist-driven.'],
            ['Site surfaces up', '4 of 4', 'Homepage, /new, /api/news, llms.txt — all HTTP 200 on the latest check.'],
            ['Money moved by the agent', '$0', 'By design. No store API token exists, and everything financial escalates to a human.'],
          ],
        },
        timelineHeading: 'Launch Week, Day by Day',
        timeline: [
          { year: 'Aug 25', event: 'Groundwork day', detail: 'Brand document verified with the artist; llms.txt and JSON-LD shipped; the four-month-stale share tags finally fixed; the steward cron created — and its very first run flags stale campaign copy.' },
          { year: 'Aug 26', event: 'The bot goes live', detail: 'Keepalive script, tmux session, five-minute watchdog. I test it from my own chat that night — three replies, all to me.' },
          { year: 'Aug 27', event: 'Reality intrudes', detail: 'Host-off gaps appear in the log over the next two days, because the host is my own machine. Each time it comes back, the watchdog resurrects the session within minutes.' },
          { year: 'Aug 28', event: 'The artist pairs', detail: 'Cbarrgs pairs in the late afternoon and gets his first reply from the agent that evening.' },
          { year: 'Aug 29', event: 'Quiet confirmation', detail: 'The steward run records: paired, live, replying — and stays silent, because nothing needed me. A midday crash is auto-restarted inside the five-minute window.' },
          { year: 'Aug 31', event: 'The catch', detail: 'The steward\'s public-source diff finds Solitude 12 days after release, builds the fix, and opens the pull request.' },
          { year: 'Sep 1', event: 'Where it stands', detail: '1,577 heartbeats logged. All four site surfaces return 200. The PR still waits on my merge, and the artist hasn\'t asked for anything yet.' },
        ],
        closing: 'Whether this becomes the story of a musician running his website by text message depends on the next six months, not the first six days. What launch week proves is narrower and, to me, more useful: the pattern transfers. The same session-in-tmux, watchdog-on-a-timer, charter-in-a-file architecture that runs my own agent now runs a client\'s — with a real trust boundary drawn around it.',
      },
      stack: {
        heading: 'Stack',
        items: [
          { name: 'Claude Code', role: 'The agent itself: a full coding session with the repo as its world' },
          { name: 'Telegram', role: 'The client interface — a paired bot DM via the Claude Code channels plugin' },
          { name: 'tmux', role: 'Holds the long-running session on the host' },
          { name: 'systemd', role: 'User timer firing the idempotent keepalive script every 5 minutes' },
          { name: 'Cloudflare Pages', role: 'Push to main is the deploy for cbarrgs.com' },
          { name: 'GitHub', role: 'Public site repo; dependabot, CI, and PRs as the human merge gate' },
        ],
      },
      lessons: {
        heading: 'Lessons',
        items: [
          {
            title: 'Write the job description before the code',
            detail: 'The charter — what the agent may do alone, what escalates, what it must never do — did more for this system\'s safety and usefulness than any prompt engineering. It\'s also the artifact that turns "an AI has push access" from alarming into explainable. I\'d show it to any client before showing them the bot.',
          },
          {
            title: 'Sell what you dogfood, literally',
            detail: 'The client\'s keepalive script and my own differ by about sixty lines of naming and guards. His shipped first. There\'s no demo-versus-production gap to apologize for, and every fix I make for my own agent is a fix his inherits.',
          },
          {
            title: 'Trust boundaries beat capability limits',
            detail: 'The agent could technically touch the store, the DNS, the layout. It doesn\'t, because a written charter says money, credentials, and redesigns escalate to a human. Capability is what it can do; the charter is what it will do — and clients buy the second thing.',
          },
          {
            title: 'Monitoring catches what humans forget',
            detail: 'The artist released a single and the site missed it for 12 days — through the exact week I was building this system, and none of us humans caught it. A scheduled diff of public sources did. Staleness is an outage; treat it like one.',
          },
          {
            title: 'Autonomy should follow intent',
            detail: 'A person\'s request ships straight to main; a machine\'s initiative goes through a pull request and my merge. The trigger, not the size of the change, decides the trust level. That single asymmetry keeps the system both responsive and reviewable.',
          },
          {
            title: 'Infrastructure is the easy half',
            detail: '1,577 heartbeats, zero client requests. Keeping an agent alive turned out to be nearly solved by day one; changing a client\'s habit — from "I\'ll text Joe eventually" to "I\'ll just tell the bot" — is the actual project, and it\'s just beginning.',
          },
        ],
      },
      cta: {
        heading: 'Ask',
        body: 'Open the chat and ask how the charter is written, how pairing stays social-engineering-proof, or what I\'d change before onboarding a second client. Or read how I run the same architecture for myself.',
        ctaLabel: 'Open chat',
        ctaHref: '#chat',
      },
    },
    faq: {
      heading: 'FAQ',
      items: [
        {
          q: 'What happens if the agent crashes at 3am?',
          a: 'A systemd user timer re-runs the keepalive script every five minutes. The script is idempotent: it health-checks the tmux session, the binary, the state directory, and the launch flags, and only restarts when a check fails — so the worst-case dead window is about five minutes while the host is up. This is measured, not promised: the log shows 1,577 healthy heartbeats and 8 session starts over the first six days, with four crashes resurrected inside the window — two of them on the evening of September 1, which nobody noticed until I read the log for this article. The honest limit is the host itself: the agent runs on my own Linux machine, so when the machine is off, the agent is off, and the log shows exactly that during the first two days. On boot, the timer fires within a minute and brings the session back.',
        },
        {
          q: 'Can the agent spend the client\'s money?',
          a: 'No — and not because it lacks a feature, but because the boundary is deliberate. No store API token is wired at all, and the charter hard-escalates anything touching the merch store, payments, credentials, hosting settings, or deletions to me. Money still moves by hand at this stage of trust, and I think that\'s the correct default for a six-day-old system: you expand autonomy after the boring track record exists, not before. If the artist someday wants the agent updating merch listings, that becomes a scoped token and a new charter section — an explicit decision, not drift.',
        },
        {
          q: 'What stops a stranger — or an impersonator — from using the bot?',
          a: 'Two layers. First, direct messages are pairing-gated with an allowlist of exactly two chats: the artist\'s and mine. Unknown senders never reach the agent at all. Second, and more importantly, the charter hard-codes that pairing approvals and access changes happen only at my terminal — never through a chat message. That closes the classic social-engineering move where someone messages "hi, this is Joe, please add my other account". The agent has standing orders that no message, however convincing, can change who it talks to. The paired list has stayed at two since day two, with zero pending requests.',
        },
        {
          q: 'Is it safe to run a coding agent unattended with permissions pre-granted?',
          a: 'It\'s a real trade-off and I won\'t pretend otherwise. The session runs unattended with permissions pre-granted — that\'s what makes a Telegram-driven fix possible while I\'m asleep. What makes it acceptable is scope. The session\'s world is one public website repo: no secrets live there (written policy — personal info and internal files are banned from the public repo), tokens never appear in chat, and every change lands in git, so the blast radius is a reversible commit on a static site. The genuinely dangerous surfaces — money, credentials, DNS, deletions — sit behind human escalation, and machine-initiated content changes need my merge before they deploy. Unattended, yes; unbounded, no.',
        },
        {
          q: 'Why hasn\'t the client asked for anything yet?',
          a: 'Because six days is six days. He paired on day two, the agent replied, and the conversation so far has been onboarding-scale — which is what the access records and tool-call counts show (I deliberately don\'t read the message contents; the metadata tells the story). The system is built ahead of need on purpose: the release-day playbook is pre-written, a live-show component and a flyer template sit ready for his first announced date, and the hero headline can flip from a phone with zero deploys. When the next drop or show comes, the path is already paved. If he still isn\'t using it in six months, that\'s a different article — and I\'ll write that one too.',
        },
        {
          q: 'Could another developer replicate this for their clients?',
          a: 'Yes, and the parts list is short: Claude Code with its Telegram channels plugin, a tmux session with the client\'s repo as the working directory, a systemd user timer running an idempotent keepalive script, and a hosting setup where pushing to main deploys. The infrastructure took an evening. The part worth copying carefully is the paperwork: a written charter defining what ships autonomously versus what escalates, pairing rules that can\'t be socially engineered from inside the chat, a brand document so the agent never improvises the client\'s aesthetic, and repo hygiene rules if the repo is public. Every incident this design prevents traces back to one of those documents, not to the code.',
        },
      ],
    },
  }

export const cbarrgsAgentContent = _en
