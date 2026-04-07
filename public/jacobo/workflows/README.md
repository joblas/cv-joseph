# Jacobo AI Agent — Production n8n Workflows

**[:gb: English](#the-system)**

> 7 real production workflows from a multi-agent AI system that handled ~90% of customer interactions for a phone repair business. Open source by default.

## The System

Jacobo is an omnichannel AI agent (WhatsApp + phone) built with n8n, orchestrating specialized sub-agents via tool calling. These workflows ran in production for 2 years at [Joe's Tech Solutions](https://cv-joseph.vercel.app/ai-agent-jacobo).

## Workflows

| File | Original Name (ES) | Description | Nodes | LLM |
|------|-------------------|-------------|-------|-----|
| `jacobo-chatbot-v2.json` | Jacobo Chatbot V2 | Central router — classifies intent, selects sub-agent, maintains 20-message memory window | 37 | GPT-4.1 |
| `subagente-citas.json` | subagenteCitas | Appointment booking — parses natural language time preferences into calendar slots via YouCanBookMe | 18 | MiniMax M2.5 |
| `presupuesto-modelo.json` | Presupuesto Modelo | Quote agent — looks up exact model + repair in Airtable, returns real price with stock status | 11 | GPT-4.1 mini |
| `hacer-pedido.json` | hacerPedido | Order creation — creates repair orders in Airtable when parts are out of stock | 3 | No LLM |
| `calculadora-santifer.json` | CalculadoraSantifer | Discount calculator — pure business logic for combo repair pricing | 3 | No LLM |
| `contactar-agente-humano.json` | contactarAgenteHumano | HITL handoff — escalates to human via Slack with conversation summary and deep-link | 5 | No LLM |
| `enviar-mensaje-wati.json` | EnviarMensajeWati | WhatsApp sender — cross-channel bridge so the voice agent can send WhatsApp messages | 3 | No LLM |

## Key Metrics

- **~90% self-service** — most interactions resolved without human intervention
- **~80h/month automated** — equivalent to a part-time employee
- **<30s response time** — from customer message to resolution
- **<€200/month** — total infrastructure cost

## How to Import into n8n

1. Open your n8n instance and go to **Workflows**
2. Click **"..."** → **"Import from file"**
3. Select any `.json` file from this folder
4. Update credentials (API keys, webhooks) with your own values

> **Note:** These workflows are sanitized — all API keys, webhook URLs, and personal data have been removed. You'll need to configure your own credentials after importing.

## Full Case Study

Read the complete architecture breakdown, prompt engineering techniques, and production learnings:

- [Jacobo AI Agent — Case Study](https://cv-joseph.vercel.app/ai-agent-jacobo)

---

## Let's Connect

[![Website](https://img.shields.io/badge/cv-joseph.vercel.app-000?style=for-the-badge&logo=safari&logoColor=white)](https://cv-joseph.vercel.app)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/joseph-blas)
[![Email](https://img.shields.io/badge/Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:blasj408@gmail.com)
