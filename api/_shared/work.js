// ---------------------------------------------------------------------------
// Joe's work: the ONE source of truth for portfolio facts.
//
// Every agent surface reads its project facts from here, so none of them can
// drift on its own:
//   - the cloudyjoe text prompt   (personas.js -> composeTextPrompt)
//   - the jts text prompt         (personas.js -> composeTextPrompt)
//   - the cloudyjoe voice prompt  (voice-token.js VOICE_BASE_PROMPT -> workVoiceBlock)
//   - the jts voice prompt        (personas.js JTS_VOICE_PROMPT -> workVoiceBlock)
//   - the voice search reasoning  (rag-search.js reuses the composed text prompt)
//   - retrieval                   (rag.js expandDocumentsQuery -> expandWorkQuery)
//   - the RAG corpus              (scripts/export-chunks.ts -> workFactCards; it
//                                  reaches production only on a manual rag:sync)
//
// Why it exists (2026-10-02): a visitor asked the cloudyjoe voice agent whether
// Joe can build a Shopify store for a musician selling t-shirts and stickers.
// Joe set up exactly that for the artist Cbarrgs, but the fact lived in no
// prompt and no indexed article, so the agent said it had no such detail. The
// hand-kept project lists in four places had also drifted into false claims
// (an SMS vendor the code does not use, a framework the site is not built on,
// store releases that never happened).
//
// What may go in: only items an audit verified (verdict INCLUDE or
// INCLUDE_WITH_CARE in the 2026-10-02 inventory), each with its evidence-backed
// wording rule. Excluded items never appear. Career history (the AV years and
// the current day job) is NOT here: those lines stay in the persona prompts,
// where Joe owns their wording.
//
// Rules for editing this file:
//   - No em dashes in this copy (Joe's rule for new copy).
//   - No money, prices or pro-bono details. No usage, traffic or revenue
//     numbers unless dated and scoped as the source dates them.
//   - Name a client only where CLIENT_NAMING allows it for that persona.
//   - `avoid` holds phrases the agents must never use about the item. They are
//     rendered as "Do not say or imply:" notes; tests/agent-knowledge.test.ts strips
//     exactly those notes before it scans for banned claims.
// ---------------------------------------------------------------------------

export const WORK_AS_OF = '2026-10-02'

// Placeholder in chatbot-prompt.txt and jts-prompt.txt where the work list goes.
export const WORK_MARKER = '{{WORK_JOE_HAS_SHIPPED}}'
export const WORK_TEXT_HEADING = 'Work Joe has actually shipped'
export const WORK_VOICE_HEADING = "Joe's work"

export const PERSONA_IDS = ['cloudyjoe', 'jts']

// Who may be named on which persona. A name that is false for a persona must
// never appear in that persona's composed prompt or voice instructions.
// Source: the inventory's client_named_publicly field, checked 2026-10-02.
export const CLIENT_NAMING = {
  // Named on both sites (joestechsolutions.com/portfolio/cbarrgs, cloudyjoe.com/cbarrgs-agent/).
  Cbarrgs: { cloudyjoe: true, jts: true },
  // The salon's name is on joestechsolutions.com/portfolio/archive-salon and cloudyjoe.com/archive-beta-loop/.
  Archive: { cloudyjoe: true, jts: true },
  // On the cloudyjoe.com homepage card; JTS keeps him anonymous.
  'Willy Santos': { cloudyjoe: true, jts: false },
  // First names appear in cloudyjoe articles only. Whether they are happy to be
  // named is an open question for Joe, so the agents' own lists leave them out.
  Nick: { cloudyjoe: false, jts: false },
  Van: { cloudyjoe: false, jts: false },
}

// Retrieval-bridge pattern helpers (see `expand` below).
// Any of several patterns, case-insensitive.
function anyOf(...patterns) {
  return new RegExp(patterns.map((p) => p.source).join('|'), 'i')
}
// Two word groups in the same sentence, in either order.
function near(a, b, gap = 60) {
  const A = `\\b(?:${a})\\b`
  const B = `\\b(?:${b})\\b`
  return new RegExp(`${A}[^.?!]{0,${gap}}${B}|${B}[^.?!]{0,${gap}}${A}`)
}

