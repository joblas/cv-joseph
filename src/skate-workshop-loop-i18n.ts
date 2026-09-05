const _en = {
    slug: 'skate-workshop-loop',
    readingTime: '13 min read',
    seo: {
      title: 'Relighting a Dead Agent Loop: The Skate Workshop, Round Two',
      description: 'Case study: rebuilding a Slack-native agent dev loop after v1 died in public. A two-pass audit with receipts, three hardened edge-function redeploys, and a live test that stopped one stale credential short of end to end.',
    },
    nav: {
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'Skate Workshop Loop',
    },
    header: {
      kicker: 'Agentic Dev Loop — Round Two',
      h1: 'The Skate Workshop Loop: Relighting a Dead Agent Loop, Slack-Native',
      subtitle: 'Version one of this loop died in public: a bot reminding an empty Slack room about five unfixable bugs in a retired repo, twice a day, for weeks. Round two rewires the same loop into the live rebuild — audit first, security pass second, live test third. This is the honest build log, receipts included.',
      badge: 'Live rebuild — one credential from end-to-end',
      date: 'Sep 2, 2026',
    },
    heroMetrics: [
      { value: '44/82', label: 'Claude-co-authored commits' },
      { value: '175', label: 'Tests in CI' },
      { value: '4,952', label: 'Trick-grid combinations' },
      { value: '37', label: 'Real v1 bug reports' },
      { value: '1', label: 'Blocker left' },
    ],
    tldr: 'Round two of The Skate Workshop\'s agent dev loop. The GitHub half already works: Claude-authored PRs behind a human merge gate, 175-test CI, green-only auto-OTA. The Slack half was February scaffolding pointed at a retired repo — complete with a zombie bot reporting dead bugs to an empty room. This is the audit that proved it, the relight that repointed and hardened all three edge functions, and the live test that stopped one stale credential short of end to end.',
    metaCallout: 'Truth note: every number on this page was checked against the live systems — row counts, deployed function versions, commit trailers, workflow runs — in a two-pass audit, then re-verified at publish time. Where something is unproven, unfinished, or embarrassing, the page says so. The zombie stays in the story because it earned its place.',
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
        hook: 'For weeks this summer, a bot posted a twice-daily bug report into a Slack channel nobody read — the same five bugs every time, the oldest 169 days old, in a repository I\'d already retired. Then it stopped on its own, and nobody noticed that either. That zombie is what a dead agent loop looks like, and it\'s why round two of this system was built audit-first.',
        body: 'The Skate Workshop is a React Native coaching app I\'m rebuilding for skateboarding coach Willy Santos — live on iOS via TestFlight (Android builds rolling), with a 4,952-combination trick grid and 175 tests in CI. The development method is the one I run across my projects: Claude Code writes on its own branches, every PR lands behind a human merge gate, and a green build auto-publishes an over-the-air update. This article is about the other half — the feedback loop that turns an athlete\'s bug report into an issue, a fix, and a shipped update. Version one of that half died in public. Round two got relit this week, and I have the receipts.',
      },
      theLoop: {
        heading: 'The Loop, As Designed',
        body: 'One loop, two halves. The GitHub half turns merged code into shipped updates. The Slack half turns athlete feedback into GitHub issues. The full circuit:',
        steps: [
          { label: 'Report.', detail: 'An athlete taps Report a bug in the app — a screenshot goes to a private bucket, a row lands in the bug_reports table. Or they just type the bug into the intake channel and a listener picks it up.' },
          { label: 'File.', detail: 'A database webhook fires an edge function that opens a GitHub issue — labeled by category, prioritized by a keyword heuristic — and posts the link back into Slack.' },
          { label: 'Triage.', detail: 'An agent labels, dedupes, and posts triage notes back to the channel.' },
          { label: 'Fix.', detail: 'Claude writes a failing test first, fixes on its own branch, and opens a PR labeled needs-joe.' },
          { label: 'Gate.', detail: 'Only I merge — optionally by typing /deploy go in Slack to batch-dispatch approved PRs.' },
          { label: 'Ship.', detail: 'Any merge to main runs 175 tests. A green build auto-publishes an over-the-air update to the beta\'s preview channel, and a ship notice — update-group ID plus rollback command — goes to Slack.' },
        ],
        punchline: 'That\'s the design. On September 1 I audited what was actually true.',
      },
      deadLoop: {
        heading: 'What a Dead Loop Looks Like',
        body: 'Version one of this loop ran against the original repo starting in February, and the intake genuinely worked: athletes filed real reports, issue numbers climbed past #150, and 37 in-app bug reports flowed through the pipe. I still have every one of them, preserved in a backup schema in the current database. Then I retired that repo and rebuilt the app from scratch as v3 — and every deployed piece of the Slack half kept pointing at the corpse.',
        timeline: [
          { year: 'Jan 2026', event: 'Workspace built', detail: 'A Slack workspace purpose-built for the beta: an intake channel with a pinned bug-report template, a feature-request channel, a dev channel, and a bot user.' },
          { year: 'Feb 2026', event: 'v1 loop live', detail: 'Three edge functions deployed: in-app reports become GitHub issues, Slack messages become GitHub issues, /deploy dispatches approved PRs. Athletes file real bugs; 37 reports flow through the pipe.' },
          { year: 'Spring', event: 'The rebuild', detail: 'I retire the v1 repo and rebuild the app as v3. Development moves. The deployed Slack loop doesn\'t — every function still points at the retired repo.' },
          { year: 'Aug 5', event: 'The zombie dies', detail: 'The twice-daily Morning Bug Report posts one last time — the same five stale bugs, the oldest 169 days old, in a repo nobody will ever fix again — then stops. I still haven\'t identified what was running it.', punchline: 'Nobody noticed it running. {Nobody noticed it stop.}' },
          { year: 'Aug 19', event: 'The other lane dies too', detail: 'CI starts failing on Expo SDK drift, which silently skips every auto-OTA publish. The ship lane is dead for 13 days and nothing says so.' },
          { year: 'Sep 1', event: 'The audit', detail: 'A two-pass agent audit maps every component against the live systems. Same day: CI relit with warn-only drift gates, two playbook PRs merged, two OTA updates auto-published.' },
          { year: 'Sep 2', event: 'The relight', detail: 'All three edge functions repointed at v3, hardened, and redeployed. A live test runs the pipe and stops at exactly one stale credential.' },
        ],
        callout: 'A bot faithfully reminding an empty room about five unfixable bugs in a dead repo is the whole cautionary tale in one image.',
        zeroesHeading: 'The Zeroes',
        zeroes: [
          'The intake channel: silent for 27 days when the audit ran.',
          'The dev and feature-request channels: zero messages. Ever.',
          'The v3 bug_reports table: zero rows.',
          'Mentions of the v3 repo anywhere in the workspace: zero.',
          'PRs announced in Slack: zero of 13. OTA ships announced: zero of 2.',
        ],
      },
      githubHalf: {
        heading: 'The Half That Worked',
        body: 'While the Slack half rotted, the GitHub half quietly became the most productive lane I run. Claude has co-authored 44 of the 82 commits on main. Two of the thirteen merged PRs came off claude/* branches — both labeled needs-joe, both merged by me. The agent has never merged its own work. CI runs 175 tests on every push plus a Monday drift check, and a green run on main auto-publishes an over-the-air update to the beta\'s preview channel.',
        honestBeat: 'It also produced this article\'s second cautionary tale. On August 19, CI started failing on Expo SDK drift — and a failed CI silently skips the OTA publish, so the ship lane was dead for 13 days with nothing to say so. The September 1 playbook audit caught it: warn-only drift gates turned CI green the same day, and both merges that followed auto-shipped OTA updates within hours. The loop\'s one working limb had itself been quietly dead for almost two weeks. And neither of those ships was announced in Slack — the loop\'s own comms rules require posting an update-group ID and a rollback command on every publish, and nothing is wired to do it yet.',
        metrics: [
          { value: '44/82', label: 'Commits Claude-co-authored' },
          { value: '2/13', label: 'Merged PRs from claude/* branches' },
          { value: '13', label: 'Days the OTA lane was silently dead' },
          { value: '2', label: 'OTAs auto-published on Sep 1' },
        ],
      },
      audit: {
        heading: 'The Audit, With Receipts',
        body: 'Before rewiring anything, I ran a two-pass audit: one agent gathered the state of every component from the live systems — deployed edge-function source, database rows, the Slack API, GitHub\'s API — and a second agent adversarially re-derived every claim from scratch. Numbers that survived both passes went into the plan; the rest got hedged or cut. The verdict: the GitHub half genuinely works, and the Slack half was February scaffolding over a void.',
        tableHeaders: ['Component', 'State on September 1'],
        tableRows: [
          ['create-bug-issue (v17, deployed Feb 6)', 'Hardcoded to the retired v1 repo. No secret check — any caller could forge a payload.'],
          ['slack-bug-listener (v8, deployed Feb 6)', 'Same dead repo. Publicly callable, no Slack signature verification.'],
          ['slack-deploy-command (v10, deployed Feb 6)', 'Dispatches a batch-deploy workflow that doesn\'t exist in the v3 repo.'],
          ['bug_reports webhook', 'Live and armed with a secret header — firing at a function that never checked it.'],
          ['Corrected rewrite sitting on main', 'Written, never deployed — and carrying a wrong Slack channel ID of its own.'],
          ['The intake channel', 'Silent for 27 days. Last post: the zombie.'],
        ],
        punchline: 'My favorite finding is the channel ID, because it\'s the most honest one: even the fixed version of the code — written specifically to revive this loop — routed feedback to a channel ID that matched nothing the audit could see. Nobody had ever run this pipe end to end. Code review doesn\'t catch that. Running it does.',
      },
      relight: {
        heading: 'The Relight',
        body: 'On September 2, the Slack half got rewired into the live build — in this order, deliberately:',
        steps: [
          { label: 'Security first.', detail: 'These functions run with JWT verification off so webhooks and Slack\'s Events API can reach them — which makes their URLs publicly callable. A security review flagged that the Slack-facing functions would accept forged payloads. The redeployed versions fail closed: the database webhook must present a shared secret, and the Slack endpoints verify Slack\'s HMAC request signature — replay window, constant-time comparison, and refuse-everything if the secret is unset.' },
          { label: 'Repoint everything.', detail: 'All three functions redeployed against the v3 repo: create-bug-issue v17 → v18, slack-bug-listener v8 → v9, slack-deploy-command v10 → v11.' },
          { label: 'Fix the channel ID.', detail: 'The feedback route now points at the real dev channel, verified against the live Slack API — the correction and its date are documented in a code comment for the next auditor.' },
          { label: 'Fire a live test.', detail: 'One real row through the real pipe, the way the app would send it. The webhook fired, the secret check passed, the function built the issue payload — and stopped at exactly one point: the stored GitHub credential is stale. That\'s the single remaining blocker, and rotating it is a step I only do by hand.' },
        ],
        callout: 'The pipe is proven. The last key is being cut.',
      },
      currentState: {
        heading: 'Where It Stands',
        metrics: [
          { value: '3', label: 'Edge functions live against v3', detail: 'v18 / v9 / v11' },
          { value: '1', label: 'Test report through the pipe' },
          { value: '0', label: 'Real athlete reports in v3 yet' },
          { value: '1', label: 'Blocker left: one stale credential' },
        ],
        body: 'I want to be precise about what\'s proven and what isn\'t. Proven: the GitHub lane end to end — Claude-authored PRs, gated merges, 175-test CI, two auto-OTA publishes on September 1 — and the intake pipe up to the GitHub call. Not yet proven: a real athlete report flowing through v3. The only row in the table is my test. Round two is relit, not finished.',
        missingHeading: 'Still Missing',
        missing: [
          'The credential rotation — hand-done, in progress.',
          'An agent actually bound to Slack: today, zero of my scheduled jobs deliver there.',
          'A ship-notice step in the OTA workflow, so every publish posts its update-group ID and rollback command.',
          'The batch-deploy workflow that /deploy go expects to dispatch.',
          'A daily triage sweep for this project, like the one my other beta loop already runs.',
        ],
      },
      stack: {
        heading: 'Stack',
        items: [
          { name: 'Supabase Edge Functions', desc: 'Deno functions next to the database: webhook intake, Slack listener, /deploy command.' },
          { name: 'Database webhooks', desc: 'An INSERT on bug_reports fires the intake function with a shared-secret header.' },
          { name: 'GitHub Actions', desc: '175-test CI on every push plus a Monday drift check; green-only auto-OTA.' },
          { name: 'Expo / EAS Update', desc: 'Over-the-air JS updates to the TestFlight beta\'s preview channel.' },
          { name: 'Slack', desc: 'Purpose-built workspace: intake channel with a pinned report template, feature requests, dev channel.' },
          { name: 'Claude Code', desc: 'Writes on claude/* branches — 44 of 82 commits co-authored. Never merges.' },
        ],
      },
      related: {
        heading: 'Related Systems',
        body: 'The method behind this loop didn\'t start here. The Hermes case study covers the agent runtime it grew out of; the Self-Healing Chatbot applies the same closed-loop philosophy to LLMOps.',
      },
      cta: {
        heading: 'Ask',
        body: 'Open the chat and ask how the loop is wired, what the audit caught, or what\'s still missing — the honest answer is the interesting one.',
        ctaLabel: 'Open chat',
        ctaHref: '#chat',
      },
    },
    lessons: {
      heading: 'Lessons',
      items: [
        {
          title: 'A loop is only alive if something notices it dying',
          detail: 'Two limbs of this system died silently: the zombie poster ran for weeks after its repo was retired and then stopped without anyone noticing either event, and the CI-to-OTA lane was dead for 13 days because a skipped workflow makes no sound. More automation doesn\'t fix that — making silence itself an alarm does. The Monday drift check exists now; ship notices in Slack are next.',
        },
        {
          title: 'Intake is the easy half — it\'s been proven twice',
          detail: '37 real athlete reports flowed through v1\'s pipe. People will report bugs when the path is one tap in the app or one message in a channel. The hard half is everything after intake: keeping every deployed endpoint pointed at the living repo, and having an agent actually consume what arrives.',
        },
        {
          title: 'Hardcoded config outlives whatever it points at',
          detail: 'The February functions baked in a repo name and channel IDs. The repo they named was retired, and the functions kept faithfully serving it for half a year. Anything that names an external target — repos, channels, workflows — deserves one config point and an audit that checks it against the live world, not a code review that checks it against intentions.',
        },
        {
          title: 'The relight is the moment for the security pass',
          detail: 'Webhook-reachable endpoints can\'t require JWTs, so their URLs are public. Forgeable payloads cost nothing while the functions pointed at a dead repo — and would have cost plenty the moment they pointed at a live one. Reviewing exactly at the repoint meant the hardening shipped in the same deploy as the risk.',
        },
        {
          title: 'Run the pipe before you trust the pipe',
          detail: 'The corrected code sitting unreleased on main — written specifically to fix this loop — carried its own wrong channel ID, and my assumed blocker list was wrong until a live test found the real one: a stale credential. Static review told a comforting story. One real row through the real pipe told the true one.',
        },
        {
          title: 'Keep the human gate boring and absolute',
          detail: 'Every PR merges through me. Every credential rotates through me. Every schema and edge-function deploy happens with me in the loop. None of that limits the agent — it\'s the reason I can let the agent run fast everywhere else.',
        },
      ],
    },
    faq: {
      heading: 'FAQ',
      items: [
        {
          q: 'Did version one actually fail?',
          a: 'The loop didn\'t fail — it was orphaned. Version one worked: athletes filed real bug reports from inside the app, 37 of them flowed through the intake pipe (I still have every row, preserved in a backup schema in the current database), and issue numbers in the old repo climbed past #150. What failed was operational: when I retired that repo and rebuilt the app as v3, every deployed piece of the loop kept running against the dead repo, and nothing forced me to notice. The design was validated; the operations weren\'t. That distinction is why round two started with an audit instead of new features.',
        },
        {
          q: 'What does Claude do, and what do you do?',
          a: 'Claude Code writes code on claude/* branches — it has co-authored 44 of the 82 commits on main — writes the failing test before the fix, and opens PRs labeled needs-joe. I merge every PR personally; the agent has never merged its own work. I also hold the keys: GitHub credentials, Slack tokens, and webhook secrets are set and rotated by hand, and the database side — schema, edge functions — is a gated path that only deploys with me in the loop. Two of the thirteen merged PRs so far came off Claude branches, both merged by me on September 1. The speed comes from the automation; the safety comes from the gate.',
        },
        {
          q: 'Is a keyword heuristic really enough to classify Slack messages as bugs?',
          a: 'It\'s a deliberately dumb classifier — a minimum message length plus a keyword list ("crash", "broken", "can\'t", and friends) — and it will misjudge messages at the margins. For a small TestFlight beta that\'s the right trade: a false positive costs a label change during triage, and a missed report is still sitting in a channel where a human reads it. The in-app path doesn\'t use the heuristic at all — a structured form submission is already a bug report by definition, and that path produced all 37 of v1\'s real reports. If the Slack path starts misfiring on real traffic, the classifier is one function in one file, and there\'s a triage layer downstream specifically to catch what it gets wrong.',
        },
        {
          q: 'Nothing bad happened while the endpoints were forgeable. Why does the security fix matter?',
          a: 'Because the only thing protecting them was irrelevance. These functions run with JWT verification off so that database webhooks and Slack\'s Events API can reach them — which makes their URLs publicly callable by anyone. For months, a forged payload could have opened arbitrary GitHub issues or posted into the team\'s channels. It cost nothing because the deployed functions pointed at a retired repo nobody cared to abuse. Reconnecting them to a live repo and a real team without verification would have turned a harmless zombie into a spam cannon. The redeployed versions fail closed: the webhook path requires a shared secret, the Slack path verifies Slack\'s HMAC request signature with a replay window and a constant-time comparison, and an unset secret means every request is refused.',
        },
        {
          q: 'What happens after the credential is rotated?',
          a: 'The live test already answered most of that: a bug-report row fires the webhook, the secret check passes, the function builds the GitHub issue payload — and halts at authentication because the stored credential is stale. Rotation is a hand-done step on my side. Once it lands, the same insert produces a labeled issue in the v3 repo and a Slack post linking to it, and the type-a-bug-into-Slack path goes live with it. What that does not finish is the agent side of the loop: no scheduled job of mine delivers to Slack yet, the triage sweep hasn\'t run for this project, and the OTA workflow still ships silently. Those are the next bricks, and I\'d rather list them here than pretend the loop is done.',
        },
        {
          q: 'Why Slack this time, when your other loops run on Telegram?',
          a: 'Audience. My personal loops report to Telegram because I\'m their only consumer. This loop\'s consumers are a coach and his athletes, and the reporting surface has to live where they already talk. The workspace was purpose-built for the beta back in January — an intake channel with a pinned bug-report template, a feature-request channel, a dev channel, and a bot user — months before the loop could do anything useful with it. Honestly, that ordering is a mistake I\'d repeat: the empty rooms were embarrassing in the audit, but the structure meant the relight only had to fix code, not org design.',
        },
      ],
    },
  }

export const skateWorkshopLoopContent = _en
