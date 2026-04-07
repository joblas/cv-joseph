const _seoEn = {
  title:
    'Joseph Blas | AI Developer · AV Systems Veteran · Multi-Agent Systems',
  description:
    'AI Developer & AV Systems Veteran. 15+ years from building Google\'s self-driving car to 22-agent AI systems. React, TypeScript, Python. Full-stack AI apps in production.',
};

export const seo = _seoEn;

const _translationsEn = {
  greeting: 'who builds',
  greetingRoles: ['AI Developer', 'DevOps / SRE', 'Embedded / Robotics'],
  email: 'blasj408@gmail.com',
  role: 'autonomous & AI systems.',
  story: {
    context: '+15 years building+ everything from scratch.',
    reflections: ['It works. It drives itself.', '...now what?'],
    hookParagraphs: [
      ["I built Google's self-driving car. Then I automated an entire business with AI."],
      [
        "The thread is always the same.",
        '*Complex systems* +that work in production+.',
      ],
    ],
    why: "From sensor calibration to drive-by-wire wiring, from executive demos to orchestrating 22 AI agents — my career is a bridge between hardware and software.",
    seeking: [
      'This still feels like day one.',
      'Bigger teams. Harder problems. End-to-end.',
      "Ready for what's next.",
    ],
    nav: [
      { icon: 'briefcase', label: 'My path', href: '#experience' },
      { icon: 'folder', label: 'What I build', href: '#projects' },
      { icon: 'mail', label: "Let's talk", href: '#contact' },
      { icon: 'bot', label: 'Ask me', href: '#chat', highlight: true },
    ],
    skills: [
      'Multi-Agent AI',
      'Full-Stack AI Dev',
      'AV Systems Integration',
      'Cloud & DevOps',
      'Hardware-Software Bridge',
      'Client Delivery',
    ],
    skipButton: 'Skip intro',
  },
  taglines: [] as readonly string[],
  location: 'Escondido, CA · San Diego',
  roles: [
    'AI Developer',
    'DevOps / SRE Engineer',
    'Embedded / Robotics Engineer',
  ],
  summary: {
    title: 'Professional Summary',
    p1: 'AI developer building',
    p1Highlight: 'production multi-agent systems',
    p1End:
      '. Run a 22-agent AI team that handles real business operations — email, CRM, invoicing, SEO, and deployments. Ship full-stack applications using React/React Native, TypeScript, Python, and PostgreSQL.',
    p2: 'Previously: 15+ years as an',
    p2Highlight: 'autonomous vehicle systems specialist',
    p2End: ' at Google, Uber, and startups. Drive-by-wire SME, sensor calibration, fleet operations.',
    cards: [
      {
        title: 'Builder Mindset',
        desc: 'Prototype to production — hardware and software',
      },
      {
        title: 'Strengths',
        desc: 'Complex systems integration, fast ramp-up, E2E ownership',
      },
      {
        title: 'Technical Fluency',
        desc: 'AI/LLM, React, Python, Docker, K8s, CAN/LIN, sensor calibration',
      },
    ],
  },
  coreCompetencies: {
    title: 'Core Competencies',
    items: [
      {
        title: 'Multi-Agent AI Systems',
        desc: '22-agent orchestration (n8n, CrewAI, LangChain), RAG, prompt engineering',
      },
      {
        title: 'Full-Stack AI Development',
        desc: 'React, TypeScript, Python, Next.js, Supabase, AI APIs',
      },
      {
        title: 'AV Systems Integration',
        desc: 'Sensor calibration, drive-by-wire SME, ADAS validation, CAN/LIN',
      },
      {
        title: 'Client-Facing Delivery',
        desc: '10+ executive/investor demos, client consulting, private AI deployment',
      },
      {
        title: 'Cloud & DevOps',
        desc: 'AWS, GCP, Docker, K8s, Terraform, CI/CD',
      },
      {
        title: 'Hardware-Software Bridge',
        desc: 'HIL test rigs, bench testing, embedded validation, wiring harness fabrication',
      },
    ],
  },
  techStack: {
    title: 'Tech Stack',
    categories: [
      {
        name: 'AI / LLM',
        items: [
          'Claude & OpenAI APIs',
          'LangChain / CrewAI',
          'RAG Systems',
          'Ollama / Open WebUI',
        ],
      },
      {
        name: 'Frontend',
        items: ['React', 'React Native', 'Next.js', 'Tailwind CSS', 'Expo'],
      },
      {
        name: 'Backend',
        items: ['Node.js', 'Python / Flask', 'PostgreSQL', 'Supabase', 'REST APIs'],
      },
      {
        name: 'DevOps',
        items: [
          'Docker',
          'Kubernetes',
          'Terraform',
          'AWS / GCP',
          'CI/CD',
          'Git',
        ],
      },
      {
        name: 'Agent Systems',
        items: ['n8n', 'Multi-agent orchestration', 'Workflow automation'],
      },
      {
        name: 'AV / Hardware',
        items: ['Drive-by-wire', 'Sensor calibration', 'CAN/LIN', 'ADAS', 'HIL'],
      },
    ],
  },
  projects: {
    title: 'Projects',
    githubLink: 'github.com/joblas',
    viewCode: 'View code',
    viewPrototype: 'View prototype',
    items: [
      {
        title: 'OpenClaw',
        badge: 'In production',
        badgeBuilding: '',
        desc: 'Multi-agent AI system running real business operations. 22 specialized agents orchestrated via n8n handling email routing, CRM automation, invoicing, SEO optimization, deployment pipelines. Uses Claude and OpenAI APIs with custom prompt engineering.',
        tech: ['n8n', 'Claude API', 'OpenAI API', 'Multi-Agent', 'Prompt Engineering'],
        link: '',
        caseStudyUrl: '/openclaw',
        caseStudyLabel: 'Case Study: OpenClaw Multi-Agent System',
      },
      {
        title: 'The Skate Workshop',
        badge: 'In production',
        badgeBuilding: '',
        desc: 'Full-stack React Native mobile app for Olympic-level skateboarding coach. 40+ Supabase tables, 18+ Edge Functions, Stripe Connect marketplace, multiplayer SKATE game mode, real-time features.',
        tech: ['React Native', 'TypeScript', 'Supabase', 'Stripe Connect', 'Expo'],
        link: 'theskateworkshop.app',
      },
      {
        title: 'Career Ops',
        badge: 'Open Source',
        badgeBuilding: '',
        desc: 'AI-powered job search pipeline. Evaluates offers with scoring, generates ATS-optimized CVs, pre-fills applications. Built on Claude Code.',
        tech: ['Claude Code', 'Puppeteer', 'Playwright', 'Node.js', 'HITL Design'],
        link: 'github.com/joblas/career-ops',
        caseStudyUrl: '',
        caseStudyLabel: '',
      },
      {
        title: 'cv-joseph',
        badge: 'This Portfolio',
        badgeBuilding: '',
        desc: 'Interactive CV with AI chatbot, agentic RAG, voice mode, Langfuse observability, and multi-layer defense. SSR prerender, bilingual i18n.',
        tech: ['React 19', 'TypeScript', 'Tailwind', 'Vite', 'Claude API', 'Vercel'],
        link: 'github.com/joblas/cv-joseph',
      },
      {
        title: 'DALL-E Image Generator',
        badge: 'In production',
        badgeBuilding: '',
        desc: 'Production AI image generation web application using OpenAI DALL-E 3.0 API. Live application serving real users.',
        tech: ['OpenAI DALL-E 3.0', 'React', 'Node.js', 'REST API'],
        link: 'jblas-dall-e.com',
      },
      {
        title: 'Whisper Walkie',
        badge: 'Open Source',
        badgeBuilding: '',
        desc: 'Push-to-talk voice typing tool with 100% local processing. No data sent to the cloud.',
        tech: ['Python', 'Whisper', 'Local Processing'],
        link: 'github.com/joblas/whisper-walkie',
      },
      {
        title: 'Cloud Infrastructure',
        badge: 'DevOps',
        badgeBuilding: '',
        desc: 'Multicloud Terraform deployment (AWS/GCP), K8s migration with Cloud SQL HA, legacy modernization with Anthos/GKE.',
        tech: ['Terraform', 'AWS', 'GCP', 'Kubernetes', 'Cloud SQL'],
        link: 'github.com/joblas',
      },
    ],
    saPlaybook: {
      title: 'Private AI Solutions',
      badge: 'Consulting · For Clients',
      tagline: '',
      desc: 'Private AI solutions for SMBs using Ollama, Open WebUI, and n8n. Client data never leaves their servers.',
      features: [
        { icon: 'zap', text: '100% local deployment — no cloud data leakage' },
        {
          icon: 'shield',
          text: 'Self-hosted open source LLMs (Llama, Mistral)',
        },
        {
          icon: 'fileText',
          text: 'n8n automation workflows',
        },
        { icon: 'git', text: 'Integration with existing client systems' },
      ],
      footer: 'Available for private AI consulting',
      cta: 'Get in touch',
    },
  },
  claudeCode: {
    title: 'AI Coding Power User',
    badge: 'High-Agency · AI-Native',
    desc: 'I use AI coding assistants daily as core development tools. From multi-agent orchestration to full-stack apps, AI amplifies every phase of my workflow.',
    highlights: [
      'Multi-agent orchestration: 22 specialized agents handling real business operations via n8n',
      'RAG systems: embeddings, similarity search, context-augmented generation',
      'Prompt engineering: system prompt design, evaluations, quality/cost optimization',
      'Full-stack AI apps: prototype to production using Claude, OpenAI, and open source models',
    ],
    certs: [] as readonly { title: string; url: string }[],
  },
  experience: {
    title: 'Work Experience',
    santifer: {
      company: "Joe's Tech Solutions LLC",
      location: 'San Diego, CA',
      role: 'Founder & AI Developer',
      period: '2023 - Present · AI / Software',
      caseStudyUrl: '/openclaw',
      caseStudyLabel: 'Case Study: OpenClaw System',
      exit: 'GREEN LIGHTING — 2025',
      exitDesc: 'Successfully built, scaled, and exited my venture. Sold the systems, team, and brand. Now returning to my roots in complex engineering.',
      highlights: [
        'Built and operate 22-agent AI system handling real business operations',
        'Develop private AI solutions for SMB clients using Ollama, Open WebUI, and n8n',
        'Ship production web and mobile apps: React, Next.js, React Native, TypeScript, Supabase',
        'Created Whisper Walkie — open source push-to-talk voice typing tool (100% local processing)',
        'Built The Skate Workshop — React Native app for Olympic coach (40+ tables, Stripe Connect)',
        'Career Ops — AI-powered job search pipeline (open source)',
      ],
      trustedBy: {
        label: 'Key technologies',
        logos: [] as readonly { name: string; icon?: string; src?: string }[],
      },
      businessOS: {
        title: 'OpenClaw — 22-Agent System',
        badge: 'Multi-Agent · n8n',
        desc: 'Multi-agent AI system running real business operations. 22 specialized agents orchestrated via n8n: email routing, CRM automation, invoicing, SEO, deployments.',
        metrics: [
          { value: '22', label: 'agents' },
          { value: 'n8n', label: 'orchestrator' },
          { value: '24/7', label: 'operation' },
        ],
        modules: [
          {
            icon: 'network',
            text: 'Main router classifies intents and delegates to specialized agents',
          },
          {
            icon: 'messageSquare',
            text: 'Email routing with automatic classification and contextual response',
          },
          {
            icon: 'users',
            text: 'CRM automation: client tracking, scoring, nurturing',
          },
          {
            icon: 'receipt',
            text: 'Automated invoicing and report generation',
          },
          {
            icon: 'trendingUp',
            text: 'SEO optimization: content analysis, meta tag generation',
          },
          {
            icon: 'package',
            text: 'Deployment pipelines: automated CI/CD',
          },
        ],
        footer: 'Case Study: OpenClaw System',
      },
      jacobo: {
        title: 'Private AI Solutions',
        badge: '100% local',
        desc: 'Private AI solutions for SMBs. Self-hosted open source LLMs, client data never leaves their servers.',
        items: [
          {
            icon: 'shield',
            text: 'Ollama + Open WebUI: full chat interface with local models',
          },
          {
            icon: 'network',
            text: 'n8n workflows: AI-powered business process automation',
          },
          {
            icon: 'database',
            text: 'Local RAG: embeddings over client documents',
          },
          {
            icon: 'zap',
            text: 'Integration with existing systems (CRM, email, etc.)',
          },
          {
            icon: 'userCheck',
            text: 'Client team training for adoption',
          },
        ],
        soldWith: '',
        caseStudyUrl: '',
      },
      webSeo: {
        title: 'Production Applications',
        badge: 'Full-Stack · In Production',
        desc: 'Complete applications in production serving real users. React/React Native frontend, Supabase/PostgreSQL backend, Stripe and external API integrations.',
        items: [
          {
            icon: 'layout',
            text: 'The Skate Workshop: React Native app with 40+ Supabase tables',
          },
          {
            icon: 'image',
            text: 'DALL-E Image Generator: web app with OpenAI DALL-E 3.0 API',
          },
          {
            icon: 'trendingUp',
            text: 'Career Ops: AI job search pipeline (open source)',
          },
          {
            icon: 'gitBranch',
            text: 'Cloud Infrastructure: Terraform multicloud (AWS/GCP), K8s',
          },
          { icon: 'bot', text: 'Whisper Walkie: voice-to-text 100% local (open source)' },
        ],
        codeAvailable: '',
        caseStudyUrl: '',
      },
      erp: {
        title: 'OpenClaw Agents',
        desc: 'Email, CRM, invoicing, SEO, and deployments automated via 22 agents',
        metric: '22 agents',
        caseStudyUrl: '/openclaw',
      },
      gpts: {
        title: 'Skate Workshop',
        desc: 'React Native app with 40+ tables, 18+ Edge Functions, Stripe Connect. **The tech that scales.**',
        metric: 'In prod',
        caseStudyUrl: '',
      },
      reservas: {
        title: 'DALL-E Generator',
        desc: 'AI image generation web app with OpenAI DALL-E 3.0',
        metric: 'In prod',
        caseStudyUrl: '',
      },
      crm: {
        title: 'Career Ops',
        desc: 'AI pipeline: offer evaluation, ATS-optimized CVs, automated applications',
        metric: 'Open src',
        caseStudyUrl: '',
      },
      genAI: {
        title: 'Cloud Infra',
        desc: 'Terraform multicloud, K8s with Cloud SQL HA, Anthos/GKE modernization',
        metric: 'DevOps',
        caseStudyUrl: '',
      },
    },
    lico: {
      company: 'Google Self-Driving Car Project (Waymo)',
      location: 'Mountain View, CA',
      role: 'Program Manager L4 / Fleet Vehicle Technician',
      period: '2009 - 2016 · Autonomous Vehicles',
      desc: "Built Google's Firefly autonomous vehicle from the ground up. Drive-by-wire SME across the first 100 vehicles and 10 hardware iterations. Managed sensor calibration for the entire fleet — final release authority before vehicles went to public roads. Reduced calibration from 9 hours to 60 minutes (promoted to L4). Traveled to Roush (Detroit) to train manufacturing teams.",
      testimonial: {
        quote:
          "Supported the world's first fully driverless ride on public roads (2015) — a blind passenger was the first user.",
        author: 'Historic milestone',
        role: 'Google Self-Driving Car Project, 2015',
      },
    },
    uberAtg: {
      company: 'Uber ATG (Otto)',
      location: 'San Francisco, CA',
      role: 'Autonomous Truck Technician',
      period: '2016 - 2018 · Autonomous Vehicles',
      desc: 'Led system integration for a 10-truck autonomous fleet (~90% uptime). Drive-by-wire integration, log analysis, root cause analysis, and end-to-end testing across the fleet.',
      press: [
        { title: 'Uber Acquires Self-Driving Truck Startup Otto', publisher: 'Transport Topics', url: 'https://www.ttnews.com/articles/uber-acquires-self-driving-truck-startup-otto' },
        { title: 'Otto + Uber: Self-Driving Trucks', publisher: 'Mashable', url: 'https://mashable.com/article/otto-uber-self-driving-truck' },
      ],
      testimonial: {
        quote:
          "End-to-end ownership of a 10-truck autonomous fleet — from drive-by-wire integration to daily operations and root cause analysis.",
        author: 'Uber ATG',
        role: '2016 - 2018',
      },
    },
    pronto: {
      company: 'Pronto.ai',
      location: 'San Francisco, CA',
      role: 'Autonomous Vehicle Technician',
      period: '2018 - 2019 · Autonomous Vehicles',
      desc: 'Sole technician hired by founder Anthony Levandowski. Built, integrated, and operated the entire autonomous fleet. 2,900-mile cross-country autonomous demo with zero critical failures. Conducted 10+ executive and investor demonstrations.',
      tesauro: {
        title: '2,900-Mile Cross-Country Demo',
        desc: 'Supported a 2,900-mile cross-country autonomous demonstration with zero critical failures. Conducted 10+ executive and investor demonstrations.',
        videoUrl: 'https://vimeo.com/prontoai',
        videoLabel: 'Watch Demo Video',
      },
      testimonial: {
        quote:
          "Sole technician operating Pronto.ai's entire fleet — built and integrated the autonomous system that drove coast-to-coast with zero critical failures.",
        author: 'Pronto.ai',
        role: '2018 - 2019',
      },
    },
  },
  linkedinPosts: {
    title: 'Writing',
    cta: 'Read on LinkedIn',
    items: [] as readonly { hook: string; reactions: string; comments: string; url: string }[],
  },
  redditPosts: [] as readonly { hook: string; upvotes: string; comments: string; subreddit: string; cta: string; url: string }[],
  speaking: {
    title: 'Sharing',
    slides: 'Slides',
    comingSoon: 'More coming soon.',
    aiFluency: {
      title: '',
      badge: '',
      desc: '',
      certs: [] as readonly { title: string; url: string }[],
    },
    items: [] as readonly { year: string; event: string; eventUrl: string; title: string; desc: string; pdf: string; featured: boolean }[],
  },
  education: {
    title: 'Education',
    items: [
      {
        year: '2009 - Present',
        org: 'Self-taught',
        title: '15+ Years Hands-On Experience',
        desc: "No formal degree. 15+ years of hands-on experience + professional certifications. From Google's self-driving car to multi-agent AI systems.",
      },
    ],
  },
  certifications: {
    title: 'Certifications',
    items: [
      {
        year: '2025',
        title: 'AWS Cloud Solutions Architect Professional',
        org: 'Amazon Web Services',
        logo: 'aws',
        url: '',
      },
      {
        year: '2025',
        title: 'Google IT Support Professional',
        org: 'Google',
        logo: 'google',
        url: '',
      },
      {
        year: '2025',
        title: 'Google Cybersecurity Professional',
        org: 'Google',
        logo: 'google',
        url: '',
      },
      {
        year: '2024',
        title: 'Programming with JavaScript',
        org: 'Meta',
        logo: 'meta',
        url: '',
      },
      {
        year: '2024',
        title: 'Version Control (Git)',
        org: 'Meta',
        logo: 'meta',
        url: '',
      },
      {
        year: '2024',
        title: 'Mobile Development',
        org: 'Meta',
        logo: 'meta',
        url: '',
      },
      {
        year: '2024',
        title: 'Programming for Everybody (Python)',
        org: 'University of Michigan',
        logo: 'umich',
        url: '',
      },
      {
        year: '2024',
        title: 'The Unix Workbench (Linux)',
        org: 'Johns Hopkins University',
        logo: 'jhu',
        url: '',
      },
      {
        year: '2024',
        title: 'Agile Development & Scrum',
        org: 'IBM',
        logo: 'ibm',
        url: '',
      },
      {
        year: '2024',
        title: 'Cloud Computing',
        org: 'IBM',
        logo: 'ibm',
        url: '',
      },
      {
        year: '2024',
        title: 'Cloud Bootcamp: AWS (59 hrs)',
        org: 'Cloud Academy',
        logo: 'cloud',
        url: '',
      },
      {
        year: '2024',
        title: 'Cloud Bootcamp: Azure (59 hrs)',
        org: 'Cloud Academy',
        logo: 'cloud',
        url: '',
      },
    ],
  },
  skills: {
    title: 'Skills',
    languages: 'Languages',
    spanish: 'Spanish',
    native: 'Conversational',
    english: 'English',
    professional: 'Native',
    technical: 'Technical Skills',
    soft: 'Soft Skills',
    softSkills: [
      'Communication',
      'Systems Thinking',
      'E2E Ownership',
      'Bias for Action',
      'Cross-Functional Collaboration',
      'Rapid Ramp-Up',
      'Client-Facing Delivery',
    ],
  },
  cta: {
    title: "Let's talk",
    desc: 'Looking for roles in AI Development, DevOps/SRE, or Embedded/Robotics in the San Diego area or remote. 15+ years of experience with complex systems.',
    contact: 'Contact',
  },
  ui: {
    languageBanner: 'This site is available in English',
    languageBannerSwitch: 'Switch to EN',
    languageBannerSwitchPrefix: 'Switch to',
    languageBannerSwitchLang: 'ES',
    languageToggle: 'EN',
    typingIndicator: 'joseph is typing...',
  },
  chat: {
    placeholder: 'Type your question...',
    title: 'joseph',
    subtitle: 'Ask me about my experience',
    greeting:
      "Hi! I'm **Joseph**. Ask me anything: experience, projects, autonomous vehicles, AI.",
    error: 'Error sending. Please try again.',
    offline: 'Looks like you\'re offline. Check your connection and try again.',
    prompts: [
      {
        icon: 'briefcase',
        label: 'AI Experience',
        query: "What is Joseph's experience with AI and multi-agent systems?",
      },
      {
        icon: 'rocket',
        label: 'Top Projects',
        query: "What are Joseph's most notable projects?",
      },
      {
        icon: 'help',
        label: 'Why hire him?',
        query: 'Why should I hire Joseph?',
      },
      {
        icon: 'mail',
        label: 'Contact',
        query: 'How can I contact Joseph?',
      },
    ],
    contactCtaTitle: 'Want to talk directly?',
    voice: {
      start: 'Talk to Joseph',
      stop: 'End',
      connecting: 'Connecting...',
      listening: 'Listening...',
      thinking: 'Thinking...',
      searching: 'Searching my projects...',
      speaking: 'Speaking...',
      timeWarning: '15 seconds remaining',
      ended: 'Voice session ended',
      rateLimited: 'You have reached the limit of 3 voice sessions per day',
      unsupported: 'Your browser does not support audio input',
      micDenied: 'Microphone access is needed for voice mode',
      switchToText: 'Switch to text',
      connection: 'Connection error. Please try again.',
    },
  },
};

export const translations = _translationsEn;