// Work items. Fields:
//   id        stable id (fact-card section id, test anchor)
//   name      short label the agents use; a string, or { cloudyjoe, jts }
//   kind      client work | own product | offer | open source | method | demo
//   verdict   the inventory verdict (INCLUDE or INCLUDE_WITH_CARE only)
//   line      the true one-liner for text prompts and fact cards;
//             a string, or { cloudyjoe, jts } where naming differs
//   short     the spoken-length version for voice instructions (same shape)
//   avoid     phrases never to use about this item
//   voiceAvoid  the subset of `avoid` repeated in the voice instructions: only
//             the high-risk ones (a vendor, framework or store release the
//             records refute, an authorship claim, a client's name). Gemini
//             Live is billed for its whole setup every session, so the rest
//             stay in the text prompt and the fact cards.
//   voice     false keeps a low-value item out of the voice instructions (it
//             stays in the text prompt and the fact cards)
//   pages     each persona's own page for it ({ cloudyjoe, jts }, either optional)
//   urls      other public URLs (both personas)
//   article   the cloudyjoe article id its fact card badges to (optional)
//   asked     how visitors ask about it (fact cards only, for retrieval)
//   expand    retrieval bridge: { when: RegExp, terms: [...] } (optional). The
//             pattern must need the item's own domain words: a bare common
//             word ("clean", "host", "coach", "directory", "artist", "a store")
//             fires on recruiters' ordinary questions and pulls this item's
//             rows into answers it has nothing to do with.
export const WORK_ITEMS = [
  {
    id: 'cbarrgs-site',
    // JTS names each case study the way its /portfolio does (rag.js JTS_CASE_STUDIES).
    name: { cloudyjoe: 'cbarrgs.com, website for the artist Cbarrgs', jts: 'Cbarrgs Music (cbarrgs.com, the artist\'s website)' },
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'Joe builds and maintains cbarrgs.com, the website for the electronic and ambient artist Cbarrgs: releases, streaming links, a /new smart link to the latest drop, a link to the merch store, and structured data (JSON-LD and llms.txt) for search engines and AI crawlers. It is a Vite + React single-page app on Cloudflare Pages with Pages Functions. It started in Lovable, an AI app builder, in March 2025, and Joe has extended it with AI coding agents since.',
    short: 'Joe builds and maintains cbarrgs.com for the electronic and ambient artist Cbarrgs: releases, streaming links, a smart link to the latest drop and a link to the merch store, built with Vite and React on Cloudflare Pages.',
    avoid: ['Next.js', 'server-side rendering', 'hand-coded from scratch', 'any monthly-listener number'],
    pages: { cloudyjoe: '/cbarrgs-agent', jts: '/portfolio/cbarrgs' },
    urls: ['https://cbarrgs.com/'],
    article: 'cbarrgs-agent',
    asked: ['Can Joe build a website for a musician or band?', 'What did Joe build for Cbarrgs?', 'Does Joe do artist websites?'],
    voiceAvoid: ['Next.js'],
    expand: {
      // A musician self-describing is enough; "artist" or "band" alone is not
      // ("Is Joe an artist?", "sensor bands"). An artist or DJ needs a site,
      // store or music word nearby. A band needs a site, store or music word
      // too, never only a work word: "his work with sensor bands" and "a band
      // of sensors he built for calibration" are AV questions.
      when: anyOf(
        /\b(?:musicians?|rappers?|singers?|songwriters?|record labels?)\b/,
        near('artists?|djs?|bands?', 'sites?|websites?|web ?pages?|landing pages?|stores?|shops?|merch\\w*|music|songs?|albums?|tracks?|streaming|spotify|releases?|smart ?links?'),
      ),
      terms: ['Cbarrgs', 'musician', 'website'],
    },
  },
  {
    id: 'cbarrgs-shop',
    name: 'Cbarrgs merch store on Shopify',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe set up the artist Cbarrgs's Shopify merch storefront at shopify.cbarrgs.com (t-shirts, a pin and a sticker pack, on Shopify's Dawn theme) and wired it into cbarrgs.com through the cart icon, the menu, a merch carousel and a Visit Store button. So if someone asks whether Joe can set up a Shopify merch store, for example for a musician selling t-shirts and stickers, the answer is yes: he has set up this one. Anything beyond it, such as a custom theme or a custom-built store, is scoped per project.",
    // "with", not "selling": stock changes (on 2026-10-02 the pin and the
    // sticker pack were sold out), the catalogue does not.
    short: "Joe set up the artist Cbarrgs's Shopify merch store at shopify.cbarrgs.com, with t-shirts, a pin and a sticker pack, and wired it into cbarrgs.com. So yes, he has set up a Shopify merch store for a musician; anything beyond that is scoped per project.",
    avoid: ['any sales, order or revenue figure', 'a custom Shopify theme or app'],
    pages: { cloudyjoe: '/cbarrgs-agent', jts: '/portfolio/cbarrgs' },
    urls: ['https://shopify.cbarrgs.com/'],
    article: 'cbarrgs-agent',
    asked: ['Can Joe build a Shopify store?', 'Can he make an online store for a musician selling t-shirts and stickers?', 'Has Joe done e-commerce or a merch shop?'],
    expand: {
      // "store" alone is ambiguous: the verb ("store my data"), an app store
      // ("is it in the store yet?"), a kind of business ("a coffee shop"). It
      // counts only with an e-commerce cue: online/web/merch store, building
      // one ("set up a store"), a store for a musician or brand, selling online.
      // Not a feature named after a store ("a store locator", "shop hours").
      when: anyOf(
        /\b(?:shopify|merch(?:andise)?|e-?commerce|storefronts?|web ?shop|t-?shirts?|tees|stickers?|hoodies?)\b/,
        /\b(?:online|web|internet|merch|e-?commerce)\s+(?:stores?|shops?)\b/,
        /\b(?:build|make|set up|setup|create|launch|start)\s+(?:me\s+|us\s+|him\s+|her\s+|them\s+)?(?:a|an|my|our|his|her|their)\s+(?:(?:online|web|small|simple|little)\s+)?(?:stores?|shops?)\b(?!\s+(?:locators?|finders?|hours|maps?|lookups?|search))/,
        /\b(?:stores?|shops?)\s+(?:for\s+(?:a\s+|an\s+|my\s+|our\s+|his\s+|her\s+|their\s+)?(?:musicians?|bands?|artists?|brands?|creators?)|to sell|that sells|selling)\b/,
        /\bsell(?:s|ing)?\b[^.?!]{0,40}\bonline\b/,
      ),
      terms: ['Cbarrgs', 'merch', 'Shopify'],
    },
  },
  {
    id: 'cbarrgs-site-agent',
    name: 'Cbarrgs site agent (a Telegram line to an AI coding agent)',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'Joe gave the artist a Telegram line to an AI coding agent (a Claude Code session) that works inside the cbarrgs.com repository: the artist can ask for site changes, and the agent deploys them only if the build passes. It has been live since 2026-08-26 under a written charter, a two-person allowlist and a 5-minute watchdog, and it runs on Joe\'s machine and subscription, so its uptime depends on them.',
    short: 'The artist also has a Telegram line to an AI coding agent that works inside the cbarrgs.com code and deploys a change only if the build passes. It runs on Joe\'s machine.',
    avoid: ['the artist runs his site by text', 'any count of client requests'],
    pages: { cloudyjoe: '/cbarrgs-agent', jts: '/portfolio/cbarrgs' },
    urls: [],
    article: 'cbarrgs-agent',
    asked: ['Can the client change his own website?', 'What is the Cbarrgs agent?'],
  },
  {
    id: 'cbarrgs-news-worker',
    name: 'Cbarrgs news worker (a small Cloudflare Worker)',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "A small supporting service: a Cloudflare Worker, started from Cloudflare's Agents SDK starter, that serves the news and hero copy shown on cbarrgs.com and holds a few marketing helper tools Joe added.",
    short: "A small Cloudflare Worker, started from Cloudflare's Agents SDK starter, serves the news and hero copy on cbarrgs.com.",
    avoid: ['an autonomous marketing agent'],
    voice: false,
    pages: {},
    urls: [],
    article: 'cbarrgs-agent',
    asked: ['Where does the news on cbarrgs.com come from?'],
  },
  {
    id: 'turnover-agent',
    name: 'Turnover Agent (short-term-rental turnovers)',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe built and runs a turnover assistant for a short-term-rental manager. It watches the booking calendars for guest checkouts, messages the cleaner (Telegram-first, with an email-to-SMS fallback) and is built to track each clean and escalate when one stalls. The manager uses it through a Telegram bot and a login-protected mobile dashboard. In production since late July 2026 on a server Joe operates; Python with FastAPI, Supabase and python-telegram-bot, deployed with Docker and Caddy. Joe is still extending it at the manager's request.",
    short: "Joe built and runs a turnover assistant for a short-term-rental manager: it watches booking calendars for checkouts, messages the cleaner on Telegram first, and is built to track the clean and escalate if it stalls. In production since late July 2026.",
    avoid: ['Twilio', 'plain SMS for cleaners', 'unattended for weeks', 'any message, turnover or usage count', "the client's own server"],
    pages: { cloudyjoe: '/turnover-agent', jts: '/portfolio/turnover-agent' },
    urls: [],
    article: 'turnover-agent',
    asked: ['Can Joe automate cleaner scheduling for an Airbnb or vacation rental?', 'Has he built anything for property managers?'],
    voiceAvoid: ['Twilio', 'plain SMS for cleaners'],
    expand: {
      // Rental-operations words only: not "clean" ("clean code"), "host" ("who
      // hosts this site"), "short-term" ("short-term goals") or "checkout"
      // ("a Stripe checkout"); not staff turnover either.
      when: /\b(?:cleaners?|cleaning (?:crews?|staff|teams?|schedul\w*|services?|business\w*)|(?<!\b(?:staff|employee|team|job|high|low)\s)turnovers?|airbnbs?|vrbos?|vacation (?:homes?|rentals?)|short-term rentals?|rental propert(?:y|ies)|property manag\w*|guest check-?(?:outs?|ins?))\b/i,
      terms: ['turnover', 'cleaner', 'rental'],
    },
  },
  {
    id: 'archive-salon-app',
    name: { cloudyjoe: 'Archive salon app (hair-color formulas and inventory)', jts: 'Archive Salon (hair-color formula and inventory app)' },
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'Joe built a hair-color formula and inventory app for one salon, Archive. The colorist records each formula (ratio, developer, grams and a photo of the bowl on the scale) and scans products in and out by barcode. It is designed to capture a formula in under 30 seconds. An Expo / React Native + Supabase iOS app, in TestFlight beta with the salon owner and not submitted to the App Store; JavaScript fixes ship over the air.',
    short: 'For Archive, a hair-color salon, Joe built a formula and inventory app: each color formula with a photo of the bowl, and products scanned in and out by barcode. It is in TestFlight beta with the owner, not on the App Store.',
    avoid: ['on the App Store', 'iOS and Android', 'real formulas captured daily', 'salon management app', 'any usage or adoption number'],
    pages: { cloudyjoe: '/archive-beta-loop', jts: '/portfolio/archive-salon' },
    urls: [],
    article: 'archive-beta-loop',
    asked: ['Has Joe built an app for a salon or a beauty business?', 'Can he build an inventory app with barcode scanning?'],
    voiceAvoid: ['on the App Store'],
    expand: {
      // Not bare "hair" or "beauty" ("the beauty of composable agents"), and
      // not a bare trade ("Is Joe a stylist?"): a stylist, colorist or barber
      // counts only next to an app, tool or business word.
      when: anyOf(
        /\b(?:salons?|hair ?(?:salons?|stylists?|colou?r\w*|dressers?|studios?)|hairdressers?|barbershops?|beauty (?:salons?|shops?|studios?|business\w*|brands?|industry)|colou?r formulas?|barcodes?)\b/i,
        near('stylists?|colou?rists?|barbers?', 'apps?|software|tools?|inventory|formulas?|bookings?|clients?|business\\w*|shops?|built|build\\w*'),
      ),
      terms: ['Archive', 'salon', 'formula'],
    },
  },
  {
    id: 'archive-beta-loop',
    name: 'Archive beta-feedback loop',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "For the salon app Joe built a feedback loop: the owner texts a Telegram bot, an AI coding session on Joe's own machine turns each message into a GitHub issue, and clear-cut bugs get a reviewed fix that ships over the air; features go through pull requests Joe merges. The 2026-09-01 write-up counted 20 feedback issues, 13 merged beta pull requests, 10 over-the-air updates and a median of 13.8 minutes from message to merged fix. It runs on Joe's machine and has had outages (a reboot in August 2026 lost about four days of messages).",
    short: "For the salon app, the owner texts a Telegram bot and an AI coding session on Joe's machine turns each message into an issue; clear-cut bugs get a reviewed fix shipped over the air.",
    avoid: ['0 lost messages', "on the client's server", 'a developer on call 24/7'],
    pages: { cloudyjoe: '/archive-beta-loop', jts: '/portfolio/archive-salon' },
    urls: [],
    article: 'archive-beta-loop',
    asked: ['How do client bug reports become fixes?', 'Can a client text in a bug and get it fixed?'],
  },
  {
    id: 'skate-workshop-app',
    name: 'The Skate Workshop coaching app',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: {
      cloudyjoe: 'Joe built The Skate Workshop, a one-on-one skateboarding coaching app (Expo / React Native + Supabase), for skate coach Willy Santos, a coach of Olympians. Athletes upload trick clips; the coach marks them up with drawings and voice notes, assigns homework and tracks progress on a 4,952-combination trick grid (140 tricks across stances and obstacles); iOS push notifications are live. It is in TestFlight beta only, never submitted to the App Store or Play Store, and development is currently paused.',
      jts: 'Joe built The Skate Workshop, a one-on-one skateboarding coaching app (Expo / React Native + Supabase), for a skate coach of Olympians. Athletes upload trick clips; the coach marks them up with drawings and voice notes, assigns homework and tracks progress on a 4,952-combination trick grid (140 tricks across stances and obstacles); iOS push notifications are live. It is in TestFlight beta only, never submitted to the App Store or Play Store, and development is currently paused.',
    },
    short: {
      cloudyjoe: 'A skateboarding coaching app Joe built for coach Willy Santos, a coach of Olympians: athletes upload clips and the coach marks them up with drawings and voice notes. TestFlight beta only, and paused.',
      jts: 'A skateboarding coaching app Joe built for a coach of Olympians: athletes upload clips and the coach marks them up with drawings and voice notes. TestFlight beta only, and paused.',
    },
    avoid: ['400+ tricks', 'multiplayer', 'Stripe or payments', 'Olympic coach', 'live on the App Store', 'Android builds', 'any user or engagement number', 'the 20/20 cohort'],
    pages: { cloudyjoe: '/skate-workshop-loop', jts: '/portfolio/skate-workshop' },
    urls: ['https://www.theskateworkshop.app/'],
    article: 'skate-workshop-loop',
    asked: ['Has Joe built a mobile app?', 'Can he build a coaching app with video feedback?'],
    voiceAvoid: ['Olympic coach', 'live on the App Store'],
    expand: {
      // Not bare "coach" ("is he coachable?", "does he coach his team?"),
      // "tricks" ("tricks for prompt engineering") or "athletes" ("how many
      // athletes did the self-driving car team have?").
      when: anyOf(
        /\b(?:skate\w*|(?:coaching|sports?|athletes?|training|fitness) apps?|video feedback)\b/i,
        near('athletes?', 'apps?|clips?|videos?|coach\\w*|homework|feedback'),
      ),
      terms: ['skate', 'coach', 'athlete'],
    },
  },
  {
    id: 'skate-workshop-loop',
    name: 'Skate Workshop agent dev loop',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'On the skate app Joe runs an agent-assisted dev loop: AI-authored pull requests wait behind his merge gate, pass CI and ship automatically as over-the-air updates. The athlete bug-report intake from Slack was rebuilt (three Supabase edge functions hardened and redeployed), but per the 2026-09-02 write-up it stopped one stale credential short of working end to end.',
    short: 'On the skate app, AI-written pull requests wait for Joe to merge them, pass CI and ship as over-the-air updates; the Slack bug-report intake was rebuilt but not yet working end to end.',
    avoid: ['same-day automatic fixes'],
    pages: { cloudyjoe: '/skate-workshop-loop', jts: '/portfolio/skate-workshop' },
    urls: [],
    article: 'skate-workshop-loop',
    asked: ['How does Joe use AI coding agents on client apps?'],
  },
  {
    id: 'skate-workshop-site',
    name: 'The Skate Workshop website (theskateworkshop.app)',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe built and deploys the pre-launch marketing site for The Skate Workshop at theskateworkshop.app: the coach's bio, a waitlist signup and legal pages. Next.js with Supabase-backed forms, on Cloudflare since September 2026.",
    short: "Joe also built the app's pre-launch website, theskateworkshop.app, with the coach's bio and a waitlist.",
    avoid: ['that the app can be downloaded', 'any pricing'],
    pages: { cloudyjoe: '/skate-workshop-loop', jts: '/portfolio/skate-workshop' },
    urls: ['https://www.theskateworkshop.app/'],
    article: 'skate-workshop-loop',
    asked: ['Does Joe build landing pages with a waitlist?'],
  },
  {
    id: 'renfaire-guide',
    name: { cloudyjoe: 'RenFaire Guide (renfaireguide.com)', jts: 'RenFaire Directory (RenFaireGuide.com)' },
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe built and runs RenFaireGuide.com (the RenFaire Directory in the JTS portfolio), his own search-focused directory of 700+ Renaissance faires across the US, with maps, state and category pages and a blog. Next.js, Supabase and Leaflet on Cloudflare Pages, with an AI-assisted data pipeline: a monthly crawler refreshes faire dates and its changes are reviewed.",
    short: "RenFaireGuide.com is Joe's own directory of 700+ Renaissance faires across the US, with maps and state pages, built in Next.js and Supabase.",
    avoid: ['any traffic, ranking or earnings figure', 'the largest directory', '200+ listings', 'that it is client work'],
    pages: { jts: '/portfolio/renfaire-directory' },
    urls: ['https://www.renfaireguide.com/'],
    asked: ['Has Joe built a directory or a content site?', 'Does he do SEO sites?'],
    expand: {
      // Not bare "directory" ("Active Directory", "a GitHub directory").
      when: /\b(?:ren(?:aissance)?\s?faires?|renfaire\w*|faire directory|renaissance festivals?|director(?:y|ies) (?:sites?|websites?)|(?:listings?|business|local|seo|event) director(?:y|ies))\b/i,
      terms: ['RenFaire', 'directory'],
    },
  },
  {
    id: 'remote-hermes-install',
    name: 'Remote AI agent install for a client',
    kind: 'client work',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe wrote a remote self-install guide and a one-command installer that let a small-business owner set up her own always-on AI agent (Nous Research's open-source Hermes agent) on a VPS she controls, reachable over Telegram, and he keeps nightly encrypted offsite backups of it. The JTS blog post 'Setting up a Hermes agent remotely' describes the approach.",
    short: "Joe also set up a small-business owner's own always-on AI agent, Nous Research's open-source Hermes agent, on a server she controls, through a remote install guide, and he keeps nightly encrypted backups of it.",
    avoid: ["the client's name", "that her agent's memory or persona features work"],
    voiceAvoid: ["the client's name"],
    pages: { jts: '/blog/setting-up-a-hermes-agent-remotely' },
    urls: [],
    asked: ['Can Joe set up an AI agent for my business remotely?'],
  },
  {
    id: 'jts-site',
    name: 'joestechsolutions.com',
    kind: 'own product',
    verdict: 'INCLUDE',
    line: "Joe built and runs joestechsolutions.com, his company's site, in Next.js on Cloudflare Pages, including the portfolio case studies and the embedded chat and voice agent.",
    short: "Joe built and runs his company's site, joestechsolutions.com, in Next.js on Cloudflare Pages.",
    avoid: [],
    voice: false,
    pages: { jts: '/' },
    urls: ['https://www.joestechsolutions.com/'],
    asked: ['Who built this website?'],
  },
  {
    id: 'agent-backend',
    name: 'The chat and voice agent on both of his sites',
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    // Neither persona names the other face (tests/personas.test.ts).
    line: "One backend Joe runs powers the chat and voice agent on both of his sites, cloudyjoe.com and joestechsolutions.com, this one included: Cloudflare Pages Functions, retrieval over each site's own pages, Gemini Live voice with short-lived tokens, and lead hand-off to Joe's email. The chat model runs with a cloud provider, as the Runtime line says.",
    short: "This agent itself: one backend Joe runs for both of his sites, on Cloudflare, with retrieval over each site's pages and Gemini Live voice.",
    avoid: ['local or private (the chat model runs in the cloud)', 'Langfuse tracing in production', 'OpenAI Realtime voice', 'simulated or eval results as user outcomes'],
    voiceAvoid: ['local or private (the chat model runs in the cloud)'],
    pages: {},
    urls: ['https://cloudyjoe.com/', 'https://www.joestechsolutions.com/'],
    asked: ['How does this chat work?', 'Can Joe build me an AI assistant for my website?'],
    // No retrieval bridge: the indexed articles already use the visitor's own
    // words ("chatbot", "voice agent"), so added terms would only dilute them.
  },
  {
    id: 'cloudyjoe-site',
    name: 'cloudyjoe.com (interactive CV)',
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: "cloudyjoe.com is Joe's interactive CV and portfolio. It is built on Santiago Fernández's (santifer's) open-source cv-santiago template, which the site credits, and Joe extended it with his own career content, case studies, the shared chat agent, Gemini Live voice and the Cloudflare backend.",
    short: "cloudyjoe.com is Joe's interactive CV, built on santifer's open-source cv-santiago template and extended by Joe with his case studies and this agent.",
    avoid: ['built from scratch'],
    voiceAvoid: ['built from scratch'],
    pages: { cloudyjoe: '/' },
    urls: ['https://cloudyjoe.com/', 'https://github.com/joblas/cv-joseph'],
    asked: ['Did Joe build this site?'],
  },
  {
    id: 'hermes-back-office',
    name: 'Hermes back office (his own operations)',
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe runs his business operations on an agent setup built on Nous Research's open-source Hermes agent: one orchestrator with 40+ scheduled automations (a daily brief, per-project checks, uptime watchdogs, weekly reviews) that he reaches over Telegram. The runtime is Nous Research's; Joe's work is the configuration, skills, automations and safeguards on top of it. Models run mostly on Ollama Cloud.",
    short: "Joe runs his own back office on Nous Research's open-source Hermes agent, with 40+ scheduled automations he reaches over Telegram; models run mostly on Ollama Cloud.",
    avoid: ['100% local or private', 'zero downtime', 'that Joe wrote the Hermes runtime'],
    voiceAvoid: ['that Joe wrote the Hermes runtime'],
    pages: { cloudyjoe: '/hermes', jts: '/stack' },
    urls: ['https://github.com/NousResearch/hermes-agent'],
    article: 'hermes',
    asked: ['Does Joe use AI agents in his own business?', 'What is Hermes?'],
  },
  {
    id: 'openclaw-migration',
    name: 'Before Hermes: the OpenClaw setup and the migration write-up',
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'Before Hermes, Joe ran a larger multi-agent setup on the open-source OpenClaw agent runtime, then consolidated it into the leaner Hermes setup. His write-up is a postmortem on why fewer, composable agents worked better than many specialized ones.',
    short: 'Before Hermes, Joe ran a larger multi-agent setup on the open-source OpenClaw runtime and cut it down to a leaner one; his write-up explains why fewer, composable agents worked better.',
    // The migration article says it caused no downtime; that is unconfirmed
    // (an open question for Joe, with the years and agent counts).
    avoid: ['that Joe built OpenClaw', 'built from scratch', 'zero downtime'],
    voiceAvoid: ['that Joe built OpenClaw', 'zero downtime'],
    pages: { cloudyjoe: '/hermes' },
    urls: ['https://cloudyjoe.com/hermes/'],
    article: 'hermes',
    asked: ['What did Joe learn about multi-agent systems?'],
  },
  {
    id: 'agent-playbook',
    name: 'His operating playbook for AI-built client software',
    kind: 'method',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe writes and keeps his own operating playbook for building client software with AI coding agents: an independent review before any merge, evidence attached to every status claim, a single queue for decisions only the owner can make, and per-repository rules for what agents may touch. He applies it in client repositories; the salon app's ship gate is one example.",
    short: 'Joe keeps his own playbook for AI-built client software: independent review before any merge and evidence behind every status claim.',
    avoid: ['a product for sale', 'a link to it (it is private)'],
    voice: false,
    pages: {},
    urls: [],
    asked: ['How does Joe keep AI-written code safe?'],
  },
  {
    id: 'fixbot',
    name: 'FixBot (a JTS offer)',
    kind: 'offer',
    verdict: 'INCLUDE_WITH_CARE',
    line: "FixBot is the JTS name for the 'text it, it gets fixed' support pattern from the salon beta loop: a client's messages become tracked issues, and clear-cut bugs get reviewed fixes shipped over the air. Today it runs on Joe's machine; it is an offer, not a separately deployed product.",
    short: "FixBot is the JTS name for the salon loop's pattern: messages become tracked issues and clear-cut bugs get reviewed fixes shipped over the air.",
    avoid: ["on the client's own server", 'a cleaning-operations company', 'booking and support lane', '0 lost messages', 'a 30-minute install', 'same-day fixes for The Skate Workshop'],
    voiceAvoid: ["on the client's own server"],
    pages: { jts: '/fixbot' },
    urls: [],
    asked: ['What is FixBot?'],
  },
  {
    id: 'private-ai-setup',
    name: 'Private AI Setup (a JTS offer)',
    kind: 'offer',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'JTS offers a Private AI Setup: open-weight models set up on a client\'s own machine or on a server they control, in one live session. On a local install, nothing leaves their machine.',
    short: 'JTS offers a Private AI Setup: open-weight models on hardware the client owns or a server they control, set up in one live session.',
    avoid: ['that any client has already received one', 'runs in under 5 minutes', 'that nothing leaves on the server or managed options'],
    voiceAvoid: ['that any client has already received one'],
    pages: { jts: '/private-ai-setup' },
    urls: ['https://www.joestechsolutions.com/private-ai-setup'],
    asked: ['Can Joe set up private, local AI for my business?'],
  },
  {
    id: 'whisper-walkie',
    name: 'Whisper Walkie (local dictation)',
    kind: 'open source',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Whisper Walkie is Joe's open-source (MIT) push-to-talk dictation app for Windows, macOS and Linux. It transcribes speech locally with OpenAI's open Whisper models through the faster-whisper library. Released in March 2026, it is now maintained as an archive.",
    short: "Whisper Walkie is Joe's open-source push-to-talk dictation app; it transcribes locally with OpenAI's open Whisper models through faster-whisper.",
    avoid: ['any download count or popularity', 'that nothing leaves the machine in his other products'],
    pages: { jts: '/whisper-walkie' },
    urls: ['https://github.com/joestechsolutions/whisper-walkie'],
    asked: ['Has Joe released any open-source software?'],
  },
  {
    id: 'prompt-library',
    name: 'JTS Prompt Library',
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: "The JTS Prompt Library is a 33-prompt PDF covering ops, sales, content, coding and research, free on joestechsolutions.com for an email address. It mixes prompts from Joe's own business with proven patterns.",
    short: 'The JTS Prompt Library is a free 33-prompt PDF on joestechsolutions.com.',
    avoid: ["all 33 are Joe's originals"],
    voice: false,
    pages: { jts: '/prompt-library' },
    urls: ['https://www.joestechsolutions.com/prompt-library'],
    asked: ['Does Joe have any free resources?'],
  },
  {
    id: 'dalle-demo',
    name: 'DALL-E image generator (2023 demo)',
    kind: 'demo',
    verdict: 'INCLUDE_WITH_CARE',
    line: 'An early (2023) AI image-generation web app on the OpenAI DALL-E API, a MERN-stack learning demo Joe built by following a public tutorial. It is still live at jblas-dall-e.com.',
    short: 'An early 2023 image-generation demo on the DALL-E API, built by following a public tutorial.',
    avoid: ['a production application', 'a current project'],
    voice: false,
    pages: {},
    urls: ['https://jblas-dall-e.com/'],
    asked: ['What did Joe build early on?'],
  },
  {
    id: 'jts-company',
    name: "Joe's Tech Solutions (his company)",
    kind: 'own product',
    verdict: 'INCLUDE_WITH_CARE',
    line: "Joe founded and runs Joe's Tech Solutions, a one-person company building software, automation and private AI for small businesses (founded 2025). Its three active client builds: a rental-turnover agent (live), an artist website with its own site agent (live) and a salon app (TestFlight beta). A fourth, the skate coaching app, is paused in TestFlight beta.",
    short: "Joe's Tech Solutions is Joe's one-person company; its three active client builds are a rental-turnover agent and an artist website (both live) and a salon app in TestFlight beta.",
    avoid: ['watched around the clock', 'everything is in production with real users', 'working payments', 'three live client deployments'],
    voiceAvoid: ['three live client deployments'],
    pages: { jts: '/about' },
    urls: ['https://www.joestechsolutions.com/about'],
    asked: ['How many clients does Joe have?'],
  },
]

