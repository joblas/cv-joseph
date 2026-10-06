import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArticleLayout } from './articles/components'

// One description for the client-side meta tag and the prerendered page
// (scripts/prerender.tsx), so the two can never say different things.
export const PRIVACY_DESCRIPTION =
  'Privacy policy for cloudyjoe.com: what the chatbot and voice mode collect, which services process it, and who to contact.'

const CONTACT_EMAIL = 'blasj408@gmail.com'

const content = {
  es: {
    title: 'Politica de Privacidad',
    lastUpdated: 'Ultima actualizacion: 6 de octubre de 2026',
    intro: 'Esta politica describe que datos se recopilan cuando visitas cloudyjoe.com, para que se usan y que servicios los procesan.',
    sections: [
      {
        heading: 'Que datos se recopilan',
        items: [
          'Mensajes del chatbot: lo que escribes al chatbot "Cloudy-Joe Agent" se envia a los servicios listados abajo para generar la respuesta.',
          'Emails y solicitudes de contacto: si escribes un email en el chat, o pides contratar o contactar a Joseph, se guardan ese mensaje, tu email, la pagina en la que estabas y la conversacion (Supabase, tabla chat_leads), y se le envian por email a Joseph para que pueda responderte.',
          'Audio del modo voz: si activas el modo voz, el audio se transmite a la API Gemini Live de Google para la conversacion en tiempo real. El sitio no guarda grabaciones. Para limitar las sesiones de voz diarias se registra tu direccion IP junto con un contador.',
          'Trazas de conversacion: cada turno del chat se registra en Langfuse con un identificador de sesion, la pagina y los primeros 200 caracteres de tu ultimo mensaje.',
          'Registros del servidor: Cloudflare, que aloja el sitio, procesa los datos normales de cada peticion (como la direccion IP y el navegador) para servir las paginas.',
        ],
      },
      {
        heading: 'Como se utilizan los datos',
        items: [
          'Los mensajes del chatbot se utilizan para responder preguntas sobre el trabajo de Joseph.',
          'Las solicitudes de contacto se utilizan para que Joseph pueda responder a quien pidio hablar con el.',
          'Las trazas se utilizan para depurar y mejorar las respuestas y para detectar intentos de uso indebido.',
        ],
      },
      {
        heading: 'Terceros',
        items: [
          'Ollama Cloud: ejecuta el modelo que escribe las respuestas del chatbot.',
          'Google (Gemini Live API): procesa el audio del modo voz en tiempo real.',
          'Supabase: guarda el indice de busqueda del sitio, las solicitudes de contacto del chat y los contadores del limite de voz.',
          'Voyage AI: cuando la busqueda semantica esta activada, convierte las preguntas del chat en vectores de busqueda.',
          'Resend: entrega a Joseph el aviso por email cuando alguien pide que lo contacten.',
          'Langfuse: guarda las trazas de conversacion descritas arriba.',
          'Cloudflare: aloja el sitio web y ejecuta su API (Pages y Functions).',
        ],
      },
      {
        heading: 'Cookies y almacenamiento local',
        body: 'Este sitio no utiliza cookies de seguimiento ni de terceros, ni herramientas de analitica. El almacenamiento del navegador guarda preferencias de interfaz (tema visual, musica) y, solo en la pestana actual, la conversacion del chat (sessionStorage). Esos datos se quedan en tu dispositivo.',
      },
      {
        heading: 'No hay cuentas de usuario',
        body: 'Este sitio no requiere registro ni inicio de sesion, y nunca pide contrasenas. Solo recibe un email si tu lo escribes en el chat.',
      },
      {
        heading: 'Contacto',
        body: 'Para cualquier consulta sobre privacidad, o para pedir que se borre una solicitud de contacto, puedes escribir a:',
        email: CONTACT_EMAIL,
      },
    ],
    backHome: 'Volver al inicio',
  },
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: October 6, 2026',
    intro: 'This policy describes what data is collected when you visit cloudyjoe.com, what it is used for, and which services process it.',
    sections: [
      {
        heading: 'What data is collected',
        items: [
          'Chatbot messages: what you type to the "Cloudy-Joe Agent" chatbot is sent to the services listed below to generate an answer.',
          'Email addresses and contact requests: if you type an email address into the chat, or ask to hire or contact Joseph, that message, your email address, the page you were on and the conversation are stored (Supabase, table chat_leads) and emailed to Joseph so he can reply.',
          "Voice mode audio: if you turn on voice mode, your audio is streamed to Google's Gemini Live API for the real-time conversation. The site does not keep recordings. To cap daily voice sessions, your IP address is recorded with a session count.",
          'Conversation traces: each chat turn is logged to Langfuse with a session ID, the page, and the first 200 characters of your latest message.',
          'Server logs: Cloudflare, which hosts the site, processes standard request data (such as IP address and browser) to serve pages.',
        ],
      },
      {
        heading: 'How data is used',
        items: [
          "Chatbot messages are used to answer questions about Joseph's work.",
          'Contact requests are used so Joseph can reply to people who asked to hear from him.',
          'Traces are used to debug and improve answers and to detect misuse attempts.',
        ],
      },
      {
        heading: 'Third parties',
        items: [
          "Ollama Cloud: runs the model that writes the chatbot's answers.",
          'Google (Gemini Live API): processes voice mode audio in real time.',
          "Supabase: stores the site's search index, contact requests from the chat, and voice rate-limit counts.",
          'Voyage AI: when semantic search is switched on, turns chat questions into search vectors.',
          'Resend: delivers the email notice to Joseph when someone asks to be contacted.',
          'Langfuse: stores the conversation traces described above.',
          'Cloudflare: hosts the website and runs its API (Pages and Functions).',
        ],
      },
      {
        heading: 'Cookies and local storage',
        body: 'This site does not use tracking cookies, third-party cookies, or analytics tools. Browser storage keeps interface preferences (visual theme, music) and, for the current tab only, the chat conversation (sessionStorage). That data stays on your device.',
      },
      {
        heading: 'No user accounts',
        body: 'This site does not require registration or login and never asks for a password. It only receives an email address if you type one into the chat.',
      },
      {
        heading: 'Contact',
        body: 'For any privacy-related inquiries, or to ask for a contact request to be deleted, you can write to:',
        email: CONTACT_EMAIL,
      },
    ],
    backHome: 'Back to home',
  },
} as const

