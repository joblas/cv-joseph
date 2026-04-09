const _en = {
    slug: 'career-ops-system',
    altSlug: 'career-ops',
    readingTime: '18 min read',
    seo: {
      title: 'Career-Ops: Finding, Forking & Customizing the Right Open-Source Tool',
      description: 'How I evaluated, forked, and customized Career-Ops — an open-source multi-agent job search tool by santifer — for my AI Developer and DevOps job search. A showcase of OSS adoption, configuration, and optimization.',
    },
    nav: {
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'Career-Ops',
    },
    header: {
      kicker: 'OSS Adoption & Customization',
      h1: 'Career-Ops: Finding the Right Tool, Making It Mine',
      subtitle: 'Career-Ops is an open-source multi-agent job search tool created by santifer. I evaluated it against alternatives, forked it, customized the scoring, archetypes, and CV templates for my profile, and now run it daily. This is how I find, adopt, and optimize open-source tools — the same skill I bring to any engineering team.',
      badge: 'Open-source tool — forked & customized',
      date: 'Mar 17, 2026',
    },
    heroMetrics: [
      { value: '12', label: 'Modes' },
      { value: '10', label: 'Dimensions' },
      { value: '3', label: 'Target tracks' },
      { value: '15+', label: 'Years experience' },
    ],
    tldr: 'Career-Ops is an open-source AI job search tool created by santifer. I forked it, customized scoring weights, target archetypes, CV templates, and portal configurations for my career profile, and run it in production daily. This page showcases my process for evaluating, adopting, and optimizing open-source tooling.',
    metaCallout: 'Credit where it\'s due: Career-Ops was created by santifer (santifer.io). I did not build this system — I found it, recognized it solved my problem, forked it, and made it mine. The ability to evaluate open-source tools, understand their architecture, and customize them for specific needs is the same skill set behind every DevOps pipeline, every infrastructure stack, and every AI workflow I\'ve ever shipped.',
    internalLinks: {
      openclaw: {
        text: 'OpenClaw | Case Study',
        href: '/openclaw',
      },
      skateWorkshop: {
        text: 'The Skate Workshop | Case Study',
        href: '/skate-workshop',
      },
    },
    sections: {
      intro: {
        hook: 'The best engineers don\'t build everything from scratch — they find the right tool, understand how it works, and make it fit their needs. After 15 years building autonomous vehicle systems at Google, Uber, and Pronto.ai, I needed an efficient way to target AI Developer and DevOps roles. Instead of building a job search tool from zero, I evaluated what was out there, found Career-Ops (an open-source multi-agent system by santifer), and customized it for my workflow.',
        body: 'I forked the repo, configured the scoring weights for my target roles, defined custom archetypes (AI Developer, DevOps/SRE, Embedded/Robotics), set up portal scanning for 45+ companies, customized the CV template with my proof points, and tuned the evaluation pipeline. The same approach I\'d take adopting any open-source tool on a team: evaluate, fork, configure, optimize, operate.',
      },
      theProblem: {
        heading: 'The Problem',
        body: 'Searching for AI Developer, DevOps/SRE, and Embedded/Robotics roles means navigating a fragmented market. Each offer requires reading the JD, mapping your skills against requirements, adapting the CV, writing personalized responses, and filling 15-field forms. Multiply that by 10 offers per day.',
        painPoints: [
          { label: 'Repetitive reading.', detail: '70% of offers are a poor fit. You find out after reading 800 words of JD.' },
          { label: 'Generic CVs.', detail: 'A static PDF cannot highlight the proof points relevant to each specific offer.' },
          { label: 'Manual forms.', detail: 'Every platform asks the same questions in different formats. Copy-paste 15 times per application.' },
          { label: 'No tracking.', detail: 'Without a system, you forget where you applied. Duplicate effort or lose follow-up entirely.' },
          { label: 'Zero feedback.', detail: 'Apply, wait, and never know if the problem was fit, the CV, or timing.' },
          { label: 'Cross-domain targeting.', detail: 'AI, DevOps, and Embedded roles live on different boards, use different keywords, and attract different recruiters. One search strategy does not cover all three.' },
        ],
        punchline: 'The work is not hard. It is repetitive. The smart move isn\'t building a solution from scratch — it\'s finding the right open-source tool and making it yours.',
      },
      architecture: {
        heading: 'The 12 Modes — Multi-Agent System',
        body: 'Career-Ops is not a script or an auto-apply bot. It is a multi-agent system with 12 operational modes, each a Claude Code skill file with its own context, rules, and tools. An agent that reasons about the problem domain and executes the right action.',
        whyModes: {
          heading: 'Why Modes, Not One Prompt',
          items: [
            { label: 'Precise context.', detail: 'Each mode loads only the information it needs. auto-pipeline skips contact rules. apply skips scoring logic.' },
            { label: 'Testability.', detail: 'One mode gets tested in isolation. Changing PDF logic never touches evaluation.' },
            { label: 'Independent evolution.', detail: 'Adding a new mode never breaks existing ones. Training mode shipped 3 weeks after first deploy.' },
          ],
        },
        modes: [
          { name: 'auto-pipeline', desc: 'Full pipeline: extract JD, evaluate A-F, generate report, PDF, and tracker entry.' },
          { name: 'oferta', desc: 'Single-offer evaluation with 6 blocks: summary, CV match, level, compensation, personalization, interview.' },
          { name: 'ofertas', desc: 'Multi-offer comparison and ranking.' },
          { name: 'pdf', desc: 'ATS-optimized PDF personalized per offer with proof points and keywords.' },
          { name: 'pipeline', desc: 'Batch URL processing from inbox.' },
          { name: 'scan', desc: 'Offer discovery: navigates job boards and careers pages of target companies. Many offers never appear on aggregators.' },
          { name: 'batch', desc: 'Parallel processing with conductor + workers. Simultaneous URLs in queue.' },
          { name: 'apply', desc: 'Interactive form-filling with Playwright. Reads the page, retrieves cached evaluation, generates responses.' },
          { name: 'contacto', desc: 'LinkedIn outreach helper.' },
          { name: 'deep', desc: 'Deep company research.' },
          { name: 'tracker', desc: 'Application status dashboard.' },
          { name: 'training', desc: 'Evaluates courses and certifications against the North Star.' },
        ],
      },
      scoring: {
        heading: '10-Dimension Scoring',
        body: 'Every offer runs through an evaluation framework with 10 weighted dimensions. The output: a numeric score (1-5) and an A-F grade. Not all dimensions carry equal weight — Role Match and Skills Alignment are gate-pass: if they fail, the final score drops.',
        dimensions: {
          headers: ['Dimension', 'What It Measures', 'Weight'],
          rows: [
            ['Role Match', 'Alignment between requirements and CV proof points', 'Gate-pass'],
            ['Skills Alignment', 'Tech stack overlap', 'Gate-pass'],
            ['Seniority', 'Stretch level and negotiability', 'High'],
            ['Compensation', 'Market rate vs target', 'High'],
            ['Geographic', 'Remote/hybrid/onsite feasibility', 'Medium'],
            ['Company Stage', 'Startup/growth/enterprise fit', 'Medium'],
            ['Product-Market Fit', 'Problem domain resonance', 'Medium'],
            ['Growth Trajectory', 'Career ladder visibility', 'Medium'],
            ['Interview Likelihood', 'Callback probability', 'High'],
            ['Timeline', 'Closing speed and hiring urgency', 'Low'],
          ],
        },
        distribution: {
          heading: 'Score Distribution',
          items: [
            { value: '21', label: 'Score >= 4.5 (A)' },
            { value: '52', label: 'Score 4.0-4.4 (B)' },
            { value: '71', label: 'Score 3.0-3.9 (C)' },
            { value: '51', label: 'Score < 3.0 (D-F)' },
          ],
        },
        callout: '74% of evaluated offers score below 4.0. Without the system, I would have spent hours reading JDs that never fit.',
      },
      pipeline: {
        heading: 'The Pipeline',
        body: 'auto-pipeline is the flagship mode. A URL goes in, and out comes an evaluation report, a personalized PDF, and a tracker entry. Zero manual intervention until final review.',
        steps: [
          { label: 'Extract JD.', detail: 'Playwright navigates to the URL, extracts structured content from the offer.' },
          { label: 'Evaluate 10D.', detail: 'Claude reads JD + CV + portfolio and generates scoring across all 10 dimensions.' },
          { label: 'Generate report.', detail: 'Markdown with 6 blocks: executive summary, CV match, level, compensation, personalization, and interview probability.' },
          { label: 'Generate PDF.', detail: 'HTML template + keyword injection + adaptive framing. Puppeteer renders to PDF.' },
          { label: 'Register tracker.', detail: 'TSV with company, role, score, grade, URL. Auto-merge via Node.js script.' },
          { label: 'Dedup.', detail: 'Checks scan-history.tsv and applications.md. Zero re-evaluations.' },
        ],
        batch: {
          heading: 'Batch Processing',
          body: 'For high volume, batch mode launches a conductor that orchestrates parallel workers. Each worker is an independent Claude Code process with 200K context. The conductor manages the queue, tracks progress, and merges results.',
          metrics: [
            { value: '200K', label: 'Context/worker' },
            { value: '2x', label: 'Retries per failure' },
          ],
          details: 'Fault-tolerant: a worker failure never blocks the rest. Lock file prevents double execution. Batch is resumable — reads state and skips completed items.',
        },
      },
      pdf: {
        heading: 'AI Resume Builder — Personalized',
        body: 'A generic CV loses. Career-Ops works as an AI resume builder that generates a different ATS-optimized resume for each offer, injecting JD keywords and reordering experience by relevance. Not a template: a resume built from real CV proof points.',
        steps: [
          { label: 'Extract 15-20 keywords from the JD.', detail: 'Keywords land in the summary, first bullet of each role, and skills section.' },
          { label: 'Detect language.', detail: 'English JD generates English CV.' },
          { label: 'Detect region.', detail: 'US company generates Letter format. Europe generates A4.' },
          { label: 'Detect archetype.', detail: 'Target archetypes map to AI Developer, DevOps/SRE, and Embedded/Robotics. The summary shifts based on the profile.' },
          { label: 'Select projects.', detail: 'Top 3-4 by relevance. OpenClaw for agent/AI roles. Cloud Infrastructure for DevOps. AV experience for robotics/embedded.' },
          { label: 'Reorder bullets.', detail: 'The most relevant experience moves up. The rest moves down — nothing disappears.' },
          { label: 'Render PDF.', detail: 'Puppeteer converts HTML to PDF. Self-hosted fonts, single-column ATS-safe.' },
        ],
        archetypes: {
          heading: 'Target Archetypes',
          headers: ['Archetype', 'Primary Proof Point'],
          rows: [
            ['AI Developer', 'OpenClaw (22-agent AI system, multi-agent orchestration)'],
            ['DevOps / SRE', 'Cloud Infrastructure (Docker, CI/CD, monitoring pipelines)'],
            ['Embedded / Robotics', 'Google Self-Driving Car Project + Pronto.ai (7 years AV systems)'],
            ['Full-Stack AI', 'The Skate Workshop (React Native) + DALL-E Image Generator'],
            ['Automation Engineer', 'OpenClaw + Whisper Walkie (end-to-end AI-powered tooling)'],
          ],
        },
        callout: 'Same CV. Multiple framings. All real — keywords get reformulated, never fabricated.',
      },
      beforeAfter: {
        heading: 'Before and After',
        headers: ['Dimension', 'Manual', 'Career-Ops'],
        rows: [
          ['Evaluation', 'Read JD, mental mapping', '10D automated scoring, A-F grade'],
          ['CV', 'Generic PDF', 'Personalized PDF, ATS-optimized'],
          ['Application', 'Manual form', 'Playwright auto-fill'],
          ['Tracking', 'Spreadsheet or nothing', 'TSV + automated dedup'],
          ['Discovery', 'LinkedIn alerts', 'Scanner: job boards + target company careers pages'],
          ['Batch', 'One at a time', 'Parallel URL processing'],
          ['Dedup', 'Human memory', 'URLs deduplicated automatically'],
        ],
      },
      results: {
        heading: 'Results',
        body: 'The system is in active production use. Career-Ops handles the analytical heavy lifting — evaluating offers, generating tailored resumes, and tracking applications — so I can focus on the roles that actually fit.',
        metrics: [
          { value: '12', label: 'Operational modes' },
          { value: '10', label: 'Scoring dimensions' },
          { value: '3', label: 'Career tracks targeted' },
          { value: '0', label: 'Fabricated credentials' },
        ],
      },
      stack: {
        heading: 'Stack',
        items: [
          { name: 'Claude Code', role: 'LLM agent: reasoning, evaluation, content generation' },
          { name: 'Playwright', role: 'Browser automation: portal scanning and form-filling' },
          { name: 'Puppeteer', role: 'PDF rendering from HTML templates' },
          { name: 'Node.js', role: 'Utility scripts: merge-tracker, cv-sync-check, generate-pdf' },
          { name: 'tmux', role: 'Parallel sessions: conductor + workers in batch' },
        ],
      },
      lessons: {
        heading: 'Lessons',
        items: [
          {
            title: 'Evaluate before you build',
            detail: 'My first instinct was to build a job search tool from scratch. Instead, I spent a day evaluating existing solutions. Career-Ops already solved 90% of what I needed. Customizing the last 10% took hours, not weeks. That\'s the same decision I make on any team: build vs. adopt.',
          },
          {
            title: 'Understand the architecture before you customize',
            detail: 'I read the entire codebase before changing a line. Understanding the mode system, data contract, and scoring pipeline meant my customizations worked with the design — not against it. Same principle as joining any existing codebase.',
          },
          {
            title: 'Configuration is underrated engineering',
            detail: 'Defining the right archetypes, scoring weights, portal queries, and CV proof points is the real work. The tool is powerful, but it\'s only as good as the configuration driving it. Garbage in, garbage out — same as Terraform, K8s, or any IaC.',
          },
          {
            title: 'Automate analysis, not decisions',
            detail: 'Career-Ops evaluates offers. I decide which ones get my time. HITL is not a limitation — it is the design. AI filters noise, humans provide judgment.',
          },
          {
            title: 'Open source compounds',
            detail: 'Every improvement santifer ships, I get for free. Every customization I make feeds back into my workflow immediately. That compound effect is why OSS adoption beats building in-house for most problems.',
          },
          {
            title: 'The best tool is the one you actually use',
            detail: 'I run Career-Ops daily. It\'s not a demo or a proof of concept — it\'s my actual job search infrastructure. The test of any tool adoption is whether it becomes part of your real workflow.',
          },
        ],
      },
      cta: {
        heading: 'Ask',
        body: 'Open the chat and ask how I evaluated, customized, and operate Career-Ops. Or check out OpenClaw and The Skate Workshop — those are systems I built from scratch.',
        ctaLabel: 'Open chat',
        ctaHref: '#chat',
      },
    },
    faq: {
      heading: 'FAQ',
      items: [
        {
          q: 'Is this gaming the system?',
          a: 'Career-Ops automates analysis, not decisions. Every evaluation report is reviewed before I decide whether to apply. Every generated PDF is inspected to verify that keywords are reformulated from real experience, not fabricated. The apply mode fills form fields but stops before clicking submit — I make the final call on every application. This is the same HITL philosophy behind any CRM or applicant tracking system: the tool organizes, filters, and prepares, but a human provides the judgment. The system explicitly discourages applying to roles scoring below 4.0 out of 5, recommending against wasting both my time and the recruiter\'s time on poor-fit applications. Quality over quantity is a design principle, not a slogan.',
        },
        {
          q: 'Why Claude Code and not a script pipeline?',
          a: 'A script pipeline follows fixed rules — it cannot reason about context, weigh ambiguous signals, or generate narrative analysis. Career-Ops uses Claude Code as an LLM agent that reads the full job description, cross-references it against my CV and project proof points, and produces a 10-dimension evaluation with contextual reasoning for each score. It detects when a role title says Senior but the responsibilities suggest Staff level. It recognizes when a startup listing compensation as competitive likely means below market. It reformulates keywords from my real experience to match the JD vocabulary without fabricating skills I do not have. The output is a narrative evaluation report with specific rationale per dimension, not a template with blanks filled in. That reasoning capability is why an LLM agent outperforms any deterministic script for this task.',
        },
        {
          q: 'What does it cost to run?',
          a: 'Zero marginal cost per evaluation. Career-Ops runs on a Claude Max subscription, which covers all Claude Code usage across every project: portfolio development, OpenClaw development, and Career-Ops itself. Each evaluation uses approximately 4,000-6,000 input tokens for the JD plus CV context and generates around 2,000 tokens of evaluation output. Under the Max plan, this volume is well within the included capacity. There is no per-API-call billing, no token metering, and no usage caps that would throttle batch processing. The economics make it viable to evaluate every offer the scanner finds rather than pre-filtering manually.',
        },
        {
          q: 'Does the apply mode fill forms automatically?',
          a: 'The apply mode uses Playwright to navigate to the application form, take a snapshot of all visible fields, and read the page structure including labels, placeholders, and required field indicators. It then retrieves the cached evaluation report for that company and role, which contains the 10-dimension scoring, matched proof points, and relevant keywords. From this context, it generates coherent responses for each form field: cover letter text draws from the evaluation personalization section, the motivation question pulls from the company research, and skills questions reference the specific proof points that scored highest in the CV match dimension. Every generated response is displayed for my review before any field is filled. I approve, edit, or reject each answer individually. The submit button is never clicked by the system — that is always my action.',
        },
        {
          q: 'What happens when the scanner finds a duplicate?',
          a: 'The dedup system works in two layers. First, scan-history.tsv stores every URL the scanner has ever seen with a timestamp and source portal. Each new URL is checked against this file using exact string matching after normalization (stripping tracking parameters, trailing slashes, and query strings). Second, even if the URL is new, Career-Ops performs a fuzzy match against applications.md using a normalized company name plus role title comparison. This catches the common case where the same job is posted on multiple portals with different URLs. The company name is lowercased and stripped of suffixes like Inc or GmbH, and the role title is compared after removing seniority prefixes. If both layers pass, the offer enters the pipeline. If either catches a match, it is silently skipped. The result: zero duplicate evaluations.',
        },
        {
          q: 'Is it replicable?',
          a: 'Yes. Career-Ops is open source on GitHub, created by santifer. You need Claude Code with Playwright browser access enabled for portal scanning and form filling, plus a structured working directory following the data contract: cv.md as the canonical resume, a profile configuration file with your target roles and salary range, and a portals configuration listing the job boards and company career pages to scan. Each of the 12 operational modes is defined as a Claude Code skill file with its own context window, rules, and tool permissions. Fork the repository and customize the scoring dimensions, archetypes, and evaluation criteria for your own career profile. The onboarding flow walks you through setup step by step. That is exactly what I did — forked it, customized the profile for my AI Developer and DevOps targets, and started using it.',
        },
      ],
    },
  }

export const careerOpsContent = _en
