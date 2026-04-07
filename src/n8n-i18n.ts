export type N8nLang = 'es' | 'en'

/**
 * Classification prompt used in Workflow 2.
 * Identical in both languages — it's a prompt for LLMs, always in English.
 */
export const CLASSIFICATION_PROMPT = `You are a product feedback classifier for a SaaS company.

Your task: classify the feedback below into exactly ONE category.

Categories:
- BUG — The user reports something broken, crashing, erroring, or not
  working as expected. Look for words like: crash, error, broken, fail,
  wrong, doesn't work, can't.
- FEATURE — The user requests new functionality or an improvement to
  existing features. Look for words like: add, would be nice, wish,
  could you, suggestion, improve.
- QUESTION — The user asks how to do something or needs help
  understanding the product. Look for words like: how do I, where is,
  can I, is it possible, help.

Rules:
- If the feedback contains BOTH a bug and a feature request, classify
  as BUG (broken things take priority).
- If unclear, classify as QUESTION (safest default — a human will review).
- Respond with ONLY the category name in caps. No explanation, no punctuation.

Feedback: {{ $json.Feedback }}`

const _en = {
    slug: 'n8n-for-pms',
    altSlug: 'n8n-para-pms',
    readingTime: '5 min read',
    seo: {
      title: 'n8n for PMs: Cheat Sheet + Free AI Templates | cv-joseph.vercel.app',
      description: 'n8n cheat sheet for Product Managers: automate sprint reports and classify feedback with AI. 2 free importable workflow templates. Step-by-step tutorial.',
    },
    nav: {
      back: 'cv-joseph.vercel.app',
      breadcrumbHome: 'Home',
      breadcrumbCurrent: 'n8n for PMs',
    },
    header: {
      kicker: 'Lightning Session — <a>Marily Nika\'s AI Product Academy</a>',
      h1: 'n8n for Product Managers: Cheat Sheet with Templates',
      subtitle: 'Practical cheat sheet: automate your sprint reports and classify feedback with AI using n8n workflows — no code required. 2 free importable templates.',
      date: 'Feb 24, 2026',
    },
    intro: {
      hook: 'How many hours a week do you spend on work that has nothing to do with product?',
      body: 'I tracked mine. It was twenty. Some weeks, thirty. Sprint reports that take a full day. Feedback scattered across five tools that I had to read, classify, and turn into tickets one by one. Status updates typed from scratch every Monday.',
      punchline: 'I wasn\'t a product manager. I was a very expensive data router. Moving information between tools that should have been talking to each other. I spent 170 hours a month on this at my own company before I automated all of it. Both workflows are free, importable as JSON, and run on n8n Cloud\'s free tier. No infrastructure, no permission from engineering. Today I\'ll show you how to build them in an afternoon.',
    },
    previewCta: {
      text: 'This is a preview of what I teach as a Teaching Fellow at <a>Marily Nika\'s AI PM Bootcamp</a>. The full course covers how to build AI products end-to-end — from discovery to production. Both workflows below are real: I use them weekly at my own company.',
    },
    timeSinks: {
      heading: 'The 5 PM Time Sinks (20-30 hours/week)',
      columns: { num: '#', sink: 'Time Sink', hours: 'Hours/Week', pattern: 'Automation Pattern' },
      rows: [
        { num: '1', sink: 'Sprint reports', hours: '8-12/sprint', pattern: 'Schedule → Query → Format → Send' },
        { num: '2', sink: 'Classifying feedback', hours: '5-10', pattern: 'Trigger → AI Classify → Route' },
        { num: '3', sink: 'Moving data between tools', hours: '3-5', pattern: 'Trigger → Extract → Create → Notify' },
        { num: '4', sink: 'Keeping team in sync', hours: '2-4', pattern: 'Schedule → Aggregate → Summarize → Post' },
        { num: '5', sink: 'Preparing for decisions', hours: '1-2/meeting', pattern: 'Schedule → Multi-query → Compile → Send' },
      ],
    },
    workflow1: {
      heading: 'Workflow 1: The Automatable Friday',
      description: 'Automated sprint report that posts to Slack every Friday at 9am.',
      pipelineLabels: [
        { name: 'Schedule', detail: '(Fri 9am)' },
        { name: 'Airtable', detail: '(read sprint)' },
        { name: 'Code', detail: '(format)' },
        { name: 'Slack', detail: '(post)' },
      ],
      imgAlt: 'n8n automated sprint report workflow for product managers: Schedule Trigger every Friday → Read Sprint Data from Airtable → Format Report with Code node → Post to Slack channel',
      imgTitle: 'Workflow 1: Automated Sprint Report with n8n',
      figcaption: 'Workflow 1 in n8n: automated sprint report — Schedule → Airtable → Code → Slack',
      nodesHeading: 'Key nodes:',
      nodes: [
        { name: 'Schedule Trigger:', detail: 'Every week, Friday, 9:00 AM' },
        { name: 'Airtable:', detail: 'Filter by Sprint = Current, Status = Done' },
        { name: 'Code node:', detail: 'Group by assignee, count story points, format as Slack markdown' },
        { name: 'Slack:', detail: 'Post to #sprint-updates' },
      ],
      quote: 'Your sprint report arrives every Friday at 9:05am. You did nothing.',
      downloadLabel: 'Download Workflow 1 JSON',
    },
    transition: {
      line1: 'There\'s no AI in Workflow 1. It\'s pure plumbing.',
      line2: 'Four nodes that save you 4-6 hours every sprint. Now imagine what happens when we add intelligence.',
    },
    workflow2: {
      heading: 'Workflow 2: The Intelligent Router',
      description: 'AI-powered feedback classification that routes bugs, features, and questions to the right Slack channel. One AI node turns a dumb pipe into a smart pipe.',
      pipelineLabels: [
        { name: 'Form Trigger', detail: '' },
        { name: 'AI Classify', detail: '(LLM)' },
        { name: 'Switch', detail: '(Bug/Feature/Question)' },
        { name: 'Slack', detail: '+ Airtable' },
      ],
      imgAlt: 'n8n AI feedback classification workflow for product managers: Form Trigger → AI Classifier with Claude → Switch node routes bugs, features, and questions to separate Slack channels → Log to Airtable',
      imgTitle: 'Workflow 2: AI-Powered Feedback Classification with n8n',
      figcaption: 'Workflow 2 in n8n: AI feedback classifier — Form → Claude AI → Switch → Slack + Airtable',
      nodesHeading: 'Key nodes:',
      nodes: [
        { name: 'n8n Form Trigger:', detail: 'Name, Email, Feedback Text, Product Area' },
        { name: 'Basic LLM Chain:', detail: 'Classify feedback using AI' },
        { name: 'Switch:', detail: 'Route based on LLM output (BUG / FEATURE / QUESTION)' },
        { name: 'Slack:', detail: 'Different channel per category' },
        { name: 'Airtable:', detail: 'Log every classified feedback' },
      ],
      promptHeading: 'The Classification Prompt',
      promptCopyLabel: 'Copy prompt',
      promptCopiedLabel: 'Copied!',
      whyWorksHeading: 'Why this prompt works:',
      whyWorks: [
        { label: 'Role', detail: 'sets context ("product feedback classifier")' },
        { label: 'Signal words', detail: 'per category guide the LLM\'s pattern matching' },
        { label: 'Tiebreaker rule', detail: 'handles ambiguous cases (bugs > features > questions)' },
        { label: 'Safe default', detail: 'ensures nothing gets lost' },
        { label: 'Strict output', detail: 'makes the Switch node reliable' },
      ],
      quote: 'One AI node turned a dumb pipe into a smart pipe.',
      ambiguousHeading: 'The Ambiguous Test',
      ambiguousExample: '"It would be really nice if the export could handle more than 100 rows without crashing."',
      ambiguousExplanation1: 'Is this a feature request ("it would be nice") or a bug ("crashing")? The tiebreaker rule in the prompt handles it: if feedback contains both a bug and a feature request, classify as BUG — broken things take priority.',
      ambiguousExplanation2: 'If you disagree with that classification, you change one line of the prompt. Not a model retrain. Not a ticket to data science. One line of text. You wrote acceptance criteria, not code — and that\'s a product decision, not an engineering decision.',
      downloadLabel: 'Download Workflow 2 JSON',
    },
    pattern: {
      heading: 'The Pattern',
      description: 'Both workflows follow the same structure:',
      labels: {
        trigger: 'TRIGGER',
        read: 'READ',
        process: 'PROCESS',
        act: 'ACT',
        when: 'when',
        getData: 'get data',
        transform: 'transform/classify',
        notify: 'notify/log',
      },
      worksFor: 'This pattern works for:',
      useCases: [
        'Prioritizing support tickets',
        'Routing sales leads',
        'Triaging customer complaints',
        'Classifying NPS responses',
        'Processing form submissions',
      ],
      punchline: 'The pipe stays the same. The prompt changes.',
    },
    bootcampCta: {
      heading: 'Want to go deeper into AI Product Management?',
      body: 'What you just read is a fraction of what I cover at Marily Nika\'s AI PM Bootcamp. The full program takes you from "I want to use AI" to "I\'m shipping AI products" — with real projects, not theory. It\'s where I trained, and I now teach there as a Fellow.',
      cta: 'Join the next cohort',
    },
    getStarted: {
      heading: 'Get Started',
      steps: [
        { num: 1, text: '<a>n8n Cloud (14-day free trial)</a> — sign up and start building' },
        { num: 2, text: 'Pick your most boring Friday task' },
        { num: 3, text: 'Build one workflow this week' },
      ],
      bonusStep: 'Want to learn AI Product Management end-to-end? Check out the <a>AI PM Bootcamp by Dr. Marily Nika</a> — where I trained and now teach as a Fellow.',
      quote: 'The first automation is the hardest. The second takes half the time.',
    },
    lessons: {
      heading: 'What I Learned Automating 170 Hours a Month',
      items: [
        {
          title: 'Automate the boring task first.',
          detail: 'The flashy use case is tempting. But sprint reports won me 12 hours back every two weeks — more than any clever integration I built.',
        },
        {
          title: 'Your database is the brain.',
          detail: 'Don\'t build a separate "automation database." Jira, Airtable, and Sheets already contain 90% of the data your workflows need.',
        },
        {
          title: 'Automate the trigger, not just the task.',
          detail: 'A workflow that runs "when I click a button" saves time. A workflow that runs "when a deal closes" saves time AND removes you from the loop entirely. The second kind is worth 10x more.',
        },
        {
          title: 'Start with one.',
          detail: 'I tried to automate everything at once and ended up with 14 half-broken workflows and zero time savings. One workflow running reliably beats five in draft mode.',
        },
      ],
    },
    faq: {
      heading: 'Common Questions',
      items: [
        {
          q: 'Can n8n connect to Jira / Salesforce / my tool?',
          a: 'Yes. Over 400 integrations — Jira, Salesforce, Notion, Linear, HubSpot, Zendesk, Google Sheets. If you use it, n8n probably connects to it.',
        },
        {
          q: 'Is n8n free?',
          a: 'Self-hosted is free forever (open source, no limits). Cloud gives you a 14-day free trial of the Pro plan, no credit card required. After that, plans start at €24/month. The trial is more than enough for everything shown here.',
        },
        {
          q: 'What LLM should I use for the classifier?',
          a: 'Whatever your company already pays for. The prompt works the same with Claude, GPT-4, or Gemini. The classification pattern doesn\'t change with the model.',
        },
        {
          q: 'How is this different from Zapier or Make?',
          a: 'Open source, self-hostable, AI nodes built in, and a visual canvas that lets you see the branching logic. Zapier is great for simple triggers. n8n is for when you need branching, AI, loops, and full control.',
        },
        {
          q: 'What if the AI classifies something wrong?',
          a: 'You change the prompt. Add a new signal word, adjust the tiebreaker rule, add a category. You iterate in plain English, not in code. And the Airtable log lets you review and correct.',
        },
        {
          q: 'Can I download the n8n templates from this article?',
          a: 'Yes. Both workflows are available as JSON files you can import directly into n8n Cloud (free tier). Download them from the "Import Workflows" section and they\'ll be running in 5 minutes.',
        },
      ],
    },
    import: {
      heading: 'Import the Workflows',
      description: 'Download the JSON files and import them directly into your n8n instance:',
      wf1Label: 'Workflow 1 — The Automatable Friday',
      wf2Label: 'Workflow 2 — The Intelligent Router',
      howToHeading: 'How to import:',
      howToText: 'In n8n, click the + button, select "Import from File", and choose the JSON. Then connect your own Slack, Airtable, and AI credentials.',
    },
    resources: {
      heading: 'Resources',
      items: [
        { label: 'n8n Documentation', url: 'https://docs.n8n.io' },
        { label: 'Airtable node docs', url: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.airtable/' },
        { label: 'AI nodes guide', url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/' },
      ],
    },
    footer: {
      role: 'AI Product Manager · Solutions Architect',
      fellowAt: 'Teaching Fellow at',
      fellowLink: 'AI Product Academy',
      copyright: 'All rights reserved.',
    },
  }

export const n8nContent = { es: _en, en: _en } as const

/** Helper to get content for a given language */
export function getN8nContent(lang: N8nLang) {
  return n8nContent[lang]
}

/** Derive the type of a single language's content */
export type N8nContent = (typeof n8nContent)['en']
