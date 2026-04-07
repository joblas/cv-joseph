const _en = {
    slug: 'career-ops-system',
    altSlug: 'career-ops',
    readingTime: '18 min read',
    seo: {
      title: 'Career-Ops: How I Built My Own AI Job Search Tool',
      description: 'Case study: AI job search tool built as a multi-agent system. AI resume builder, 10D scoring, automated job application with HITL. 631 evaluations.',
    },
    nav: {
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'Career-Ops',
    },
    header: {
      kicker: 'Case Study: Production system',
      h1: 'Career-Ops: How I Built My Own AI Job Search Tool',
      subtitle: 'A multi-agent system that scores offers across 10 dimensions, works as an AI resume builder per listing, and automates job applications with HITL. 631 evaluations, 12 modes, one person.',
      badge: 'Live production system — actively in use',
      date: 'Mar 17, 2026',
    },
    heroMetrics: [
      { value: '631', label: 'Evaluations' },
      { value: '302', label: 'Apps processed' },
      { value: '12', label: 'Modes' },
      { value: '10', label: 'Dimensions' },
      { value: '680', label: 'URLs deduped' },
    ],
    tldr: 'A multi-agent system built with Claude Code that automates the job search: scores offers across 10 dimensions (A-F), generates ATS-optimized PDFs per offer, fills forms via Playwright, and batch-processes with parallel workers. HITL design: AI analyzes, I decide.',
    metaCallout: 'The irony: the system demonstrates the exact competencies the target roles require — multi-agent architecture, automation, LLMOps, and HITL design. And no, it is not gaming the system: Career-Ops automates analysis, not decisions. I read every report and review every PDF before sending.',
    internalLinks: {
      chatbot: {
        text: 'The Self-Healing Chatbot | Case Study',
        href: '/self-healing-chatbot',
      },
      jacobo: {
        text: 'AI Agent Jacobo | Case Study',
        href: '/ai-agent-jacobo',
      },
      businessOs: {
        text: 'Business OS | Case Study',
        href: '/business-os-for-airtable',
      },
      pseo: {
        text: 'Programmatic SEO | Case Study',
        href: '/programmatic-seo',
      },
    },
    sections: {
      intro: {
        hook: 'I no longer apply to jobs. A multi-agent system evaluates them, generates my personalized resume, and prepares the application. I review and decide. Week one of my AI job search was all manual: read JDs, map skills, fill forms. By week two I had stopped applying — I was building Career-Ops.',
        body: '631 evaluations later, Career-Ops makes more filtering decisions than I do. An AI-powered job search tool built as a multi-agent system: reads job descriptions, scores them across 10 dimensions, generates AI resumes per listing, and automates job applications. I review and decide. The AI does the analytical work.',
      },
      theProblem: {
        heading: 'The Problem',
        body: 'Searching for senior AI engineering roles is a full-time job in itself. Each offer requires reading the JD, mapping your skills against requirements, adapting the CV, writing personalized responses, and filling 15-field forms. Multiply that by 10 offers per day.',
        painPoints: [
          { label: 'Repetitive reading.', detail: '70% of offers are a poor fit. You find out after reading 800 words of JD.' },
          { label: 'Generic CVs.', detail: 'A static PDF cannot highlight the proof points relevant to each specific offer.' },
          { label: 'Manual forms.', detail: 'Every platform asks the same questions in different formats. Copy-paste 15 times per application.' },
          { label: 'No tracking.', detail: 'Without a system, you forget where you applied. Duplicate effort or lose follow-up entirely.' },
          { label: 'Zero feedback.', detail: 'Apply, wait, and never know if the problem was fit, the CV, or timing.' },
          { label: 'Global market.', detail: 'The AI sector moves internationally. Local referrals do not scale when you apply to companies across 6 different countries.' },
        ],
        punchline: 'The work is not hard. It is repetitive. And repetitive work gets automated.',
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
          { name: 'batch', desc: 'Parallel processing with conductor + workers. 122 simultaneous URLs in queue.' },
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
          { label: 'Dedup.', detail: 'Checks scan-history.tsv (680 URLs) and applications.md. Zero re-evaluations.' },
        ],
        batch: {
          heading: 'Batch Processing',
          body: 'For high volume, batch mode launches a conductor that orchestrates parallel workers. Each worker is an independent Claude Code process with 200K context. The conductor manages the queue, tracks progress, and merges results.',
          metrics: [
            { value: '122', label: 'URLs in queue' },
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
          { label: 'Detect language.', detail: 'English JD generates English CV. Spanish JD generates Spanish CV.' },
          { label: 'Detect region.', detail: 'US company generates Letter format. Europe generates A4.' },
          { label: 'Detect archetype.', detail: '6 North Star archetypes. The summary shifts based on the profile.' },
          { label: 'Select projects.', detail: 'Top 3-4 by relevance. Jacobo for agent roles. Business OS for ERP/automation.' },
          { label: 'Reorder bullets.', detail: 'The most relevant experience moves up. The rest moves down — nothing disappears.' },
          { label: 'Render PDF.', detail: 'Puppeteer converts HTML to PDF. Self-hosted fonts, single-column ATS-safe.' },
        ],
        archetypes: {
          heading: '6 Archetypes',
          headers: ['Archetype', 'Primary Proof Point'],
          rows: [
            ['AI Platform / LLMOps', 'Self-Healing Chatbot (71 evals, closed-loop)'],
            ['Agentic Workflows', 'Jacobo (4 agents, 80h/mo automated)'],
            ['Technical AI PM', 'Business OS (2,100 fields, 50 automations)'],
            ['AI Solutions Architect', 'pSEO (4,730 pages, 10.8x traffic)'],
            ['AI FDE', 'Jacobo (sold, running in production)'],
            ['AI Transformation Lead', 'Exit 2025 (16 years, buyer kept all systems)'],
          ],
        },
        callout: 'Same CV. 6 different framings. All real — keywords get reformulated, never fabricated.',
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
          ['Batch', 'One at a time', '122 URLs in parallel'],
          ['Dedup', 'Human memory', '680 URLs deduplicated'],
        ],
      },
      results: {
        heading: 'Results',
        body: 'The system has been in production for 2 months. 631 reports across 516 unique offers (some re-evaluated after criteria changes). Live numbers — the tracker grows every day.',
        metrics: [
          { value: '631', label: 'Reports generated' },
          { value: '68', label: 'Applications sent' },
          { value: '354', label: 'PDFs generated' },
          { value: '0', label: 'Re-evaluations' },
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
            title: 'Automate analysis, not decisions',
            detail: 'Career-Ops evaluates 631 offers. I decide which ones get my time. HITL is not a limitation — it is the design. AI filters noise, humans provide judgment.',
          },
          {
            title: 'Modes beat a long prompt',
            detail: '12 modes with precise context outperform a 10,000-token system prompt. Each mode loads only what it needs. Less context means better decisions.',
          },
          {
            title: 'Dedup is more valuable than scoring',
            detail: '680 deduplicated URLs mean 680 evaluations I never had to repeat. Dedup saves more time than any scoring optimization.',
          },
          {
            title: 'A CV is an argument, not a document',
            detail: 'A generic PDF convinces nobody. A CV that reorganizes proof points by relevance, injects the right keywords, and adapts framing to the archetype — that CV converts.',
          },
          {
            title: 'Batch over sequential, always',
            detail: 'Batch mode with parallel workers processes 122 URLs while I do something else. The investment in parallel orchestration pays off on the first run.',
          },
          {
            title: 'The system IS the portfolio',
            detail: 'Building a multi-agent system to search for multi-agent roles is the most direct proof of competence. I do not need to explain that I can do this — I am using it.',
          },
        ],
      },
      cta: {
        heading: 'Ask',
        body: 'Open the chat and ask how I built Career-Ops. Or check the other systems that demonstrate the same competencies.',
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
          a: 'A script pipeline follows fixed rules — it cannot reason about context, weigh ambiguous signals, or generate narrative analysis. Career-Ops uses Claude Code as an LLM agent that reads the full job description, cross-references it against my CV and portfolio proof points, and produces a 10-dimension evaluation with contextual reasoning for each score. It detects when a role title says Senior but the responsibilities suggest Staff level. It recognizes when a startup listing compensation as competitive likely means below market. It reformulates keywords from my real experience to match the JD vocabulary without fabricating skills I do not have. The output is a narrative evaluation report with specific rationale per dimension, not a template with blanks filled in. That reasoning capability is why an LLM agent outperforms any deterministic script for this task.',
        },
        {
          q: 'What does it cost to run?',
          a: 'Zero marginal cost per evaluation. Career-Ops runs on my Claude Max 20x subscription at $200 per month, which covers all Claude Code usage across every project: portfolio development, chatbot maintenance, article writing, and Career-Ops itself. The 631 evaluations, 354 generated PDFs, and all batch processing sessions consumed no additional budget beyond the flat subscription. Each evaluation uses approximately 4,000-6,000 input tokens for the JD plus CV context and generates around 2,000 tokens of evaluation output. Under the Max plan, this volume is well within the included capacity. There is no per-API-call billing, no token metering, and no usage caps that would throttle batch processing. The economics make it viable to evaluate every offer the scanner finds rather than pre-filtering manually.',
        },
        {
          q: 'Does the apply mode fill forms automatically?',
          a: 'The apply mode uses Playwright to navigate to the application form, take a snapshot of all visible fields, and read the page structure including labels, placeholders, and required field indicators. It then retrieves the cached evaluation report for that company and role, which contains the 10-dimension scoring, matched proof points, and relevant keywords. From this context, it generates coherent responses for each form field: cover letter text draws from the evaluation personalization section, the motivation question pulls from the company research, and skills questions reference the specific proof points that scored highest in the CV match dimension. Every generated response is displayed for my review before any field is filled. I approve, edit, or reject each answer individually. The submit button is never clicked by the system — that is always my action.',
        },
        {
          q: 'What happens when the scanner finds a duplicate?',
          a: 'The dedup system works in two layers. First, scan-history.tsv stores every URL the scanner has ever seen — currently 680+ entries — with a timestamp and source portal. Each new URL is checked against this file using exact string matching after normalization (stripping tracking parameters, trailing slashes, and query strings). Second, even if the URL is new, Career-Ops performs a fuzzy match against applications.md using a normalized company name plus role title comparison. This catches the common case where the same job is posted on multiple portals with different URLs. The company name is lowercased and stripped of suffixes like Inc or GmbH, and the role title is compared after removing seniority prefixes. If both layers pass, the offer enters the pipeline. If either catches a match, it is silently skipped. The result: zero duplicate evaluations across 631 processed offers.',
        },
        {
          q: 'Is it replicable?',
          a: 'Yes, with prerequisites. You need Claude Code with Playwright browser access enabled for portal scanning and form filling, plus a structured working directory following the data contract: cv.md as the canonical resume, a profile configuration file with your target roles and salary range, and a portals configuration listing the job boards and company career pages to scan. Each of the 12 operational modes is defined as a Claude Code skill file with its own context window, rules, and tool permissions. The system is open source on GitHub, so you can fork the repository and customize the scoring dimensions, archetypes, and evaluation criteria for your own career profile. It is replicable but not plug-and-play — you need to invest time adapting the profile, archetypes, and scoring weights to match your specific job search targets and professional background.',
        },
      ],
    },
  }

export const careerOpsContent = _en
