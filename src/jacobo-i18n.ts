const _en = {
      slug: 'ai-agent-jacobo',
      altSlug: 'agente-ia-jacobo',
      readingTime: '35 min read',
      seo: {
        title: 'Jacobo: Multi-Agent AI with Tool Calling & Voice AI — Production Case Study | cv-joseph.vercel.app',
        description: 'Case study: how an FDE built an omnichannel AI agent with sub-agents, tool calling, HITL, and Voice AI (n8n + ElevenLabs) achieving 90% self-service. Downloadable workflows.',
      },
      nav: {
        breadcrumbHome: 'Home',
        breadcrumbCurrent: 'AI Agent Jacobo',
      },
      header: {
        kicker: 'Case Study: Joe\'s Tech Solutions (Google it — still operating today)',
        h1: 'Jacobo: Multi-Agent AI with Sub-Agent Orchestration & Tool Calling',
        subtitle: 'How I built an AI agent that handles WhatsApp and landline calls, orchestrates specialized sub-agents via webhooks, and achieves ~90% self-service at a phone repair business.',
        badge: 'Sold with the business in 2025 — still running in production today',
        date: 'Feb 25, 2026',
      },
      heroMetrics: [
        {
          value: '~90%',
          label: 'Self-service',
        },
        {
          value: '~80h/mo',
          label: 'Automated',
        },
        {
          value: '<30s',
          label: 'Response',
        },
        {
          value: '<€200',
          label: 'Cost/mo',
        },
        {
          value: '24/7',
          label: 'Available',
        },
      ],
      tldr: 'A multi-agent AI system that handles ~90% of customer queries without human intervention, 24/7, for <€200/month. 4 agents + 3 tools, dual-channel (WhatsApp + landline). Built in <1 month on top of a 5-year Business OS. Sold with the business in 2025. All 7 n8n workflows are downloadable at the end.',
      intro: {
        hook: '~15 interruptions per day. Each one, a repair on hold. Every unanswered WhatsApp, a customer walking to the competition. I built an AI agent that handles both — ~90% of interactions, 24/7, for less than €200/month.',
        body: 'Not a chatbot with canned responses. An agent that checks real prices, verifies stock, books appointments, and knows when to loop in a human with full context. That\'s what Jacobo became. In this article I share the complete architecture and the production workflows so you can replicate it.',
      },
      internalLinks: {
        businessOs: {
          text: 'Business OS — Case Study',
          href: '/business-os-for-airtable',
        },
        pseo: {
          text: 'Programmatic SEO — Case Study',
          href: '/programmatic-seo',
        },
        openClaw: {
          text: 'OpenClaw: 22-Agent AI System | Case Study',
          href: '/openclaw',
        },
      },
      sections: {
        theProblem: {
          heading: 'The Problem',
          body: 'With 30,000+ repairs completed and multiple support channels (phone, WhatsApp, web), the bottleneck was clear:',
          painPoints: [
            '80% of inquiries were repetitive: prices, appointments, repair status',
            'Every inquiry pulled the technician away from active repairs',
            'Response times swung wildly depending on the day\'s workload',
            'Data lived in three places: Airtable, the calendar, and inventory',
            'Availability stopped at store closing time',
            'Hiring part-time support didn\'t pencil out',
            'Customers reached out via WhatsApp and landline. The solution had to cover both with shared logic, not duplicate the work',
          ],
          alternatives: {
            body: 'The constraints were fixed: Airtable was the brain (the Business OS had been the SSOT for years), I needed real tool calling against live data, and the agent had to cover voice + chat from the same backend. The only open question was which orchestration layer to use:',
            items: [
              {
                tool: 'Tidio / Intercom',
                issue: 'Generalist chatbots with decision trees. Can\'t check stock in real time or calculate dynamic pricing against Airtable. For a repair business, they\'re little more than an interactive FAQ.',
              },
              {
                tool: 'ManyChat (WhatsApp)',
                issue: 'Good for marketing flows, but no tool calling capability against an existing ERP. Can\'t verify stock, create work orders, or do context-rich handoff.',
              },
              {
                tool: 'Vertical solution (RepairDesk chat)',
                issue: 'No repair SaaS offered a conversational agent with natural language and tool calling against real-time data. The ones with chat were essentially forms in disguise.',
              },
            ],
            punchline: 'n8n was the natural fit: workflow orchestration with webhooks, native LLM agent support with tool calling, and the ability to deploy each sub-agent as an independent, testable workflow. All wired into the Business OS already running in Airtable.',
          },
        },
        architecture: {
          heading: 'The Architecture',
          body: 'Jacobo isn\'t a chatbot with a long prompt. It\'s a system of specialized sub-agents, each deployed as an independent webhook in n8n, orchestrated via tool calling from a central router. Every workflow in this article is importable directly into n8n — grab them at the end.',
          whySubAgents: {
            heading: 'Why sub-agents instead of a monolithic prompt?',
            reasons: [
              {
                title: 'Testability',
                detail: 'Each sub-agent has its own webhook. I can test it in isolation with an HTTP call, without spinning up the entire system.',
              },
              {
                title: 'Independent evolution',
                detail: 'Changing discount logic can\'t break appointments. I can iterate on one domain without risking another.',
              },
              {
                title: 'Cost efficiency',
                detail: 'Not every sub-agent needs the same model. Appointments runs on MiniMax M2.5 (fast and cheap for parsing time preferences). Quotes runs on GPT-4.1 mini (precision for structured output). Right-sized models per task.',
              },
              {
                title: 'Platform-agnostic',
                detail: 'Sub-agents are just webhooks. They don\'t know whether n8n (WhatsApp) or ElevenLabs (voice) is calling them. Any orchestrator can reuse them without duplicating logic.',
              },
            ],
          },
          agentsHeading: '4 Agents & 3 Tools to Rule Them All',
          agentsBody: '4 agents with their own LLM make decisions. 3 tools with no LLM execute pure business logic. All connected via webhooks.',
          toolsLabel: 'Tools (no LLM)',
          agents: [
            {
              kind: 'agent',
              icon: '🧭',
              name: 'Main Router (n8n)',
              desc: 'The brain of the WhatsApp channel. Classifies intent, picks the right sub-agent, and keeps track of the conversation with a 20-message memory window.',
              details: [
                'GPT-4.1 via OpenRouter · 37 nodes',
                'LangChain Agent pattern with 7 tools as HTTP endpoints',
                'Think tool for internal reasoning before complex chains',
                'Pseudo-streaming: splits responses into sentences, sends them one by one via WhatsApp',
              ],
            },
            {
              kind: 'agent',
              icon: '🎙️',
              name: 'Voice Router (ElevenLabs)',
              desc: 'The brain of the voice channel. Receives calls via Aircall → Twilio → ElevenLabs Conversational AI, with its own system prompt optimized for spoken conversation.',
              details: [
                'ElevenLabs Conversational AI · GPT-4o',
                'Same sub-agents as the Main Router, connected as HTTP tools',
                'Native RAG out-of-the-box: knowledge base with repair catalog, pricing and FAQs',
                'Voice-optimized latency: short, direct responses',
                'Business hours detection to transfer to a human outside hours',
              ],
            },
            {
              kind: 'agent',
              icon: '📅',
              name: 'Appointments Sub-agent',
              desc: 'Turns "tomorrow morning" into a confirmed booking. Parses natural language time preferences, checks YouCanBookMe for available slots, and sends a WhatsApp confirmation template.',
              details: [
                'MiniMax M2.5 via OpenRouter · 18 nodes',
                '15 temporal parsing rules: from "after lunch" to "any day except Monday"',
                'The most sophisticated sub-agent in the system',
              ],
            },
            {
              kind: 'agent',
              icon: '💰',
              name: 'Quotes Sub-agent',
              desc: 'Every price inquiry flows through here. Looks up the exact model and repair in Airtable, returns real pricing with stock status, and decides the next step.',
              details: [
                'GPT-4.1 mini via OpenRouter · 11 nodes',
                'Stock available? → offer appointment',
                'Out of stock? → offer order',
                'No listing? → link to the quote form',
              ],
            },
            {
              kind: 'tool',
              icon: '📦',
              name: 'Orders',
              desc: 'Creates repair orders in Airtable when a part is out of stock.',
              details: [
                '3 nodes: webhook → create record → respond',
                'Simple by design: all validation happened upstream in Quotes',
              ],
            },
            {
              kind: 'tool',
              icon: '🧮',
              name: 'Discount Calculator',
              desc: 'Pure business logic, no LLM. Calculates combo discounts when customers bundle multiple repairs.',
              details: [
                '3 nodes · no LLM',
                'Battery + screen + back glass = automatic multi-repair pricing',
                'Discount rules live here, not scattered across prompts',
              ],
            },
            {
              kind: 'tool',
              icon: '🙋',
              name: 'HITL Handoff',
              desc: 'The escape valve. Escalates to a human via Slack with a deep-link straight into the WATI conversation.',
              details: [
                '5 nodes · posts to #chat',
                'Includes conversation summary, detected intent, and customer history',
                'Human gets full context before opening the chat',
              ],
            },
          ],
          memory: {
            heading: 'Conversational Memory',
            body: 'Jacobo holds no state between messages. On every new message, it rebuilds context by reading the actual conversation history from WATI:',
            steps: [
              {
                label: 'Already served?',
                detail: 'A switch checks whether an active session exists for this phone number. If not, it triggers a memory reload.',
              },
              {
                label: 'WATI fetch',
                detail: 'HTTP call to getMessages/{waId} with pageSize=80. Retrieves the last 80 messages from the full conversation: customer messages, Jacobo responses, templates, broadcasts, and human operator messages.',
              },
              {
                label: '3-phase parsing',
                detail: 'Three code nodes transform raw WATI events into {human, ai} pairs compatible with LangChain. Filters out broadcasts, confirmation templates, and system events. A __reloadFlag__ allows manual memory resets.',
              },
              {
                label: 'Buffer Window',
                detail: 'The last 20 messages are loaded into the LangChain BufferWindow, keyed by phone number. The agent "remembers" past conversations: if you confirmed an appointment yesterday, Jacobo knows today.',
              },
            ],
            punchline: 'This is what lets Jacobo pick up interrupted conversations, recognize returning customers, and know when a human stepped in earlier.',
          },
          debugTools: {
            heading: 'Production debug tools',
            body: 'Two hidden commands to debug memory in production without touching n8n. "Borrar memoria" reset the customer\'s buffer, useful when a conversation got corrupted or the LLM entered a loop. "HISTORIAL" dumped the raw buffer JSON — and that\'s what taught us to sanitize responses: the LLM returned the full JSON to the customer if left unfiltered.',
          },
          pseudoStreaming: {
            heading: 'Pseudo-Streaming on WhatsApp',
            body: 'WhatsApp doesn\'t support streaming. A wall of text feels like a bot; sequential messages feel like someone typing. The router splits each response on line breaks and sends each chunk with a 1-second delay via the WATI API. Result: the "typing..." experience with zero streaming infrastructure.',
          },
          stackIntro: 'Jacobo runs on 8 services, end-to-end from first contact to human handoff. Every one is load-bearing — swap any of them and you\'re rearchitecting.',
          stack: [
            {
              name: 'WATI',
              role: 'WhatsApp Business API — primary inbound channel',
            },
            {
              name: 'Aircall',
              role: 'Cloud PBX — Jacobo as a teammate on the phone system',
            },
            {
              name: 'n8n',
              role: 'Workflow orchestration and sub-agents (7 workflows, ~80 nodes)',
            },
            {
              name: 'OpenRouter',
              role: 'Model-agnostic LLM gateway (MiniMax M2.5 + GPT-4.1)',
            },
            {
              name: 'ElevenLabs',
              role: 'Conversational voice agent (eleven_flash_v2_5, temp 0.0)',
            },
            {
              name: 'Airtable',
              role: 'CRM, inventory, customer history (source of truth)',
            },
            {
              name: 'YouCanBookMe',
              role: 'Appointment scheduling and availability',
            },
            {
              name: 'Slack',
              role: 'HITL escalation channel (#chat)',
            },
          ],
        },
        e2eFlows: {
          heading: 'End-to-End Flows',
          body: 'Each flow walks the happy path from inquiry to resolution, with the sub-agents involved called out at each step.',
          items: [
            {
              icon: '🔧',
              name: 'Repair Appointment',
              trigger: 'Customer asks about a repair',
              summary: 'From inquiry to confirmed appointment with reserved parts, zero human intervention.',
              agentsTouched: [
                'Router',
                'Quotes',
                'Appointments',
              ],
              details: [
                'Customer writes on WhatsApp: "Hi, how much does it cost to replace an iPhone 14 Pro screen?"',
                'Router classifies intent as price inquiry → delegates to Quotes sub-agent',
                'Quotes searches Airtable: model + repair type → returns real price (€189), part availability and estimated time (45-60 min)',
                'Stock available → Jacobo responds with price and asks: "Want to book an appointment?"',
                'Customer says "Yes, tomorrow morning" → Router delegates to Appointments sub-agent',
                'Appointments parses the time preference, queries YouCanBookMe → offers slots: "10:00 and 11:30"',
                'Customer confirms → appointment created in YouCanBookMe + work order generated in Airtable + parts auto-reserved from inventory',
                'Confirmation sent via WhatsApp with summary: date, time, price, store address',
              ],
            },
            {
              icon: '💬',
              name: 'Price Inquiry',
              trigger: 'Customer asks about repair or product price',
              summary: 'Airtable lookup with real data, CTA adapted based on stock availability.',
              agentsTouched: [
                'Router',
                'Quotes',
              ],
              details: [
                'Customer: "How much to replace a Samsung S23 battery?"',
                'Router classifies intent → delegates to Quotes',
                'GPT-4.1 searches Airtable: exact model + repair type',
                'If in stock → responds with price, time, and offers to book an appointment',
                'If NOT in stock → responds with price, indicates the part needs to be ordered, offers to place the order',
                'If model doesn\'t exist in the database → Jacobo clearly says so instead of making up a price',
                'Stock-aware routing: the CTA changes based on real availability in Airtable',
              ],
            },
            {
              icon: '🙋',
              name: 'Human Escalation (HITL)',
              trigger: 'Unclear intent, warranty, complaint, or explicit request',
              summary: 'Handoff with full context to the human team via Slack. The human doesn\'t start from scratch.',
              agentsTouched: [
                'Router',
                'HITL Handoff',
              ],
              details: [
                'Escalation triggers: detected frustration, out-of-domain query, warranty case, explicit request to speak with a person',
                'Router activates HITL Handoff → sends notification to Slack (#chat)',
                'The Slack message includes: conversation summary, detected intent, customer data from Airtable, escalation reason',
                'Deep-link to WATI: the human clicks and jumps straight into the customer\'s WhatsApp conversation',
                'The human doesn\'t start from scratch: they have full context. Average post-handoff resolution time: seconds, not minutes',
                'Jacobo tells the customer: "I\'m connecting you with a colleague who can help you better with this"',
              ],
            },
          ],
        },
        deepDiveBooking: {
          heading: 'Deep Dive: Natural Language Booking',
          body: 'The appointments sub-agent has one job: turn "tomorrow morning" into a confirmed booking with reserved parts. No forms, no calendar picker.',
          challenge: {
            heading: 'The challenge: bridging two worlds',
            body: 'The customer speaks natural language ("Thursday mid-morning, or else Friday afternoon"). The YouCanBookMe API speaks Unix timestamps. The sub-agent bridges the gap and finds the intersection.',
          },
          parseUrl: {
            heading: 'ParseURL',
            body: 'A Code node that extracts the subdomain from the YouCanBookMe URL to determine which booking profile to use. Parses the query string for dynamic form fields (repair type, customer data). Different calendars for different services: joestech-citav2-componentes for component repairs, joestech-citav2-diagnostico for diagnostics. The subdomain determines the entire booking flow downstream.',
          },
          analizarDisponibilidad: {
            heading: 'AnalizarDisponibilidad (LLM)',
            body: 'An LLM agent powered by MiniMax M2.5 converts natural language into a structured JSON array: [{date, start, end, exact}]. The system prompt contains 15 temporal parsing rules covering every real-world case. Includes a Structured Output Parser to guarantee valid format and per-session memory (sessionKey = phone/ycbmUrl) so the customer can refine preferences without starting over. If no explicit preference, returns the next 3 business days with full schedule.',
            rules: [
              'Default ranges: "morning" = 10:00-14:00, "afternoon" = 5:00-9:00pm, "all day" = 10:00-21:00',
              'Plurals: "mornings" → next 3 business mornings',
              'Explicit ranges: "10 to 12" → start=10:00, end=12:00, exact=true',
              'Conditionals: "or else Friday" → adds Friday as alternative range',
              'Rounding: 10:15 → 10:00-11:00 (1-hour block)',
              'Filters weekends automatically (Mon-Fri only)',
              '"Mid-morning" = 11:00-13:00, "first thing" = 10:00-11:00',
              '"After lunch" = 17:00-19:00',
              'Today only included if ≥2 hours of business hours remain',
              'Relative dates: "day after tomorrow", "next Tuesday" → resolved to absolute date',
            ],
          },
          ycbmApi: {
            heading: 'YCBM API (3 calls)',
            body: 'Sequential pipeline of 3 HTTP Requests against the YouCanBookMe API. Each call depends on the previous one — no parallelization possible:',
            steps: [
              { label: 'POST /v1/intents', detail: 'Sends the subdomain → creates a booking intent and returns a unique ID' },
              { label: 'GET /v1/intents/{id}/availabilitykey', detail: 'With the intent ID → retrieves the availability key' },
              { label: 'GET /v1/availabilities/{key}', detail: 'With the key → fetches all real available slots with Unix timestamps' },
            ],
          },
          filterSlots: {
            heading: 'FilterSlots — The Intersection',
            body: 'A pure Code node performing set intersection: LLM ranges × real YCBM slots. Converts Unix timestamps to Europe/Madrid using Intl.DateTimeFormat, then filters: localDate === r.date && localTime >= r.start && localTime < r.end. Output is an array [{date, timestamp, start}] that can contain 0, 1, or N slots. The most elegant node in the workflow: pure set logic, no LLM, no API — just temporal math.',
          },
          autoBooking: {
            heading: 'Conditional Auto-booking',
            body: 'An If node evaluates slots.length and branches into 3 paths. The sub-agent has its own per-session memory: the customer can refine ("no, Thursday instead") without starting over.',
            paths: [
              { condition: 'Exactly 1 slot', action: 'Auto-confirms (zero friction): preparePatchBody builds form data with email, phone, dynamic queryVars, and comments → emailCheck verifies email exists → patchSelections (PATCH /v1/intents/{id}/selections) → patchConfirm (PATCH /v1/intents/{id}/confirm) → confirmarCita informs the customer' },
              { condition: 'Multiple slots', action: 'escogerHora groups slots by date and presents options to the customer with contextual instructions' },
              { condition: '0 slots', action: 'Informs no availability in that range and asks for another time preference' },
            ],
          },
          punchline: 'The result: a customer writes "tomorrow mid-morning" and 3 seconds later has a confirmed appointment with reserved parts. No forms, no date picker, no friction. This is the difference between "I built a chatbot" and "I designed a system that translates human intent into API actions."',
        },
        toolCalling: {
          heading: 'Tool Calling in Production',
          body: 'Jacobo doesn\'t make up answers from training data. Every response is grounded in real systems via 7 tools defined as HTTP endpoints:',
          tools: [
            {
              name: 'presupuestoModelo',
              desc: 'Looks up repair/accessory prices and stock in Airtable. LLM: GPT-4.1 for structured output precision.',
            },
            {
              name: 'subagenteCitas',
              desc: 'Manages availability and bookings via YouCanBookMe. The LLM parses temporal preferences from natural language.',
            },
            {
              name: 'hacerPedido',
              desc: 'Creates repair/purchase orders in Airtable. 3 nodes: webhook → create record → respond.',
            },
            {
              name: 'Calculadora',
              desc: 'Volume discount: more repairs together = bigger discount. Pure business logic, no LLM.',
            },
            {
              name: 'contactarAgenteHumano',
              desc: 'HITL escalation via Slack with escalation reason, deep-link to WATI, and full context. Works from both WhatsApp and phone calls.',
            },
            {
              name: 'enviarMensajeWati',
              desc: 'Sends information via WhatsApp in parallel. When the voice agent needed to send a link or quote, it did so via WhatsApp while still talking on the phone.',
            },
            {
              name: 'Think',
              desc: 'Internal reasoning meta-tool. The agent "thinks out loud" before multi-tool chains to reduce errors.',
            },
          ],
          waitMessage: {
            heading: 'mensajeConsulta: UX while thinking',
            body: 'When Jacobo calls presupuestoModelo (1-3s latency), it fires mensajeConsulta first: an "I\'m checking availability..." that lands before the sub-agent responds. Without it, customers saw 5 seconds of dead air and assumed the bot was broken. One UX detail, massive difference.',
          },
          thinkTool: {
            heading: 'The "Think" Tool',
            body: 'Before executing a tool chain (check price → verify stock → offer appointment), the agent invokes Think to plan the sequence. Explicit reasoning before action cuts errors in multi-tool chains significantly.',
          },
          stockAware: {
            heading: 'Stock-Aware Routing',
            body: 'presupuestoModelo\'s output determines what happens next. It\'s not a fixed flow: the CTA adapts to real-time availability.',
            flows: [
              {
                condition: 'Part in stock',
                action: '→ Offers to book a repair appointment',
              },
              {
                condition: 'Part out of stock',
                action: '→ Offers to place an order with supplier ETA',
              },
              {
                condition: 'Model not found',
                action: '→ Clearly states it and offers human contact',
              },
            ],
          },
        },
        channels: {
          heading: 'The Two Channels',
          body: 'Jacobo runs on two channels simultaneously. The key: both share the same sub-agent webhooks. Business logic written once, served everywhere.',
          whatsapp: {
            name: 'WhatsApp (highest volume)',
            detail: 'WATI as WhatsApp Business API + n8n as orchestrator. 70% of queries flow through here.',
            highlights: [
              'n8n router with LangChain Agent pattern: 37 nodes, 7 tools as HTTP endpoints, GPT-4.1 via OpenRouter',
              'Meta-approved WhatsApp templates for appointment confirmations, order tracking and notifications',
              'Pseudo-streaming: splits the response into sentences and sends them one by one. The customer sees Jacobo "typing" like a real person',
              'Memory: 20 messages per session, keyed by phone number. Rebuilds context by reading full conversation history from WATI',
              'Event Routing: 3 switches filter noise (system events, broadcasts, human operator messages) before reaching the agent',
              'Transparent Human Takeover: when a human takes control via WATI, Jacobo detects the handoff and stays quiet',
            ],
          },
          voice: {
            name: 'Landline (voice)',
            detail: 'Aircall as Cloud PBX + Twilio as phone bridge + ElevenLabs as conversational voice agent. Jacobo sits on the Aircall phone system as a literal "teammate" with its own routing rules.',
            highlights: [
              'Aircall → Twilio → ElevenLabs integration: calls came through the business Aircall PBX. When no one answered or after hours, Aircall redirected to a dedicated Twilio number connected to the ElevenLabs agent. For the customer, it was transparent: they dialed the store landline and talked to Jacobo',
              'The customer called a landline and talked to Jacobo like any other employee. NOT a web widget or an IVR with menus. It was a real phone call with natural voice',
              'High-quality ASR (provider: ElevenLabs, PCM 16kHz) + 7s turn_timeout + 20s silence_end_call to handle natural conversational pauses',
              'LLM: GPT-4.1 (temp 0.0) for maximum precision in voice tool calling. Optimized latency (optimize_streaming_latency: 4)',
              'Voice model: eleven_flash_v2_5, speed 1.2x, stability 0.6, similarity 0.8. Conversations up to 5 minutes (300s)',
              'Knowledge base with 3 sources (Google Maps, Joe\'s Tech Solutions website, business summary) leveraging ElevenLabs\' native RAG (e5_mistral_7b_instruct). Didn\'t build custom RAG: the platform offered it and it was high impact with zero effort. Pure RICE prioritization. n8n didn\'t need it: the WhatsApp agent already accessed business context via direct tool calling to Airtable',
              '5 shared webhook tools with n8n: presupuestoModelo, subagenteCitas, Calculadora, contactarAgenteHumano, and enviarMensajeWati. 20s timeout per tool, immediate execution',
              'enviarMensajeWati was the cross-channel magic: while talking on the phone, Jacobo sent links and quotes via WhatsApp in parallel using the caller_id as a dynamic variable. Customers loved getting the info on their phone while still on the call',
            ],
          },
          cocaColaAnecdote: {
            heading: 'Production incident: the Coca-Cola',
            body: 'A customer was discussing a phone repair. Mid-conversation, he turned to order a Coca-Cola from a waiter. Jacobo heard it — and told him we don\'t serve Coca-Colas.',
            diagnosis: {
              heading: 'Diagnosis: three signals the system ignored',
              items: [
                { label: 'Volume', detail: 'Dropped ~40% — he moved away from the phone' },
                { label: 'Spectral tilt', detail: 'Shifted — off-axis voice loses high frequencies' },
                { label: 'Semantic relevance', detail: '"Coca-Cola" had zero relation to phone repairs' },
              ],
            },
            takeaway: 'Basic VAD isn\'t enough. You need addressee detection: acoustic proximity + prosodic analysis + semantic gating working together.',
          },
          missedCallRecovery: {
            heading: 'Missed Call Recovery',
            body: 'If the customer hung up or no one answered, Aircall fired a webhook to Make.com which triggered a WhatsApp template via WATI with action buttons. A huge chunk of leads came through here: people who called, didn\'t wait, and Jacobo caught them. Since it pulled context from WATI, when they replied it already knew they\'d tried to call.',
          },
          dualOrchestrator: {
            heading: 'Dual-Orchestrator Architecture',
            body: 'This is the key pattern: n8n orchestrates WhatsApp, ElevenLabs orchestrates voice, but both hit the same sub-agent webhooks. A real microservices pattern applied to AI agents. The sub-agents don\'t know who\'s calling them. They don\'t need to.',
          },
          unifiedVoiceUx: {
            heading: 'Unified UX: One Voice',
            body: 'Every PBX audio — welcome greeting, IVR menu, voicemail — was generated with ElevenLabs using Jacobo\'s same voice. When the customer presses 3 or no one can answer and the live agent picks up, the voice is identical. No break. And if no one picks up and Jacobo texts them on WhatsApp after the missed call, the identity stays the same. A unified experience from start to finish, regardless of channel.',
            punchline: '"Press 3 to talk to me, Jacobo." That\'s the PBX introducing the AI agent in first person. The same voice that then picks up. An agent that announces itself.',
            audioIntro: 'Listen to the actual PBX. Jacobo\'s same voice across welcome, IVR menu, and live agent:',
            audios: [
              {
                src: '/jacobo/pbx-welcome.mp3',
                label: 'Welcome',
                transcript: '"We\'ll be right with you. Thank you for calling Joe\'s Tech Solutions. For quality assurance, your call may be recorded."',
                transcriptOriginal: '"A continuación, atenderemos tu llamada. Gracias por llamar a Joe\'s Tech Solutions. Para asegurar la calidad del servicio, tu llamada puede ser grabada."',
              },
              {
                src: '/jacobo/pbx-ivr.mp3',
                label: 'IVR Menu',
                transcript: '"Press 1 for a new repair. Press 2 to check your repair status. Press 3 to talk to me, Jacobo. Your 24/7 virtual assistant at Joe\'s Tech Solutions. Get a quote and book an appointment instantly."',
                transcriptOriginal: '"Marca 1 para solicitar una nueva reparación. Marca 2 para consultar el estado de tu reparación. Marca 3 para hablar conmigo, Jacobo. Tu asistente virtual 24/7 en Joe\'s Tech Solutions. Obtendrás presupuesto y cita al instante."',
                highlight: 'Press 3 to talk to me, Jacobo',
              },
            ],
          },
          eventRouting: {
            heading: 'Pre-filtering: Should Jacobo Respond?',
            body: 'Before a message reaches the AI Agent, three switches filter noise and decide who should respond:',
            steps: [
              {
                label: 'Event Type',
                detail: 'Filters only real messages. Ignores system events, delivery confirmations, status updates, and mass broadcasts. Without this, Jacobo would respond to its own confirmation messages.',
              },
              {
                label: 'Who sent it?',
                detail: 'Detects whether the last speaker was the customer or a human operator. When a human takes control of the conversation via the WATI deep-link, their messages arrive as owner: true. Jacobo knows this and doesn\'t interrupt.',
              },
              {
                label: 'Already served?',
                detail: 'Checks for an active session. If a customer replies to a conversation a human was handling, but the store has already closed, Jacobo enters with an empathetic tone: "We closed at noon, but I can help you until we reopen this afternoon." Real graceful degradation.',
              },
            ],
            punchline: 'This 3-node filter is what makes human-agent coexistence work without conflicts. The human can take over anytime. When they\'re gone, Jacobo picks back up with full context.',
          },
        },
        results: {
          heading: 'Results',
          body: 'Production metrics after 6 months live:',
          metrics: [
            {
              value: '~90%',
              label: 'Self-service',
              detail: 'Inquiries resolved without human intervention',
            },
            {
              value: '24/7',
              label: 'Availability',
              detail: 'No longer limited to store hours',
            },
            {
              value: '<30s',
              label: 'Response time',
              detail: 'Vs. minutes when it depended on a person',
            },
            {
              value: '<€200',
              label: 'Monthly cost',
              detail: 'Total infrastructure (n8n + WATI + Aircall + LLMs)',
            },
          ],
          beforeAfter: {
            heading: 'Before vs After',
            items: [
              {
                area: 'Price/stock inquiries',
                before: '~15 interruptions/day to the technician',
                after: 'Jacobo responds with real Airtable data in <30s',
              },
              {
                area: 'Appointment booking',
                before: 'Manual via phone, frequent scheduling errors',
                after: 'Automatic via YouCanBookMe, parts auto-reserved',
              },
              {
                area: 'After hours',
                before: 'Lost inquiries, customers going to competitors',
                after: 'Jacobo handles 24/7 via WhatsApp and landline',
              },
              {
                area: 'Human escalations',
                before: 'Human started from scratch, repeating questions',
                after: 'Handoff with full context, resolution in seconds',
              },
              {
                area: 'Customer support cost',
                before: 'Part-time employee ~€800-1,000/mo',
                after: '<€200/mo total infrastructure',
              },
            ],
          },
          roi: 'The real return isn\'t just the cost saving. It\'s the technician who\'s actually repairing phones instead of answering them, and the appointment that used to fall through the cracks at 10pm — now confirmed automatically.',
          benchmarks: 'Industry benchmark: enterprise contact centers average 20-30% AI resolution rate (Gartner, 2025 AI Customer Service Report). The most advanced virtual assistants achieve 15% (Gartner, 2025 Hype Cycle for Customer Service & Support Technologies). Jacobo hit ~90% in a specialized domain. The difference: domain-specific sub-agents with real-time data access vs generic chatbots.',
          exitNarrative: 'Jacobo is still running 24/7 under new ownership since September 2025. The buyer acquired it operating — the best proof of a system: it runs without its creator. The architecture patterns documented here are the same ones I\'d bring to your team.',
        },
        decisions: {
          heading: 'Architecture Decision Records (ADRs)',
          body: 'The decisions that shaped the system — and why I made each one:',
          items: [
            {
              title: 'Multi-model (GPT-4.1 + MiniMax + GPT-4.1 mini) vs single LLM',
              detail: 'Each component with the right model: GPT-4.1 for the main router and voice agent (precise tool calling), GPT-4.1 mini for quotes (structured output), MiniMax M2.5 for appointments (fast and cheap for parsing time preferences). OpenRouter as gateway allows switching between models without rewriting workflows.',
            },
            {
              title: 'OpenRouter as model-agnostic gateway',
              detail: 'Switch between models without rewriting workflows, automatic fallback if a model is down. We evaluated Claude, GPT-4, MiniMax: chose by use case, not by brand.',
            },
            {
              title: 'n8n vs Make for orchestration',
              detail: 'Each sub-agent is an independent workflow with its own webhook. Make doesn\'t allow this modularity. n8n supports LangChain agent patterns, memory management and native tool calling.',
            },
            {
              title: 'Sub-agents as webhook microservices',
              detail: 'Decoupled, individually testable, independently deployable. The same sub-agent serves WhatsApp (via n8n) and phone (via ElevenLabs) without duplicating code.',
            },
            {
              title: 'Airtable as brain vs database',
              detail: 'The complete Business OS already existed in Airtable (12 bases, 2,100+ fields). Single source of truth for stock, prices and customer history. Build on what already exists, don\'t duplicate.',
            },
            {
              title: 'Memory window: 20 messages per session',
              detail: 'Balance between context and token cost. Sufficient for a repair conversation (95% resolve in <10 messages). Keyed by phone number for continuity.',
            },
            {
              title: 'Think tool for internal reasoning',
              detail: 'Explicit reasoning before multi-tool chains. Reduces errors because the LLM plans the sequence (check price → verify stock → offer appointment) before executing.',
            },
            {
              title: 'HITL via Slack with escalation reason',
              detail: 'The LLM generates the escalation reason and includes it in the Slack message: why human intervention is needed, what it has tried, and what the customer needs. Works identically from WhatsApp (deep-link to WATI) and phone calls. The human knows why they\'re needed before opening the conversation.',
            },
            {
              title: 'WhatsApp first, voice second',
              detail: '70% of volume came through WhatsApp. Starting there maximized impact before expanding to voice. Voice (ElevenLabs + Aircall) reused existing sub-agents without duplicating logic.',
            },
            {
              title: 'Dual-orchestrator with shared sub-agents',
              detail: 'n8n for WhatsApp/web, ElevenLabs for voice. Sub-agents are platform-agnostic webhooks. Reusable by any orchestrator without duplicating logic. A real microservices pattern.',
            },
            {
              title: 'ElevenLabs as "teammate" on Aircall',
              detail: 'Jacobo integrated into PBX with routing rules: picks up on overflow or after hours. The customer calls a landline, transparent experience. eleven_flash_v2_5 with temp 0.0 for maximum consistency.',
            },
            {
              title: 'Aircall → Twilio → ElevenLabs (and the latency trade-off)',
              detail: 'The Aircall PBX → Twilio (phone bridge) → ElevenLabs chain worked, but each hop added latency: ~950-1,500ms mouth-to-ear. Twilio uses G.711 at 8kHz when STT models are optimized for 16kHz, forcing resampling with accuracy loss. Today I\'d choose a direct SIP trunk (Telnyx offers G.722 wideband at native 16kHz and co-located infrastructure with sub-200ms RTT) eliminating the intermediate hop. The platform-agnostic sub-agent design would make this migration straightforward: only the transport changes, not the logic.',
            },
          ],
        },
        platformEvolution: {
          heading: 'Platform Evolution',
          tagline: 'Jacobo wasn\'t a weekend hack. It was the inevitable result of 5 years building a proper Business OS underneath.',
          steps: [
            {
              year: '2019-2024',
              event: 'Business OS as foundation',
              detail: 'Five years building a complete business operating system in Airtable: 12 bases, 2,100+ fields, real-time inventory, CRM with full customer history. Without this clean data layer, any AI agent would just be a generic chatbot making things up.',
            },
            {
              year: 'Jan 2025',
              event: 'Training and deliberate design',
              detail: 'Before writing a line of code, I studied AI agent architectures. I knew I needed tool calling, that Airtable was the SSOT, and that the same backend had to serve both voice and chat.',
            },
            {
              year: 'Feb 2025',
              event: 'First test version (monolithic)',
              detail: 'Tried the single-prompt-with-everything approach. Confirmed what I suspected: a monolithic prompt doesn\'t scale across multiple domains. This test validated the sub-agent-as-webhooks architecture, platform-agnostic by design.',
            },
            {
              year: 'Feb 2025',
              event: 'Definitive multi-agent version',
              detail: 'My first AI agent, shipped to production in under a month. Full sub-agent architecture: each domain in its own workflow with independent webhook, central router with tool calling, multi-model per use case. The speed came from the Business OS already running underneath. Built alongside all other business responsibilities.',
            },
            {
              year: 'Mar 2025',
              event: 'Voice channel (Aircall + Twilio + ElevenLabs)',
              detail: 'Jacobo as a teammate on the Aircall phone system, connected via Twilio to ElevenLabs. Reused existing sub-agents without duplicating logic. Validation of the platform-agnostic design: the webhooks served a second orchestrator without touching a single line.',
            },
            {
              year: 'Sep 2025',
              event: 'Going-concern sale',
              detail: 'Jacobo has been running 24/7 since launch. It was part of the business sale as an operational asset: the buyer acquired it operating. Five years of clean architecture made this exit possible.',
            },
          ],
          bridge: ['Jacobo wasn\'t an experiment.', '16 years building a business with my own hands.', 'Systematize it until it runs {without me}.', 'Jacobo was the piece that {closed the loop}.', 'I sold the business as a going concern.', 'The systems I built still run today — under {new ownership}.'],
          crossLink: {
            text: 'Jacobo was built on top of the Business OS I designed over 5 years — read the full case study →',
            href: '/business-os-for-airtable',
          },
        },
        lessons: {
          heading: 'Lessons Learned',
          items: [
            {
              title: 'Sub-agents > monolithic prompt.',
              detail: 'I tested a single prompt with full context during design and confirmed it doesn\'t scale across domains. The sub-agent architecture was deliberate from the start: each piece testable, iterable, and independent. Changing discounts can\'t break appointments. Microservices logic, applied to AI agents.',
            },
            {
              title: 'HITL isn\'t a fallback, it\'s a feature.',
              detail: 'A well-implemented handoff builds more trust than a bot that tries to handle everything. Customers value a system that knows when they need a person. The trick: the human picks up with full context, not from scratch.',
            },
            {
              title: 'The CRM is the agent\'s brain, not the LLM.',
              detail: 'Jacobo isn\'t smart because of the LLM. It\'s smart because it queries real prices, stock, and customer history in Airtable. Strip away that data and it\'s just another chatbot making things up.',
            },
            {
              title: 'Start with the highest-volume channel.',
              detail: 'WhatsApp carried 70% of volume. Starting there maximized impact. When voice came later, the sub-agents were already battle-tested. We just plugged in a new orchestrator.',
            },
            {
              title: 'Choose models by use case, not by brand.',
              detail: 'GPT-4.1 for router and voice (precise tool calling), GPT-4.1 mini for quotes (structured output), MiniMax M2.5 for appointments (fast and cheap). OpenRouter as gateway lets you swap models without rewriting. More FDE than "I use X for everything."',
            },
            {
              title: 'The Think tool prevents errors in multi-tool chains.',
              detail: 'Before checking price → verifying stock → offering an appointment, the agent makes its plan explicit. One reasoning step cuts errors in the chain. Rubber duck debugging, but for the agent itself.',
            },
          ],
        },
        whatIdDoDifferently: {
          heading: 'What I\'d Do Differently',
          body: 'Jacobo ran in production for months. Here\'s what I\'d change:',
          items: [
            {
              title: 'Structured evaluation from day 1',
              detail: 'I bolted on evals after the system was already in production. Starting over, I\'d define response quality metrics, intent classification accuracy, and HITL rate before v1. Retrofitting observability costs more than building it in from day one.',
            },
            {
              title: 'Direct SIP trunk instead of Aircall → Twilio → ElevenLabs',
              detail: 'The 3-hop chain added ~950-1,500ms mouth-to-ear latency and forced G.711 (8kHz) → 16kHz resampling. A Telnyx SIP trunk direct to ElevenLabs would give native G.722 wideband and sub-200ms RTT. I went with the long chain because Aircall was already contracted. Today I\'d prioritize latency over convenience.',
            },
            {
              title: 'Vector store for memory instead of raw WATI fetch',
              detail: 'Fetching 80 messages from WATI works, but doesn\'t scale for customers with long histories and can\'t do semantic search. A vector store (Pinecone, Qdrant) with conversation embeddings would unlock "remember when you brought the iPhone 12" without loading the full thread.',
            },
          ],
        },
        enterprisePatterns: {
          heading: 'Transferable Enterprise Patterns',
          body: 'Jacobo was built for an SMB. The patterns scale. Here\'s what I shipped vs. what I\'d add at enterprise scale:',
          builtVsEnterprise: [
            {
              pattern: 'Sub-agent routing with tool calling',
              built: 'Router + 7 webhook sub-agents with intent classification and delegation',
              enterprise: 'Add circuit breakers, retry policies and per-sub-agent model fallback',
            },
            {
              pattern: 'Multi-model orchestration',
              built: 'GPT-4.1 (router/voice) + GPT-4.1 mini (quotes) + MiniMax (appointments) via OpenRouter',
              enterprise: 'A/B testing models per sub-agent, canary deployments for new prompt versions',
            },
            {
              pattern: 'HITL framework',
              built: 'Escalation via Slack with full context and deep-link to the conversation',
              enterprise: 'Queue management, SLAs per customer tier, escalation reason analytics',
            },
            {
              pattern: 'Platform-agnostic sub-agents',
              built: 'Shared webhooks between n8n (WhatsApp) and ElevenLabs (voice)',
              enterprise: 'API gateway, rate limiting, authentication, endpoint versioning',
            },
            {
              pattern: 'Observability',
              built: 'n8n logs + Slack alerts',
              enterprise: 'Langfuse/Datadog for traces, latency and per-conversation cost tracking',
            },
            {
              pattern: 'Voice infrastructure',
              built: 'Aircall → Twilio → ElevenLabs: functional, but each hop adds latency (~950-1,500ms mouth-to-ear). Twilio uses G.711 at 8kHz, requiring resampling to 16kHz for STT models, degrading accuracy',
              enterprise: 'Direct SIP trunk (Telnyx/Plivo) → ElevenLabs via SIP, eliminating the Twilio hop. Telnyx offers G.722 wideband at native 16kHz (no resampling) and co-located infrastructure (GPU + telephony in the same PoP) with sub-200ms RTT. For apps/web: direct WebRTC (Opus 16-48kHz) via LiveKit, no PSTN, achieving 300-600ms mouth-to-ear',
            },
          ],
          applicability: {
            heading: 'Industry applicability',
            examples: [
              {
                domain: 'Travel (Hopper, Booking)',
                detail: 'Sub-agents for flights, hotels, insurance. HITL for complex changes. Tool calling against availability APIs.',
              },
              {
                domain: 'Fintech',
                detail: 'Sub-agents for transactions, balance queries, support. Stock-aware routing → balance-aware routing.',
              },
              {
                domain: 'Healthcare',
                detail: 'Sub-agents for appointments, results, triage. HITL as critical feature for specialist referral.',
              },
              {
                domain: 'E-commerce',
                detail: 'Sub-agents for tracking, returns, recommendations. Same inventory lookup and booking patterns.',
              },
              {
                domain: 'Voice AI Platforms',
                detail: 'Conversational agent orchestration with optimized latency. The cross-channel (voice → text) and HITL patterns apply directly to any voice platform.',
              },
              {
                domain: 'Data/AI Platforms',
                detail: 'Tool calling against internal APIs, intent-based sub-agent routing, memory management. The same architecture scales to any agent orchestrator.',
              },
            ],
          },
        },
        promptEngineering: {
          heading: 'Prompt Engineering in Production',
          body: 'No fine-tuning. For a repair shop agent, iterating on the prompt with hard rules is more pragmatic, cheaper, and faster than training a custom model. Every rule below has a production incident behind it.',
          whyNotFineTuning: {
            heading: 'Why hard rules in the prompt instead of fine-tuning?',
            reasons: [
              'Fine-tuning is expensive and slow to iterate. A prompt rule ships in seconds.',
              'The domain changed constantly: prices, stock, hours, promotions. A fine-tuned model goes stale in days.',
              'Rules are auditable. Anyone on the team can read the prompt and understand why Jacobo behaves a certain way.',
              '90% of production errors got fixed by adding one line to the prompt. Not retraining a model.',
            ],
          },
          businessHours: {
            heading: 'Business hours detection',
            body: 'A JavaScript code node checked whether the store was open before each conversation. The result got injected as a dynamic variable into the prompt: when `isBH` was false, Jacobo shifted tone ("after hours I\'ll try to help you anyway") and stopped promising immediate human responses.',
            code: `const madridTime = new Date().toLocaleString('en-US', {
  timeZone: 'Europe/Madrid',
});
const madridDate = new Date(madridTime);
const day  = madridDate.getDay();   // 0=Sunday … 6=Saturday
const hour = madridDate.getHours();

const isBH = day >= 1 && day <= 5 &&
             ((hour >= 10 && hour < 14) || (hour >= 17 && hour < 21));

return [{ json: { isBH } }];`,
          },
          mainPrompt: {
            heading: 'Main router system prompt (n8n)',
            body: 'Simplified version of the production prompt. The original has 18 rules and additional variables. Each block here reflects a deliberate prompt engineering technique.',
            segments: [
              {
                code: `## ROL
Te llamas Jacobo y trabajas en Joe\'s Tech Solutions, tienda de reparación
de móviles, tablets, smartwatches en Sevilla. Eres un experto comercial
y en electrónica, que sabe diagnosticar los problemas que tienen los
usuarios en sus dispositivos móviles.`,
                annotations: [
                  {
                    label: 'Role prompting + persona',
                    detail: 'Defining ROL, name, company, and domain of expertise constrains the response space. Without this, the LLM wanders or invents services we don\'t offer.',
                  },
                ],
              },
              {
                code: `HorarioComercial={{ \$('isBH').item.json.isBH }}
- Si false → la tienda está cerrada: informa con amabilidad
- Si true → responde con normalidad y ofrece ayuda inmediata`,
                annotations: [
                  {
                    label: 'Dynamic variable injection',
                    detail: 'HorarioComercial is injected as a workflow variable. The prompt changes behavior without changing the prompt: a business decision (opening hours) controls the agent\'s tone.',
                  },
                ],
              },
              {
                code: `## Objetivo
Identificar modelo + avería → consultar stock → conversión hacia cita,
pedido o presupuesto.`,
                annotations: [
                  {
                    label: 'Conversion-oriented objective',
                    detail: 'The explicit goal ("conversion towards appointment, order, or quote") prevents the LLM from staying in technical chat without advancing. Without this, Jacobo would explain chip differences for minutes.',
                  },
                ],
              },
              {
                code: `Si el dispositivo no es móvil, tablet o
smartwatch, dar ayuda general pero no invitar a dejarlo en tienda.`,
                annotations: [
                  {
                    label: 'Scope limiting',
                    detail: 'Limits scope without rejecting the customer: the agent remains useful outside its domain but doesn\'t make promises.',
                  },
                ],
              },
              {
                code: `## Instrucciones
1. Identificar modelo y síntomas → llamar a "presupuestoModelo"
2. Si varias reparaciones → llamar a "Calculadora" (array de precios)
3. Tras respuesta de presupuestoModelo:
   3.1 Hay stock → ofrecer cita vía "subagenteCitas" con urlCita
   3.2 No hay stock → ofrecer pedido urgente vía "hacerPedido"
   3.3 No hay presupuesto → facilitar urlPresupuesto

## Herramientas
- "mensajeConsulta": mensaje de espera antes de consultar precio
- "presupuestoModelo": lookup de modelo + avería en Airtable
- "contactarAgenteHumano": escalado HITL vía Slack
- "Think": razonamiento interno antes de tool calls complejos
- "Calculadora": descuento multi-reparación
- "subagenteCitas": gestión de citas vía YouCanBookMe
- "hacerPedido": crear pedido en Airtable cuando no hay stock`,
                annotations: [
                  {
                    label: 'Tool definitions as contract',
                    detail: 'Each tool documented with its exact function and when to use it. The LLM needs to know what each tool does AND in what order to call them. Without the contract, it made redundant or misordered tool calls.',
                  },
                ],
              },
              {
                code: `## HARD RULES (nacidas de producción)
1. Siempre llamar a Think antes de responder o pasar datos`,
                annotations: [
                  {
                    label: 'Think tool as forced chain-of-thought',
                    detail: '"Always call Think before responding or passing data" forces explicit reasoning. Without this, the agent would jump straight to tool calls without verifying it had all parameters, causing errors.',
                  },
                ],
              },
              {
                code: `2. No modificar URLs de "presupuestoModelo" (Meta da error)
3. Un solo * para negrita (WhatsApp), no dos **
4. iPhone + Pantalla → ofrecer SIEMPRE opción premium (12 meses
   garantía vs 6). No está en web → derivar a humano si interesa
5. Enlaces planos, sin markdown (Meta rechaza [text](url))
6. Solo llamar a subagenteCitas TRAS presupuestoModelo
7. Diagnóstico: 19€, solo se cobra si no acepta la reparación
8. Correo: contacto@joestechsolutions.com (no info@)`,
                annotations: [
                  {
                    label: 'Hard rules as production guardrails',
                    detail: 'The rules at the end aren\'t style preferences: they\'re corrections from real errors. Each one has a story behind it (broken URL, confused customer, lost sale). They\'re the equivalent of regression tests, but in the prompt.',
                  },
                ],
              },
              {
                code: `9. No decir "agendar" cita → decir "tomar" cita
10. No recomendar otras tiendas`,
                annotations: [
                  {
                    label: 'Negative prompting',
                    detail: '"Don\'t recommend other shops", "don\'t say agendar", "don\'t modify URLs". Telling the LLM what NOT to do is as important as telling it what to do: models tend to be overly "helpful".',
                  },
                ],
              },
            ],
          },
          voicePrompt: {
            heading: 'Voice agent system prompt (ElevenLabs)',
            body: 'Simplified version of the production voice prompt. Same domain, adapted for phone conversation. It shares the same webhook tools but the flow is more direct.',
            segments: [
              {
                code: `## ROL
Te llamas Jacobo y trabajas en Joe\'s Tech Solutions, tienda de reparación
de móviles, tablets, smartwatches en Sevilla. Sé conciso, amigable y
resolutivo.`,
                annotations: [
                  {
                    label: 'Compact persona for voice',
                    detail: 'The WhatsApp prompt has an extensive ROL with tone rules. In voice, brevity is key: the LLM needs less context to generate short, natural responses. Fewer system tokens = lower first-response latency.',
                  },
                ],
              },
              {
                code: `## Objetivo
Identificar modelo + avería → consultar stock → facilitar enlace.
Solo dar detalles técnicos cuando el cliente no tenga clara la avería.
Objetivo: que el cliente tome cita (si hay stock) o genere pedido.`,
                annotations: [
                  {
                    label: 'Single-line conversion funnel',
                    detail: 'Same funnel as WhatsApp, condensed. In voice, the agent needs to decide fast: the conversation won\'t wait. One line with the full flow (model → stock → link) beats a paragraph.',
                  },
                ],
              },
              {
                code: `## Instrucciones
1. Obtener modelo y avería
2. Indicar que estás haciendo la consulta → llamar a "presupuestoModelo"
3. Enviar "urlSantifer" vía "EnviarMensajeWati" (WhatsApp en paralelo)
4. Si varias reparaciones → llamar a "Calculadora"
5. Informar precio + disponibilidad + "te he mandado la info por WhatsApp"`,
                annotations: [
                  {
                    label: 'Cross-channel UX',
                    detail: 'Step 3 is the magic: while the customer is still talking on the phone, Jacobo sends them the link via WhatsApp using the caller_id. The customer gets the info on their phone without hanging up. Customers loved it.',
                  },
                ],
              },
              {
                code: `## HARD RULES
1. No modificar URLs de "presupuestoModelo"
2. iPhone + Pantalla → ofrecer opción premium (12 meses garantía)
3. No decir "agendar" → decir "tomar"
4. Cierre 18-22 agosto: si necesitan recoger equipo → mensajería gratis

Número del cliente: {{system__caller_id}}`,
                annotations: [
                  {
                    label: 'Dynamic variable: caller_id',
                    detail: 'ElevenLabs injects {{system__caller_id}} with the incoming call\'s phone number. This is what enables cross-channel: Jacobo uses that number to send WhatsApp messages to the same customer who\'s on the phone.',
                  },
                ],
              },
            ],
          },
          citasPrompt: {
            heading: 'Appointments sub-agent system prompt (n8n)',
            body: '15 temporal parsing rules that convert colloquial phrases into JSON time ranges. This prompt powers the most complex sub-agent in the system: it bridges natural language and the YouCanBookMe API.',
            segments: [
              {
                code: `Eres un micro-servicio que convierte frases de preferencia horaria fecha y hora (español de España)
en un array JSON de rangos.`,
                annotations: [
                  {
                    label: 'Micro-service framing',
                    detail: 'Assigning the LLM the role of "micro-service" instead of "assistant" radically constrains its behavior: no greetings, no explanations, no questions. Just parse and return JSON. Reduces hallucinations to a minimum.',
                  },
                ],
              },
              {
                code: `REGLAS DE NEGOCIO
1. Rangos por defecto:
   – mañana = 10:00-14:00
   – tarde   = 17:00-21:00
   – "todo el día" = 10:00-21:00
2. exact será true solo si el usuario da una hora puntual que termine
   en 00 o 30 (ej. "lunes a las 10" o "martes a las 17:30" pero no
   "miércoles a las 10:15").
   Si menciona un rango ("martes de 10 a 12") ⇒ exact:false.
3. Horas con minutos ≠ 00 ó 30 se redondean:
   - Redondea hacia abajo al múltiplo de 30 min anterior.
   - Crea un rango de 1 hora a partir de esa hora redondeada
     (ej. 10:15 ⇒ 10:00-11:00, exact:true porque era puntual).
4. La fecha actual es {{ \$now.format('yyyy-MM-dd HH:mm') }} (Europe/Madrid).
5. Acepta varias peticiones separadas por "y", comas o punto y coma.`,
                annotations: [
                  {
                    label: 'Domain constraints as rules',
                    detail: 'Business hours, 30-minute slots, rounding logic, and timezone are encoded as explicit rules. Without these, the LLM invented non-existent time ranges or 15-minute slots.',
                  },
                ],
              },
              {
                code: `6. Devuelve EXCLUSIVAMENTE una llamada de función con esta forma:
   {"name":"slots","arguments":{"slots":[
     {"date":"AAAA-MM-DD","start":"HH:mm","end":"HH:mm","exact":true/false}
   ]}}
6.1 Si la frase incluye "mañana" sin especificar parte del día,
    trátalo como «todo el día» de mañana (10:00–21:00).`,
                annotations: [
                  {
                    label: 'Forced structured output',
                    detail: 'Enforcing a specific JSON schema guarantees the output is parseable by the next n8n node. "EXCLUSIVAMENTE" is key: without that word, the LLM would prepend conversational text before the JSON.',
                  },
                ],
              },
              {
                code: `7. PLURAL ("mañanas", "tardes"): devuelve las próximas N=3 franjas.
   Incluye hoy si la franja aún no ha terminado.
8. Solo abre de lunes a viernes. Nunca sábado ni domingo.
9. Conectores condicionales ("o", "o bien", "o si no"):
   preferencias alternativas en el mismo orden.
10. "A partir de [día]": todo el día (10:00-21:00) + N-1 laborables.
11. N=5 por defecto.
12. Día concreto: solo las horas de ese día.
13. "Esta semana": todas las franjas laborables restantes (Lu-Vi).
14. Plurales: próximas 3 franjas.
15. Sin preferencia horaria: próximos 3 días laborables, todo el día.`,
                annotations: [
                  {
                    label: 'Edge case enumeration',
                    detail: 'Each rule (7-15) addresses a real production failure: plurals, conditional connectors, "this week". Without explicitly enumerating each edge case, the LLM interpreted freely and generated incorrect slots.',
                  },
                ],
              },
              {
                code: `# EJEMPLOS
Input: "mañana por la mañana"
→ {"slots":[{"date":"[mañana]","start":"10:00","end":"14:00","exact":false}]}

Input: "martes de 10 a 12 y viernes todo el día"
→ {"slots":[
  {"date":"[martes]","start":"10:00","end":"12:00","exact":false},
  {"date":"[viernes]","start":"10:00","end":"21:00","exact":false}
]}

Input: "lunes a las 10"
→ {"slots":[{"date":"[lunes]","start":"10:00","end":"11:00","exact":true}]}`,
                annotations: [
                  {
                    label: 'Few-shot prompting',
                    detail: '3 input→output examples covering the 3 key scenarios: generic range (exact:false), multi-slot with "y", and exact time (exact:true). Just enough to anchor the format without overfitting behavior.',
                  },
                ],
              },
            ],
          },
          iterationExamples: {
            heading: 'Real iteration examples',
            items: [
              {
                rule: 'Don\'t modify URLs',
                origin: 'Meta rejected messages with concatenated URLs. A customer never received their appointment link because Jacobo merged two URLs into one.',
              },
              {
                rule: 'Single * for bold',
                origin: 'WhatsApp uses *text* for bold. Jacobo used **text** (markdown style) and the customer saw literal asterisks.',
              },
              {
                rule: 'Always offer premium screen for iPhone',
                origin: 'Customers asked after hanging up if there was a better option. High-margin sales were being lost.',
              },
              {
                rule: 'Don\'t say "agendar"',
                origin: 'In Spain, nobody says "agendar una cita" (schedule an appointment). It\'s an anglicism that LLMs use constantly. Customers noticed.',
              },
              {
                rule: 'Plain links, no markdown',
                origin: 'Meta/WhatsApp doesn\'t render [text](url). The customer saw broken text instead of a clickable link.',
              },
              {
                rule: 'Don\'t recommend other shops',
                origin: 'Jacobo recommended a competitor when a customer asked about a service we didn\'t offer. Quick lesson learned.',
              },
              {
                rule: 'Creator attribution as lead gen',
                origin: 'A recruiter asked Jacobo "who designed you?" and it didn\'t know. Now the production prompt includes rules mentioning Joseph as creator with a LinkedIn link. The agent becomes a passive lead generation channel.',
              },
            ],
          },
        },
        mainRouter: {
          heading: 'The Two Brains',
          body: 'Jacobo has two independent routers sharing the same tools and sub-agents. One orchestrates WhatsApp, the other handles voice calls. Same business logic, two completely different interfaces.',
          whatsappRouter: {
            heading: 'WhatsApp Router (n8n)',
            body: 'The text brain: an n8n workflow with 37 nodes that classifies every message, decides which sub-agent to invoke, and orchestrates the response. Tool calling, prompt engineering, and all routing logic live here.',
          },
          voiceRouter: {
            heading: 'Voice Router (ElevenLabs)',
            body: 'The voice brain: a conversational agent on ElevenLabs powered by Gemini 2.5 Flash, knowledge bases with business documentation, and the same tools exposed as webhooks. The customer talks on the phone and Jacobo responds in real time, checking prices, availability and managing appointments — exactly the same as WhatsApp.',
          },
        },
        deepDiveQuotes: {
          heading: 'Deep Dive: Quotes Sub-agent',
          body: 'The quotes sub-agent is the most critical in the system: every price inquiry flows through it. It uses GPT-4.1 mini via OpenRouter for structured output precision. Its response determines the entire flow\'s next step.',
          challenge: {
            heading: 'The challenge: from free text to structured quote',
            body: 'The customer writes "how much to replace the screen on an iPhone 15 Pro Max". The router needs a JSON with price, stock status, appointment and part URLs. The sub-agent bridges natural language with the Airtable database in real time.',
          },
          cleanModel: {
            heading: 'CleanModel — Encoding tacit knowledge',
            body: 'Customers don\'t type model names like a database. They write "iphone 15", "iPhone15 pro max", "ip 15 pro", "I-Phone 15Pro Max". A human technician solved this with experience — they knew "the big black one" was probably a Pro Max. That tacit knowledge gets lost if you don\'t design for it.',
            detail: 'CleanModel normalizes the input: strips spaces, parentheses, hyphens, and lowercases. "iPhone 15 Pro Max" → "iphone15promax". This feeds a SEARCH() lookup in Airtable on the modeloLimpio field (also normalized), enabling fuzzy matching without relying on exact spelling.',
            insight: 'This node encodes tacit business knowledge. Without it, the agent would fail on most real inputs — because customers don\'t talk like databases. It\'s an example of why building agents requires domain understanding, not just connecting APIs.',
          },
          aiAgent: {
            heading: 'AI Agent — GPT-4.1 mini via OpenRouter',
            body: 'The sub-agent\'s brain. System prompt with an ultra-scoped ROLE: "agent specialized in looking up prices". Includes Think tool for explicit reasoning before each tool call and Simple Memory (buffer window) with a static sessionKey.',
            tools: [
              {
                label: 'BuscarModelo',
                detail: 'Searches by modeloLimpio field in the Models table → returns RECORD_ID, Name, URLSantiferNueva, Cita diagnóstico.',
              },
              {
                label: 'BuscarReparacionesModelo',
                detail: 'Searches by RECORD_ID → returns 20 repair types with "Price, stock & appointment" (original screen, compatible, battery, microphone, speaker, charging port, rear/front camera, etc.).',
              },
              {
                label: 'Structured Output Parser',
                detail: 'Formats to JSON with schema: modelo, reparación, precio, stock, urlSantifer, urlCita, urlPresupuesto, urlDiagnostico, idPiezaAirtable, idModeloAirtable.',
              },
            ],
            fallback: 'If no match is found, the system prompt instructs: "you must keep narrowing the model to get more results, until you find the right one" — replicating a seasoned technician\'s reasoning.',
          },
          filtrarRespuesta: {
            heading: 'FiltrarRespuesta — Deterministic post-processing',
            body: 'Code node that validates and cleans the AI Agent\'s response before returning it to the router. Validates that urlSantifer points to the correct domain (if it doesn\'t contain "joestechsolutions.com" → "NOT AVAILABLE ON WEB YET"). Then applies 3 field-stripping paths based on state:',
            rules: [
              {
                condition: 'stock === true',
                action: 'Strips urlPresupuesto, idPieza, idModelo — customer can book an appointment directly.',
              },
              {
                condition: 'stock === false',
                action: 'Strips urlCita and urlPresupuesto — part needs to be ordered before repair.',
              },
              {
                condition: 'precio === "PRESUPUESTO"',
                action: 'Strips urlCita and idPieza — repair not catalogued, requires manual assessment.',
              },
            ],
          },
          punchline: 'The result: a customer asks "how much to fix my iPhone screen" and in 4 seconds gets a real price, stock availability, and a direct link to book an appointment or place an order. No forms, no "let me transfer you". The sub-agent queries only the essential Airtable fields and returns exactly what the router needs to close the conversion.',
          presupuestoPrompt: {
            heading: 'Quotes sub-agent system prompt (n8n)',
            body: 'The prompt defines three tools (BuscarModelo, BuscarReparacionesModelo, Structured Output Parser) and a 4-step flow to return structured quotes with stock status.',
            segments: [
              {
                code: `## ROL
Eres un sub-agente de presupuestos para Joe\'s Tech Solutions.
Tu trabajo: recibir un modelo y una reparación, buscarlos en Airtable
y devolver un presupuesto estructurado.`,
                annotations: [
                  {
                    label: 'Scoped sub-agent role',
                    detail: 'Not a general assistant: a sub-agent with a single responsibility. The ultra-narrow scope eliminates the LLM\'s temptation to chat, suggest alternatives, or add unsolicited context.',
                  },
                ],
              },
              {
                code: `## OBJETIVO
Buscar el modelo exacto y la reparación solicitada en la base de datos.
Devolver precio, disponibilidad de stock y siguiente paso recomendado.`,
                annotations: [
                  {
                    label: 'Single-responsibility objective',
                    detail: 'One job: look up + return quote. The "recommended next step" (appointment, order, manual quote) lets the main router decide without another LLM call.',
                  },
                ],
              },
              {
                code: `## HERRAMIENTAS
- "BuscarModelo": busca el modelo del dispositivo en Airtable
- "BuscarReparacionesModelo": busca reparaciones disponibles para ese modelo
- "Structured Output Parser": formatea la respuesta en JSON estructurado`,
                annotations: [
                  {
                    label: 'Tool chain pipeline',
                    detail: 'The 3 tools form a sequential pipeline: find model → find repairs → format. The Structured Output Parser at the end guarantees the JSON is consumable by the router without post-processing.',
                  },
                ],
              },
              {
                code: `## PASOS
1. Recibir modeloInput y reparacionInput del router
2. Llamar a BuscarModelo con modeloLimpio
3. Si encuentra el modelo → llamar a BuscarReparacionesModelo
4. Devolver JSON: precio, stock, tiempo estimado, urlCita, urlPresupuesto`,
                annotations: [
                  {
                    label: 'Explicit step sequencing',
                    detail: 'Deterministic step-by-step order. Without this, the LLM would sometimes skip BuscarModelo and try to guess the price. Each step conditions the next: zero ambiguity about what to do.',
                  },
                ],
              },
              {
                code: `// User message template (n8n injects the variables)
Modelo: {{ \$json.modeloInput }}
Modelo limpio: {{ \$json.modeloLimpio }}
Reparación: {{ \$json.reparacionInput }}`,
                annotations: [
                  {
                    label: 'Variable injection via template',
                    detail: 'n8n injects modeloInput (what the customer said), modeloLimpio (normalized by the router), and reparacionInput. Separating raw/clean input lets the sub-agent search with the normalized name without losing the customer\'s original context.',
                  },
                ],
              },
            ],
          },
        },
        deepDiveOthers: {
          heading: 'Deep Dive: Tools',
          body: 'Not every piece of the system needs an LLM. These three tools are lightweight workflows that each execute a single operation, simple by design: decision logic lives in the router.',
          orders: {
            heading: 'hacerPedido: Rush Orders',
            body: 'When the quotes sub-agent detects the part is out of stock, the router invokes hacerPedido. The workflow creates a record in the Airtable "Pedidos" table with everything the team needs to order from the supplier.',
            nodes: 'Webhook → Airtable Create (Pedidos table) → Respond to Webhook',
            details: [
              'Automatically flags "Rush? = YES" because the customer is waiting',
              'Links idPieza and idModelo for full traceability in the Business OS',
              'Adds note "Automated order by Jacobo" + customer comment',
              'The team receives the order in their Airtable view with zero manual intervention',
            ],
          },
          calculator: {
            heading: 'Discount Calculator',
            body: 'Pure business logic, zero LLM. When the customer needs multiple repairs (e.g., screen + battery + back glass), the router sends a price array and the calculator applies tiered discounts automatically.',
            nodes: 'Webhook → Code (discount logic) → Response',
            details: [
              'Sorts prices high-to-low: the most expensive repair gets no discount',
              'Position-based discount: ≤€50 → €15 off, ≤€100 → €20 off, >€100 → €25 off',
              'Returns formatted summary: price without discount, discount applied, final price',
              'The customer instantly sees how much they save by bundling repairs in one visit',
            ],
            segments: [
              {
                code: `const precios = item.json.body.precios;

// Validaciones básicas
if (!Array.isArray(precios) || precios.length < 2) {
    throw new Error('Debes enviar un array "precios" con al menos 2 números.');
}`,
                annotations: [
                  {
                    label: 'Defensive validation',
                    detail: 'The sub-agent doesn\'t trust the router: validates the array exists and has at least 2 prices. If the LLM sent malformed data, it fails fast with a descriptive error instead of returning NaN.',
                  },
                ],
              },
              {
                code: `// 1) Ordenamos de mayor a menor
const ordenados = [...precios].sort((a, b) => b - a);

// 2) Calculamos descuento por posición (el primero no tiene)
const descuentos = ordenados.map((precio, idx) => {
    if (idx === 0) return 0;        // sin descuento para el más caro
    if (precio <= 50)  return 15;
    if (precio <= 100) return 20;
    return 25;                      // >100 €
});`,
                annotations: [
                  {
                    label: 'Business rules as code, not as prompt',
                    detail: 'Discounts live in a Code node, not a prompt. This guarantees determinism: a €189 screen + €45 battery always yields the exact same discount. Zero hallucinations possible.',
                  },
                ],
              },
              {
                code: `// 3) Totales
const totalSinDescuento = ordenados.reduce((s, p) => s + p, 0);
const descuentoTotal    = descuentos.reduce((s, d) => s + d, 0);
const totalConDescuento = totalSinDescuento - descuentoTotal;

// 4) Preparar respuesta
const resumen =
    \`Presupuesto total sin descuento: \${totalSinDescuento.toFixed(2)} €
Descuento aplicado: \${descuentoTotal.toFixed(2)} €
Presupuesto reparándolo todo junto: \${totalConDescuento.toFixed(2)} €\`;`,
                annotations: [
                  {
                    label: 'Pre-formatted response for the router',
                    detail: 'The plain-text summary goes to the router and is passed directly to the customer. The LLM doesn\'t rephrase: it copies the text verbatim. The price the customer sees is exactly what the code calculated.',
                  },
                ],
              },
            ],
          },
          hitl: {
            heading: 'HITL Handoff: Human Escalation',
            body: 'The system\'s escape valve. When Jacobo detects it can\'t resolve (frustrated customer, complex case, out-of-scope request), it escalates to a human via Slack with full context.',
            nodes: 'Webhook → Slack (#chat) → Respond to Webhook',
            details: [
              'Posts to #chat channel with 🤖 emoji as avatar',
              'Message includes: conversation summary, detected intent, and customer history',
              'Deep-link directly to the WATI conversation: the human opens it with full context already loaded',
              'Jacobo confirms to the customer that a human will reach out, without cutting the conversation',
            ],
          },
          whatsapp: {
            heading: 'EnviarMensajeWati: Cross-Channel',
            body: 'The bridge between channels. When the customer is on the phone with Jacobo (ElevenLabs), this workflow sends links and confirmations via WhatsApp in parallel. The customer gets the info in writing while still talking.',
            nodes: 'Webhook → HTTP Request (WATI API) → Respond to Webhook',
            details: [
              'Sends "urlreparacion2" template with the personalized appointment URL',
              'Enables the voice agent to say "I just sent you the link on WhatsApp"',
              'The customer doesn\'t need to write anything down: when they hang up, the info is already on their phone',
            ],
          },
        },
      },
      cta: {
        heading: 'Looking for someone to build this for your company?',
        body: 'Jacobo handles appointments, queries real inventory, and escalates with context, all in under 30 seconds. The sub-agent architecture, tool calling, and HITL patterns apply directly to travel, fintech, healthcare, or e-commerce.',
        label: 'LinkedIn',
        labelSecondary: 'Email',
      },
      ctaAfterEnterprise: {
        heading: 'These patterns are ready to scale. So am I.',
      },
      ctaAfterDownloads: {
        heading: 'You liked the workflows. Imagine what I can do with yours.',
      },
      faq: {
        heading: 'FAQ',
        items: [
          {
            q: 'How much does it cost to build an AI agent for WhatsApp?',
            a: 'The recurring infrastructure costs break down as follows: n8n Cloud Pro at approximately €24/month for workflow hosting and execution, WATI at around €40/month for WhatsApp Business API access with template messaging, Aircall at approximately €50/month for the cloud PBX with call routing and recording, and LLM inference via OpenRouter averaging €30-50/month depending on conversation volume. ElevenLabs for voice synthesis runs about €20/month on their Starter plan. Total: under €200/month for a system handling approximately 90% of customer interactions autonomously around the clock. The real cost is the upfront architecture and development time — approximately one month in this case. Compared to a part-time customer service employee at minimum wage, the system pays for itself within the first month of operation.',
          },
          {
            q: 'What happens if the AI gets a price wrong?',
            a: 'Prices never come from the LLM — they come from Airtable, the single source of truth for all structured data. When a customer asks about pricing, Jacobo\'s tool-calling layer executes a filtered Airtable query against the inventory base, retrieving the exact record for that device, part, and repair type. The response is assembled from returned fields, not generated by the model. A validation layer checks that the returned price is within expected bounds and marked as active inventory. If the query returns no match or an out-of-range value, Jacobo falls back to polite escalation: it tells the customer it will confirm the price and routes the conversation to a human agent via WATI. Hallucination on structured data is architecturally impossible — the LLM formats the answer but never invents the numbers.',
          },
          {
            q: 'How does the voice agent on a landline work?',
            a: 'Jacobo is integrated into the Aircall PBX as another teammate in the call routing queue. When no human agent is available or during after-hours, Aircall routes the incoming landline call to Jacobo. The caller hears a natural Spanish voice powered by ElevenLabs Conversational AI, which handles real-time speech-to-text and text-to-speech with sub-second latency. Under the hood, the voice interface triggers the same n8n sub-agent webhooks as WhatsApp: the pricing agent queries Airtable for real costs, the appointment agent checks YouCanBookMe for available slots, and the HITL escalation path routes to a human when confidence drops below threshold. Same orchestration logic, same data sources, different input/output modality. The customer experience is seamless — most callers do not realize they are speaking with an AI agent.',
          },
          {
            q: 'Why n8n and not LangChain/LangGraph directly?',
            a: 'n8n provides a critical advantage for multi-agent systems at this scale: each sub-agent is a self-contained visual workflow with its own webhook endpoint, independently testable with a single HTTP call. You can inspect the execution path node by node, see exactly where a conversation routing decision happened, and debug by replaying individual executions. With 7 workflows and approximately 80 nodes total, the visual canvas makes the architecture legible to anyone — not just the developer who built it. LangChain or LangGraph would require maintaining a Python codebase with custom orchestration logic, dependency management, and deployment infrastructure. For a business owner who also needs to ship the system quickly, n8n collapses the build-test-deploy cycle into days, not weeks. The maintenance barrier stays low because the logic is visible, not buried in code.',
          },
          {
            q: 'How long did it take to build Jacobo?',
            a: 'Less than a month from architecture design to production deployment, built in parallel with all other business responsibilities. This was my first AI agent — the speed came entirely from the Business OS already existing as a foundation. Five years of structured data in Airtable meant Jacobo had clean APIs to query: real-time inventory with exact stock counts and warehouse locations, a CRM with full customer purchase history and loyalty tier, and an appointment system already integrated with YouCanBookMe. Without that data layer, building the agent would have required months of data infrastructure work before writing a single prompt. Jacobo was the inevitable consequence of a robust business operating system — the data was ready, the agent just needed to learn how to use it.',
          },
          {
            q: 'Can you build something like this for my company?',
            a: 'Yes. Jacobo\'s core patterns — sub-agent orchestration via webhooks, tool calling against structured databases, HITL escalation with context preservation, and cross-channel deployment — are industry-agnostic. A dental clinic could replace the parts catalog with a treatment catalog, swap repair appointments for patient scheduling, and keep the same conversation routing architecture. An agency could route client requests to sub-agents for quoting, scheduling, and project status queries. What changes between implementations is the data schema and the specific integrations — the orchestration pattern, escalation logic, and conversation memory architecture transfer directly. The prerequisite is having structured, accessible data: if your business information lives in spreadsheets or disconnected tools, the first step is building the data layer before deploying an agent.',
          },
          {
            q: 'Is Jacobo still running?',
            a: 'Yes. I sold the business in September 2025 as a going concern, and Jacobo was included as a core operational asset in the sale. The buyer inherited the complete system: all seven n8n workflows, the Airtable data layer, WATI WhatsApp integration, Aircall voice routing, and the ElevenLabs voice configuration. Jacobo is still in production today, serving real customers on both WhatsApp and the landline without any intervention from me. The fact that a non-technical buyer could acquire a business with an AI agent and continue operating it without rebuilding anything is the strongest validation of the architecture. It was designed from day one to be maintainable by someone who did not build it.',
          },
          {
            q: 'How did you go from owning a business to looking for an enterprise role?',
            a: 'I built and ran a 16-year business from scratch, progressively layering systems that scale: a custom 12-base Airtable ERP handling 30,000+ repairs, an AI agent achieving 90% self-service, programmatic SEO generating 4,730 pages and 2.26M impressions, and a gamified CRM with five loyalty tiers that measurably increased customer retention. After selling the business in 2025 at its operational peak, I wanted to apply that same systems thinking — automation architecture, data pipeline design, production AI deployment — to larger-scale problems at companies building AI products. The transition from owner-operator to enterprise roles as an FDE, Solutions Architect, or AI Production Manager is a natural progression: same engineering mindset, bigger canvas, more complex stakeholder environments.',
          },
        ],
      },
      resources: {
        heading: 'Resources',
        items: [
          {
            label: 'n8n — Workflow Automation',
            url: 'https://n8n.io',
          },
          {
            label: 'OpenRouter — Model Gateway',
            url: 'https://openrouter.ai',
          },
          {
            label: 'ElevenLabs — Conversational AI',
            url: 'https://elevenlabs.io',
          },
          {
            label: 'WATI — WhatsApp Business API',
            url: 'https://www.wati.io',
          },
          {
            label: 'Aircall — Cloud PBX',
            url: 'https://aircall.io',
          },
          {
            label: 'Airtable — Database Platform',
            url: 'https://airtable.com',
          },
        ],
      },
      downloads: {
        badge: '7 production workflows downloadable — open source by default',
        inlineLabel: 'View on GitHub',
        inlineHint: 'Import into n8n in 1 click',
        section: {
          heading: 'Run It Yourself',
          intro: 'These are the actual workflows that have been running in production for 2 years. Sanitized, documented, ready to import into n8n. If you build something with them, I\'d love to see it.',
          downloadAllLabel: 'Download all (ZIP)',
          downloadAllSize: '~37 KB',
          importHeading: 'How to import into n8n',
          importSteps: [
            'Open your n8n instance and go to Workflows',
            'Click "..." → "Import from file"',
            'Select any .json file from the download',
            'Update credentials (API keys, webhooks) with your own values',
          ],
        },
        workflows: [
          {
            id: 'jacobo-chatbot-v2',
            icon: '🧭',
            name: 'Jacobo Chatbot V2',
            subtitle: 'Central Router',
            description: 'The brain of the WhatsApp channel. Classifies intent, picks the right sub-agent, maintains a 20-message memory window.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/jacobo-chatbot-v2.json',
            fileSize: '~66 KB',
            nodes: '37 nodes',
            llm: 'GPT-4.1',
          },
          {
            id: 'subagente-citas',
            icon: '📅',
            name: 'subagenteCitas',
            subtitle: 'Appointment Booking',
            description: 'Turns "tomorrow morning" into a confirmed appointment. Parses natural language time preferences.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/subagente-citas.json',
            fileSize: '~24 KB',
            nodes: '18 nodes',
            llm: 'MiniMax M2.5',
          },
          {
            id: 'presupuesto-modelo',
            icon: '💰',
            name: 'Presupuesto Modelo',
            subtitle: 'Quote Agent',
            description: 'Looks up exact model + repair in Airtable, returns real price with stock status.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/presupuesto-modelo.json',
            fileSize: '~15 KB',
            nodes: '11 nodes',
            llm: 'GPT-4.1 mini',
          },
          {
            id: 'hacer-pedido',
            icon: '📦',
            name: 'hacerPedido',
            subtitle: 'Order Creation',
            description: 'Creates repair orders in Airtable when parts are out of stock.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/hacer-pedido.json',
            fileSize: '~79 KB',
            nodes: '3 nodes',
          },
          {
            id: 'calculadora-joestech',
            icon: '🧮',
            name: 'CalculadoraSantifer',
            subtitle: 'Discount Calculator',
            description: 'Pure business logic. Calculates combo discounts when customers bundle multiple repairs.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/calculadora-joestech.json',
            fileSize: '~2.7 KB',
            nodes: '3 nodes',
          },
          {
            id: 'contactar-agente-humano',
            icon: '🙋',
            name: 'contactarAgenteHumano',
            subtitle: 'HITL Handoff',
            description: 'The escape valve. Escalates to human via Slack with a deep-link to the conversation.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/contactar-agente-humano.json',
            fileSize: '~2.3 KB',
            nodes: '5 nodes',
          },
          {
            id: 'enviar-mensaje-wati',
            icon: '📱',
            name: 'EnviarMensajeWati',
            subtitle: 'WhatsApp Sender',
            description: 'Cross-channel bridge: the voice agent sends WhatsApp messages via the WATI API.',
            href: 'https://github.com/joblas/jacobo-workflows/blob/main/enviar-mensaje-wati.json',
            fileSize: '~2.5 KB',
            nodes: '3 nodes',
          },
        ],
        githubNote: 'All workflows live on GitHub — fork, star, or download directly.',
        githubCta: 'View repo on GitHub',
      },
      footer: {
        role: 'AI Product Manager · Solutions Architect',
        bio: 'Built and sold a 16-year business in 2025. Now applying the same systems thinking to enterprise AI — as an FDE, Solutions Architect, or AI Production Manager.',
        fellowAt: 'Teaching Fellow at',
        fellowLink: 'AI Product Academy',
        copyright: 'All rights reserved.',
      },
    }

export const jacoboContent = _en