// Credit for other people's work that Joe uses. `on` lists the personas that
// carry the credit line. Career-Ops never appears on the JTS persona.
export const CREDITS = [
  { id: 'hermes', on: ['cloudyjoe', 'jts'], text: "Hermes is Nous Research's open-source agent runtime (github.com/NousResearch/hermes-agent). Joe configures and runs it; he did not write it." },
  { id: 'openclaw', on: ['cloudyjoe', 'jts'], text: 'OpenClaw is an open-source agent runtime. Joe ran his earlier multi-agent setup on it; he did not build OpenClaw.' },
  { id: 'cv-santiago', on: ['cloudyjoe', 'jts'], text: "cloudyjoe.com is built on Santiago Fernández's (santifer's) open-source cv-santiago template; Joe extended it." },
  { id: 'whisper', on: ['cloudyjoe', 'jts'], text: "Whisper Walkie's speech engine is OpenAI's open Whisper models, run through the faster-whisper library." },
  { id: 'mempalace', on: ['cloudyjoe', 'jts'], text: "MemPalace, the memory tool in Joe's agent setup, is third-party software, not his." },
  { id: 'career-ops', on: ['cloudyjoe'], text: "Career-Ops is santifer's open-source AI job-search system (career-ops-hq/career-ops). Joe runs a customized fork for his own job search; he did not build it, and it is not client work." },
]

