const _en = {
    slug: 'turnover-agent',
    readingTime: '14 min read',
    seo: {
      title: 'The Turnover Agent: The Bot a Client Runs His Business On',
      description: 'Case study: a Telegram-first LLM ops agent for a short-term-rental manager — 32 tools, iCal turnover detection, escalation ladders, triple watchdogs.',
    },
    nav: {
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'Turnover Agent',
    },
    header: {
      kicker: 'Client Case Study',
      h1: 'The Turnover Agent: The Bot My Client Files Feature Requests Into',
      subtitle: 'Nick manages short-term rentals. His day-to-day operation — spotting checkouts, scheduling cleans, lock codes, guest questions, even his feature requests to me — now runs through one Telegram bot backed by a 32-tool LLM agent. Five-plus weeks in production, 38 days of server uptime, and every number in this article re-verified against the live system the day before publishing.',
      badge: 'Live in production — 5+ weeks',
      date: 'Sep 1, 2026',
    },
    heroMetrics: [
      { value: '32', label: 'Agent tools' },
      { value: '38', label: 'Days server uptime' },
      { value: '19', label: 'Turnovers auto-created' },
      { value: '9', label: 'Feature requests via bot' },
      { value: '3', label: 'LLM providers in chain' },
    ],
    tldr: 'The Turnover Agent is a Telegram-first operations agent I built for Nick, a short-term-rental property manager. It watches his Airbnb/VRBO calendars on a 15-minute iCal poll, auto-creates turnovers, carries a ranked cleaner-dispatch and escalation ladder, answers guests in a restricted concierge mode, and lets Nick file feature requests by just telling the bot — 9 real requests so far, three shipped within about a day. It has run for over five weeks on one Docker container with triple-layer watchdogs and a multi-provider LLM fallback chain.',
    metaCallout: 'Truth policy: every number on this page was re-derived from the live system on Sep 1, 2026 — read-only SQL against the production database, SSH to the server, git log, and the watchdog\'s own log file. Where the honest number is small (19 turnovers, 1 real cleaner, 0 escalations fired), I printed the small number. Where a number couldn\'t be verified — revenue, message volume — it isn\'t here.',
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
        hook: 'Most client projects end with a handoff. This one ended with my client moving in. Nick runs short-term rentals, and his operation — spotting checkouts, scheduling cleans, lock codes, guest questions — now flows through a Telegram bot backed by an LLM agent with 32 tools. When Nick wants the product to change, he doesn\'t email me. He tells the bot. The bot writes his request to the database and pings my phone. Nine of those requests are sitting in production right now, and three of them shipped as code within about a day of being filed.',
        body: 'This is a case study of a small, real system: one Docker container on a VPS, FastAPI plus a Telegram polling loop, Supabase Postgres, an iCal poller on a 15-minute timer, an escalation checker on a 5-minute timer. It has been live for over five weeks. Some of it is battle-tested — the self-healing layer has already saved the app once at 4:45am with nobody awake. Some of it isn\'t — the cleaner-dispatch ladder is built and drilled but has never fired for real. I\'ll be precise about which is which.',
      },
      theProblem: {
        heading: 'The Problem',
        body: 'Nick\'s problem statement fits in one line, and it\'s the first line of the README: guest checks out of Airbnb → agent detects it → texts the cleaner → tracks confirmation → escalates if needed → tells Nick when it\'s done. Before this system, that whole chain was Nick\'s brain, Nick\'s calendar app, and Nick\'s thumbs.',
        painPoints: [
          { label: 'Calendar watching.', detail: 'Airbnb and VRBO publish iCal feeds, but nobody refreshes a calendar every 15 minutes. Miss a checkout and the next guest walks into an uncleaned unit.' },
          { label: 'Cleaner coordination.', detail: 'Offers, confirmations, no-shows, and are-you-done-yet — all over SMS, all manual.' },
          { label: 'Lock codes.', detail: 'Code changes need confirming. An unconfirmed code is a locked-out cleaner or an open door.' },
          { label: 'Guest questions.', detail: 'A late-checkout request needs a calendar answer, not a vibe.' },
          { label: 'Tool fatigue.', detail: 'Property-management SaaS assumes everyone installs an app. Nick\'s cleaners won\'t, and his guests definitely won\'t.' },
        ],
        punchline: 'Nobody downloads an app. Nick talks to the bot in plain English on Telegram, cleaners get ordinary text messages, guests get a concierge chat. The interface is whatever everyone already has.',
        whyNotN8n: {
          heading: 'Why Not n8n',
          body: 'The first version was an n8n workflow. It was good for testing the concept and wrong for a client-facing product — I wrote that verdict into the plan doc before rebuilding, and I stand by it. A prototype that proves an idea and a system a client runs a business on are different animals. The rest of this article is about the second one.',
        },
      },
      architecture: {
        heading: 'One Container, 32 Tools',
        body: 'The whole system is one Docker container on a Hostinger VPS, with Caddy on the host terminating HTTPS. Inside: FastAPI serves the dashboard, auth, webhooks, and a deep health endpoint; a python-telegram-bot polling loop is the bot; two in-process asyncio loops hit the iCal poller every 15 minutes and the escalation checker every 5. Nick\'s messages run through an LLM agent loop that calls 32 tools against Supabase Postgres — the data lives off-box, so a dead server loses zero client data. It\'s deliberately unfancy: no Kubernetes, no queues, no microservices. One process you can hold in your head.',
        toolFamilies: [
          { title: 'Properties & cleaners.', detail: 'CRUD for properties and the cleaner roster, per-property FAQs, lock codes, cleaner rankings.' },
          { title: 'Turnovers & dispatch.', detail: 'Create and track turnovers, dispatch cleaners in ranked order, track confirmations.' },
          { title: 'Live timing knobs.', detail: 'Nick tunes his own escalation windows by chatting — response and confirmation timers accept 5 to 120 minutes, range-checked inside the tool.' },
          { title: 'Ops & self-service.', detail: 'Health checks, settings, and the feature-request line that gives this article its title.' },
        ],
        guest: {
          heading: 'Guest Concierge Mode',
          body: 'Unknown Telegram users never touch the manager toolset. They\'re routed to a separate system prompt — a friendly concierge that introduces itself as built by Nick and his buddy Joe — with exactly one tool: check_extension_availability, which answers late-checkout questions from the real calendar. The restricted toolset is the security model: a guest physically cannot invoke property management, because those tools aren\'t in their context.',
        },
      },
      calendar: {
        heading: 'The Calendar Watcher',
        body: 'Every 15 minutes, the poller fetches each property\'s Airbnb/VRBO iCal export and turns raw calendar events into work:',
        steps: [
          { label: 'Fetch.', detail: 'Pull each property\'s iCal feed and scan 30 days ahead.' },
          { label: 'Detect checkouts.', detail: 'Every reservation end is a potential turnover.' },
          { label: 'Pair.', detail: 'Match each checkout with the next check-in — but only if it lands within 2 days, because a checkout with no imminent arrival isn\'t urgent.' },
          { label: 'Normalize.', detail: 'All-day events get the industry defaults: 11am checkout, 3pm check-in.' },
          { label: 'Dedupe and create.', detail: 'New pairs become turnover records automatically; re-polls never double-create.' },
        ],
        results: '19 turnovers have been auto-created this way between Jul 26 and Aug 31 — every one of them from a calendar Nick didn\'t have to watch.',
        honestCallout: 'The part I trust least, in my client\'s words: on Aug 13, Nick reported through the bot that a stay \'isn\'t showing up or updating\'. And 7 of the 19 turnovers carry status \'missed\'. iCal feeds sync late, and my poller inherits every one of their delays. I won\'t claim this catches every checkout — the database says it hasn\'t.',
      },
      escalation: {
        heading: 'Escalation Ladders That Have Never Fired',
        body: 'Every 5 minutes, a checker walks the escalation rules. This is the part of the system that exists for bad days: cleaners who don\'t answer, codes that don\'t get confirmed, cleans that run long, people who confirm and then vanish.',
        ladder: [
          { condition: 'Cleaner doesn\'t respond in time', action: 'The offer expires after a configurable window (default 30 minutes; Nick can set 5–120 by chatting) and moves to the next cleaner in ranked order.' },
          { condition: 'Lock-code change unconfirmed', action: 'Escalates to Nick once the confirmation window passes.' },
          { condition: 'Clean running past 3 hours', action: 'Flagged for attention.' },
          { condition: 'Cleaner confirmed, then silent for 4 hours', action: 'Turnover marked escalated and Nick gets a Telegram alert.' },
          { condition: 'Container restarts mid-flow', action: 'A startup-resume pass picks up stale dispatch state, so a reboot can\'t orphan a turnover.' },
        ],
        honestCallout: 'Now the honest part: zero escalations and zero automatic cleaner dispatches have ever fired in production. Not because the code is broken — because Nick currently does his own cleans. Self-clean mode is a real setting he asked for, and while it\'s on, the bot notifies him instead of dispatching a crew. The ladder was drilled at launch and it waits, unused. He added his first real cleaner to the roster on Aug 31, so its day is probably coming — but I\'m not going to pretend it\'s battle-tested when every escalated_at in the database is NULL.',
      },
      featureRequests: {
        heading: 'The Client Files Feature Requests Into the Bot',
        body: 'This is my favorite part of the system, and it cost maybe an hour to build. When Nick says \'it\'d be nice if the bot could...\', the agent calls a tool: the request lands in a feature_requests table and my phone buzzes with an instant DM — app request #N from Nick. He can ask the bot to list his requests and their status any time. Support tickets, roadmap, and client comms collapsed into one chat he was already in.',
        tools: [
          { name: 'request_app_change', desc: 'Logs the request to the database and DMs me immediately through the same bot.' },
          { name: 'list_app_change_requests', desc: 'Lets Nick review everything he has asked for, with status.' },
        ],
        stats: 'Nine real requests sit in the production database, filed between Jul 26 and Aug 31 — the first one landed the morning after launch night. Three of them (a self-clean-mode bug, a guest late-checkout calendar lookup, and killing dead-end \'I can\'t do that\' replies) shipped as a single commit within about a day of being filed — two in roughly 22 hours. The rest range from a weekly per-property earnings summary to a duplicate-cleaner cleanup he filed on Aug 31; the duplicates were already gone from the table when I audited the next day. Even the commercial conversation happens in there: request #19 is Nick asking what this all costs. As of late August we were still settling the price — which is exactly why you\'ll find no revenue or margin numbers in this article.',
        honestCallout: 'One more honest wart: all nine requests still read status \'open\' in the database. I ship the fixes; I\'ve just never once flipped the status field. The feature-request pipeline works better than my bookkeeping of it.',
        stillUsing: 'And the loop is still live: two days before this audit, Nick added a second property and his first real cleaner — through the bot, a month after launch.',
      },
      resilience: {
        heading: 'Three Watchdogs Deep',
        llm: {
          heading: 'The LLM Chain',
          body: 'The agent\'s brain is a three-leg fallback chain: glm-5.2 on Ollama Cloud as primary, gpt-oss:120b on the same key as the second try, and Anthropic\'s claude-opus-4-8 as the last resort. If all three fail, the bot doesn\'t go silent — it says \'I\'m having trouble connecting to my brain right now\', which is a far better client experience than a timeout. Full honesty: the Anthropic leg is currently dead in practice because that org holds no API credits, so today it\'s a two-provider chain with a third leg on paper. And crucially, the deterministic backbone doesn\'t care — calendar polling and escalation checks are plain Python on timers, and they keep running through any LLM outage.',
        },
        layers: [
          { title: 'Layer 1 — deep health endpoint.', detail: 'The app reports its own cron heartbeat ages, and Docker\'s HEALTHCHECK hits it. At audit time, heartbeats were fresh relative to their 15-minute and 5-minute cadences.' },
          { title: 'Layer 2 — host watchdog.', detail: 'A root cron on the VPS ticks every 5 minutes, restarts a dead or unresponsive container, and DMs me through the bot itself. Over 10,900 ticks logged; only 8 lines in the entire log aren\'t \'tick ok\'.' },
          { title: 'Layer 3 — external probe.', detail: 'A separate machine on my end probes the site every 30 minutes. Its current rolling ledger shows 195 consecutive completed checks — and because that ledger prunes after about four days, that\'s all I\'ll claim. No invented all-time percentage.' },
        ],
        selfHealCallout: 'On Aug 31 at 4:45am UTC — 41 minutes after Nick\'s last message that night — the app hung. The watchdog\'s next tick caught it (\'the app is up but not answering. Restarting it once.\'), restarted the container, and logged RECOVERED five minutes later. Nobody woke up. I found out by reading the log.',
        uptime: 'The server has been up 38 days straight — since launch night, zero reboots. That\'s not the same as untouched: I deployed code on Jul 28 and again on Aug 16. The precise claim is 16 days, at time of writing, with no deploys and no manual fixes — including one fully automatic recovery.',
      },
      security: {
        heading: 'Boring, On Purpose',
        body: 'A client-facing system holding guest calendars and lock codes earns some paranoia. The dashboard and data layer are deliberately conservative:',
        items: [
          { label: 'Invite-only, passwordless auth.', detail: 'Six-digit email OTP is live; Google OAuth is built but switched off until I provision a proper OAuth client. No passwords to leak.' },
          { label: 'BFF sessions.', detail: 'The browser holds one httpOnly 30-day rolling cookie. Every auth-provider call happens server-side.' },
          { label: 'Row-level security everywhere.', detail: 'RLS is enabled on all 14 tables with zero public policies — the anonymous path sees nothing.' },
          { label: 'Secret-gated cron.', detail: 'The cron endpoints require a shared-secret header, so the timers can\'t be triggered from outside.' },
          { label: 'One-SQL kill switch.', detail: 'A global session-revocation runbook lives in the README: one statement logs everyone out.' },
          { label: 'Disciplined deploys.', detail: 'One command: pytest gate, rsync, image rebuild, container swap with log-rotation caps, then a 60-second health-verify loop before declaring success.' },
        ],
        honestCallout: 'Known weak link: OTP emails currently ride the auth provider\'s built-in sender, which caps at roughly two an hour. Fine for a two-user dashboard; a real onboarding bottleneck if this ever serves twenty.',
      },
      build: {
        heading: 'Four Days, 34 Commits',
        body: 'I won\'t claim I built this in four days — the design docs are dated July 1, and an n8n prototype came before any of it. What the four days actually were: taking a proven design to a hardened production system, in 34 commits.',
        timeline: [
          { year: 'Jul 1', event: 'Design docs', detail: 'Architecture, plan, and blueprint written — including the why-not-n8n verdict on the prototype.' },
          { year: 'Jul 24', event: 'SQLite → Supabase Postgres', detail: 'Data moved off-box before launch, plus a plain-English onboarding email to Nick.' },
          { year: 'Jul 25', event: 'Sprint day one — deployed by evening', detail: 'First v3.0 commit in the afternoon; Docker + Caddy bootstrap; live on the VPS the same day. Then an evening burst: full passwordless auth in 18 commits over 73 minutes, followed by the watchdog, the LLM fallback chain, deep health, and the one-command deploy script.' },
          { year: 'Jul 26', event: 'First client feature request', detail: 'Nick\'s first request — a weekly earnings summary per property — arrived the morning after launch night.' },
          { year: 'Jul 28', event: 'Sprint ends where it should', detail: 'The 34th and final commit of the sprint fixes Nick\'s requests #9–#11.' },
          { year: 'Aug 16', event: 'Last deploy', detail: 'Post-launch iteration on the bot and the iCal poller. Nothing has needed a deploy or a manual fix since.' },
          { year: 'Aug 31', event: 'The watchdog earns its keep', detail: 'The app hangs at 4:45am; auto-restarted and recovered in under five minutes with no human involved.' },
        ],
      },
      numbers: {
        heading: 'The Honest Numbers',
        body: 'Every count below was re-derived on Sep 1, 2026 with read-only SQL against the production database and SSH to the live server. This is what month one of a one-client system actually looks like.',
        table: {
          headers: ['Metric', 'Value', 'Fine print'],
          rows: [
            ['Turnovers auto-created', '19', 'Jul 26 – Aug 31: 11 pending, 7 missed, 1 notified, 0 completed'],
            ['Real escalations fired', '0', 'Built and drilled; Nick runs self-clean mode by choice'],
            ['Automatic cleaner dispatches', '0', 'Same reason — the ladder waits'],
            ['Outbound SMS to cleaners', '33', 'Zero inbound so far'],
            ['Feature requests from Nick', '9', 'Three shipped within about a day; all nine still read open'],
            ['Properties', '2', 'One with a live iCal feed'],
            ['Real cleaners on the roster', '1', 'Plus three demo seeds I never deleted'],
            ['Dashboard users', '2', 'Nick and me'],
            ['Server uptime', '38 days', 'Zero reboots since launch night'],
            ['External uptime checks', '195/195', 'Current rolling ledger only — not an all-time rate'],
            ['Telegram messages handled', 'Not measurable', 'Manager chats aren\'t persisted — there is no number to inflate'],
          ],
        },
        callout: 'The interesting part was never the volume. It\'s that a non-technical property manager runs real operations through an LLM agent, trusts it enough to file bug reports into it, and was still adding properties and cleaners two days before this audit.',
      },
      stack: {
        heading: 'Stack',
        items: [
          { name: 'Python + FastAPI', role: 'One container: dashboard, webhooks, health endpoint, and two asyncio cron loops' },
          { name: 'python-telegram-bot', role: 'Polling loop — manager chat and guest concierge on the same bot' },
          { name: 'Supabase Postgres', role: 'Off-box data via the connection pooler; RLS on all 14 tables; migrated from SQLite pre-launch' },
          { name: 'Ollama Cloud + Anthropic', role: 'Three-leg LLM fallback chain with graceful degradation' },
          { name: 'Twilio', role: 'Ordinary SMS to cleaners — no app to install' },
          { name: 'Docker + Caddy', role: 'Single container behind auto-HTTPS on a Hostinger VPS, with a host cron watchdog' },
        ],
      },
      lessons: {
        heading: 'Lessons',
        items: [
          {
            title: 'The feature-request line is the product',
            detail: 'The 32 tools do the work, but request_app_change built the relationship. Giving the client a way to shape the product from inside the product turned support into roadmap — and gave me timestamped, verifiable proof the system is actually used.',
          },
          {
            title: 'Ship the watchdog before you need it',
            detail: 'The self-healing layer went in on launch night, when it felt like overkill for a one-client app. Five weeks later it restarted a hung app at 4:45am and nobody ever noticed a problem. Ops paranoia is cheap to build and priceless exactly once.',
          },
          {
            title: 'Deterministic backbone, LLM interface',
            detail: 'The LLM handles conversation and tool calls; timers and plain Python handle calendar detection and escalation. When every LLM provider fails at once, the bot apologizes — but checkouts still get detected. Never let the flaky layer hold the critical path.',
          },
          {
            title: 'Honest numbers beat impressive numbers',
            detail: '19 turnovers, 33 texts, 1 real cleaner, 0 escalations. I could have padded these or left them out. Small verified numbers compound into trust; inflated ones compound into the opposite. This page is part of how I sell, and it only works if it\'s true.',
          },
          {
            title: 'A prototype and a product are different animals',
            detail: 'The n8n version proved the concept in days. The product needed auth, watchdogs, health checks, test-gated deploys, and a feature-request loop — none of which demo well, and all of which are why a client can run a business on it.',
          },
          {
            title: 'Let the client tune the system',
            detail: 'Nick sets his own escalation timers by chatting — range-checked, 5 to 120 minutes. Every knob the client can turn without me is a support ticket that never happens.',
          },
        ],
      },
      cta: {
        heading: 'Ask',
        body: 'Open the chat and ask how the Turnover Agent works — the dispatch ladder, the watchdog stack, the feature-request loop. Or read how I run my own operations on agents.',
        ctaLabel: 'Open chat',
        ctaHref: '#chat',
      },
    },
    faq: {
      heading: 'FAQ',
      items: [
        {
          q: 'Why Telegram instead of a web app or a native app?',
          a: 'Because adoption is the hardest problem in client software, and the way to win it is to not need any. Nick already lives in chat, so the manager interface is a conversation with a bot. Cleaners get plain SMS through Twilio — nothing to install, nothing to learn. Guests who message the bot get a concierge mode with a single restricted tool. There is a web dashboard for the visual work — invite-only and passwordless — but it\'s the secondary surface. The design goal from the README says it best: nobody downloads an app.',
        },
        {
          q: 'What does the LLM actually do, and what happens when it goes down?',
          a: 'The LLM is the interface, not the engine. When Nick types a message, an agent loop reads it and calls the right tools — create a property, adjust a timer, look up a turnover, file a feature request — against Postgres. The brain is a three-leg fallback chain: glm-5.2 on Ollama Cloud, then gpt-oss:120b, then Anthropic\'s claude-opus-4-8; if every leg fails, the bot replies that it\'s having trouble connecting to its brain rather than going silent. Two honest caveats: the Anthropic leg is currently unfunded, so in practice it\'s a two-provider chain; and the parts that must not fail — calendar polling, escalation checks — are deterministic Python on timers that run whether or not any LLM is reachable.',
        },
        {
          q: 'Has the escalation ladder ever fired for real?',
          a: 'No, and I\'d rather tell you that than let you assume otherwise. The production database shows zero escalations and zero automatic dispatch attempts. The reason is a feature, not a bug: Nick runs self-clean mode — he does his own cleans for now, so the bot notifies him instead of dispatching a crew. The ladder itself is real code, verified line by line, and was drilled at launch. He added his first real cleaner on Aug 31, so the day it fires for real is probably coming. When it does, this article gets updated with what actually happened.',
        },
        {
          q: 'How is the client\'s data protected?',
          a: 'Several boring layers. The dashboard is invite-only with passwordless six-digit email OTP; the browser holds only an httpOnly 30-day rolling session cookie, and every auth-provider call happens server-side. Row-level security is enabled on all 14 database tables with zero public policies. The cron endpoints sit behind a shared-secret header. Data lives off-box in Supabase Postgres, so the VPS holds no client database. And there is a one-SQL-statement session-revocation runbook in the README for the day something looks wrong. On the Telegram side, unknown users get a restricted single-tool context — a guest cannot invoke manager tools, because those tools are simply not in their toolset.',
        },
        {
          q: 'What does it cost to run?',
          a: 'I won\'t quote revenue: pricing was genuinely still being discussed with Nick in late August — through the bot, of course, as feature request #19 — and this article only prints verified numbers. Infrastructure is modest by design: one small VPS, Twilio pay-per-text (33 texts so far), and LLM calls that land almost entirely on an economical primary model. My internal estimate is a few tens of dollars a month, and I\'m flagging that as an estimate because I haven\'t reconciled it against invoices.',
        },
        {
          q: 'What would you build differently today?',
          a: 'Three things, all straight from the warts in this article. First, iCal reliability: 7 of 19 turnovers went to status missed, and Nick himself reported a stay that wasn\'t showing up — the poller inherits every sync delay Airbnb has, and it needs a reconciliation pass rather than blind trust in the feed. Second, observability of usage: manager chats aren\'t persisted, so I can\'t even tell you how many messages the bot has handled — good for a truthful article, bad for understanding the product. Third, closing loops: all nine feature requests still read open in the database even though several shipped. The system is honest about my discipline, and my discipline could be better.',
        },
      ],
    },
  }

export const turnoverAgentContent = _en