interface PrivacySection {
  heading: string
  items?: readonly string[]
  body?: string
  email?: string
}

export default function PrivacyPolicy() {
  const t = content.en

  useEffect(() => {
    document.title = `${t.title} | cloudyjoe.com`

    // noindex
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = 'noindex, nofollow'

    // Fix canonical (SPA fallback serves homepage canonical — override it)
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (canonical) canonical.href = `https://cloudyjoe.com/${'privacy'}`

    // Fix meta description
    let desc = document.querySelector('meta[name="description"]') as HTMLMetaElement
    if (desc) desc.content = PRIVACY_DESCRIPTION

    return () => {
      robots.content = 'index, follow'
    }
  }, [t.title])

  return (
    <ArticleLayout>
      <header className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.lastUpdated}</p>
      </header>

      <article className="prose-custom">
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
          {t.intro}
        </p>

        {(t.sections as readonly PrivacySection[]).map((section, i) => (
          <section key={i} className="mb-8">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">
              {section.heading}
            </h2>

            {section.items && (
              <ul className="space-y-2 mb-4">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-base text-muted-foreground">
                    <span className="text-primary font-bold shrink-0 mt-0.5">{'●'}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.body && (
              <p className="text-base text-muted-foreground leading-relaxed">
                {section.body}
              </p>
            )}

            {section.email && (
              <p className="mt-2">
                <a
                  href={`mailto:${section.email}`}
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {section.email}
                </a>
              </p>
            )}
          </section>
        ))}

        <div className="mt-12 pt-8 border-t border-border">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            {'← '}{t.backHome}
          </Link>
        </div>
      </article>
    </ArticleLayout>
  )
}