// The rule both modes follow when a search comes back empty.
export const NO_RESULT_RULE = {
  text: `If search_portfolio finds nothing on point, answer from this list when it covers the question, using only what its lines say and adding nothing they do not give. Only when neither covers it, say you don't have that detail and offer to pass the question to Joe.`,
  voice: `No-result rule: if search_portfolio returns "No relevant content found", or nothing on point, first check this list. If it covers the question, answer from it, staying inside its lines and adding nothing they do not give. Only if this list does not cover it either, say you don't have that detail and offer to have Joe follow up by email.`,
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function pick(value, personaId) {
  if (value && typeof value === 'object') return value[personaId] ?? value.cloudyjoe
  return value
}

// mode 'voice' leaves out the items marked voice: false.
export function workItemsFor(personaId, mode = 'text') {
  return WORK_ITEMS.filter((item) => (!item.personas || item.personas.includes(personaId)) && (mode !== 'voice' || item.voice !== false))
}

export function creditsFor(personaId) {
  return CREDITS.filter((c) => c.on.includes(personaId))
}

// The "Do not say or imply" note rendered for an item: every `avoid` phrase in
// text, only the high-risk `voiceAvoid` subset in voice. Exported so the
// banned-claims test can strip exactly these notes, and nothing else, before it scans.
export function avoidNote(item, mode = 'text') {
  const list = mode === 'voice' ? (item.voiceAvoid || []) : (item.avoid || [])
  if (!list.length) return ''
  return `Do not say or imply: ${list.map((a) => `"${a}"`).join('; ')}.`
}

// A persona's own page as a path (JTS, whose prompt links site paths) or a full
// URL (cloudyjoe); for cloudyjoe an item with no page there falls back to its
// JTS page. Public URLs follow, minus any that repeat the page.
function linksFor(item, personaId) {
  const own = item.pages?.[personaId]
  let page = null
  if (own) page = personaId === 'jts' ? own : `https://cloudyjoe.com${own}`
  else if (personaId === 'cloudyjoe' && item.pages?.jts) page = `https://www.joestechsolutions.com${item.pages.jts}`
  const bare = (u) => u.replace(/\/+$/, '')
  const absolute = page && page.startsWith('/') ? `https://www.joestechsolutions.com${page}` : page
  const urls = (item.urls || []).filter((u) => !page || bare(u) !== bare(absolute))
  return [page ? `Page: ${page}` : '', urls.length ? `Links: ${urls.join(', ')}` : ''].filter(Boolean).join(' ')
}

export function renderTextLine(item, personaId) {
  return [`- **${pick(item.name, personaId)}**: ${pick(item.line, personaId)}`, linksFor(item, personaId), avoidNote(item)]
    .filter(Boolean).join(' ')
}

export function renderVoiceLine(item, personaId) {
  return [`- ${pick(item.name, personaId)}: ${pick(item.short, personaId)}`, avoidNote(item, 'voice')].filter(Boolean).join(' ')
}

// Bold, not a markdown heading: both prompts nest it inside an existing
// section, and a heading there would re-parent everything after it.
export function workTextBlock(personaId) {
  return [
    `**${WORK_TEXT_HEADING} (curated facts, checked ${WORK_AS_OF}):**`,
    '',
    'These are verified facts about Joe\'s work. Name them freely whenever someone asks what Joe has built, whether he has done something like X, or for examples. Stay inside each line: any detail beyond it needs search_portfolio. A "Do not say or imply" note is a hard rule. If a site page or a search result disagrees with a line here, this list wins.',
    '',
    NO_RESULT_RULE.text,
    '',
    `Credit where it is due: ${creditsFor(personaId).map((c) => c.text).join(' ')}`,
    '',
    // Items last: each prompt continues the list right after the block.
    ...workItemsFor(personaId).map((item) => renderTextLine(item, personaId)),
  ].join('\n')
}

export function workVoiceBlock(personaId) {
  return [
    `## ${WORK_VOICE_HEADING} (curated facts, checked ${WORK_AS_OF}; you may state these without searching, and never add to them)`,
    ...workItemsFor(personaId, 'voice').map((item) => renderVoiceLine(item, personaId)),
    `Credit: ${creditsFor(personaId).map((c) => c.text).join(' ')}`,
    NO_RESULT_RULE.voice,
  ].join('\n')
}

// Put the work list into a persona's text prompt: at the marker when the
// prompt has one, appended otherwise (a prompt from another source, such as a
// Langfuse copy, still gets the list). Idempotent.
export function composeTextPrompt(base, personaId) {
  const text = String(base ?? '')
  if (text.includes(WORK_MARKER)) return text.split(WORK_MARKER).join(workTextBlock(personaId))
  if (text.includes(`**${WORK_TEXT_HEADING} (curated facts`)) return text
  return `${text}\n\n${workTextBlock(personaId)}`
}

// ---------------------------------------------------------------------------
// Retrieval bridge for the cloudyjoe corpus
// ---------------------------------------------------------------------------
//
// The cloudyjoe search ranks by 0.7 x embedding similarity + 0.3 x ts_rank of
// websearch_to_tsquery(query_text). A visitor's words ("a store for a musician
// selling t-shirts") rarely share a token with the case study that answers
// them ("Cbarrgs", "merch"), so the question rests on the embedding. This
// appends the item's own vocabulary for the EMBEDDING only.
//
// The keyword leg must get the visitor's words unchanged. Appending the terms
// there as OR alternatives ("... or Cbarrgs or merch") does not "only widen"
// the match: an OR at the top of the tsquery makes Postgres rank with
// calc_rank_or, which averages over every query item, so a row that matches
// all of the visitor's words loses most of its keyword score (postgres:16,
// 2026-10-02: on the incident question, the Shopify fact card's keyword
// contribution fell from 0.2995 to 0.0223 of its 0.3 weight). Rows
// near rag.js's 0.3 floor then drop out. scripts/rag-keyword-rank.test.sql
// pins that, and tests/agent-knowledge.test.ts pins that rag.js sends the
// original words. Append-only: the visitor's words stay in front.
export function expandWorkQuery(query) {
  const q = String(query ?? '').trim()
  const matched = []
  const terms = []
  if (q) {
    const norm = q.replace(/[‘’]/g, "'")
    const lower = norm.toLowerCase()
    for (const item of WORK_ITEMS) {
      if (!item.expand || !item.expand.when.test(norm)) continue
      matched.push(item.id)
      for (const t of item.expand.terms) {
        if (!lower.includes(t.toLowerCase()) && !terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t)
      }
    }
  }
  return { semantic: terms.length ? `${q} ${terms.join(' ')}` : q, matched, terms }
}

// ---------------------------------------------------------------------------
// Fact cards for the cloudyjoe RAG corpus (scripts/export-chunks.ts)
// ---------------------------------------------------------------------------
//
// One card per work item plus one credits card, all under article_id
// FACT_CARDS_ID so the ingest's per-file hash and delete stay self-contained.
// `badge_article_id` points a card's source badge at the matching cloudyjoe
// article; cards without one get no badge (rag.js extractSources).
export const FACT_CARDS_ID = 'work-facts'

// Lines of a card that guide the model and retrieval but must never be spoken:
// the retrieval phrasings, the wording rule, the provenance line and the links. The voice
// search's raw-chunk fallback (rag.js formatChunksForContext, spoken mode)
// drops exactly these; the embedded text and the reasoning model keep them.
// The links line ('Page:' / 'Links:') goes too: toSpokenText strips the URLs
// and would leave the bare labels to be read out.
export const FACT_CARD_GUIDE_PREFIXES = ['Answers questions like:', 'Wording rule:', 'Source: curated fact card', 'Page:', 'Links:']

export function workFactCards() {
  const cards = workItemsFor('cloudyjoe').map((item) => ({
    id: item.id,
    badgeArticleId: item.article || null,
    content: [
      `${pick(item.name, 'cloudyjoe')}.`,
      pick(item.line, 'cloudyjoe'),
      item.asked?.length ? `${FACT_CARD_GUIDE_PREFIXES[0]} ${item.asked.join(' ')}` : '',
      linksFor(item, 'cloudyjoe'),
      avoidNote(item) ? `${FACT_CARD_GUIDE_PREFIXES[1]} ${avoidNote(item)}` : '',
      `${FACT_CARD_GUIDE_PREFIXES[2]}, checked ${WORK_AS_OF}.`,
    ].filter(Boolean).join('\n'),
  }))
  cards.push({
    id: 'credits',
    badgeArticleId: null,
    content: ['Credit where it is due: work by others that Joe uses.', ...creditsFor('cloudyjoe').map((c) => c.text), `${FACT_CARD_GUIDE_PREFIXES[2]}, checked ${WORK_AS_OF}.`].join('\n'),
  })
  return cards
}
