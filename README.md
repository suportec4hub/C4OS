# C4 OS — by C4HUB

**C4 OS** é o sistema operacional comercial da C4HUB: um CRM completo, multi-tenant, com WhatsApp Business, disparos em massa, funil de vendas, agente de IA e muito mais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 5 (ESM) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| IA | Claude (Anthropic) via Edge Function |
| WhatsApp | Meta WhatsApp Business API |
| Deploy | Vercel |

## Funcionalidades

- **Dashboard** — Métricas e KPIs em tempo real
- **Leads** — CRM com CRUD completo, score, status, origem
- **Funil (Pipeline)** — Kanban drag & drop com salvo automático no Supabase
- **Chat WhatsApp** — Conversas reais via WhatsApp Business API
- **Disparos** — Campanhas em massa com segmentação e agendamento
- **Follow-ups** — Agenda de atividades com prioridades
- **Relatórios** — Análise de performance comercial
- **C4 AI** — Agente de IA powered by Claude para análise de funil
- **Minha Empresa** — Configurações e integrações (WhatsApp, Meta Ads, Facebook ADS, API de Conversão, Google Analytics, Webhook)
- **Equipe / Departamentos** — Gestão de pessoas
- **Planos** — Starter e Enterprise com preços e recursos editáveis pelo admin
- **Clientes** — Gestão multi-empresa (C4HUB admin)
- **Usuários** — Criação via Supabase Edge Function com roles
- **Logs** — Auditoria completa

## Multi-tenant

Cada empresa tem seus dados isolados via Row Level Security (RLS) no PostgreSQL. Usuários só acessam dados da própria empresa.

## Configuração local

```bash
# Instalar dependências
npm install

# Copiar e preencher variáveis de ambiente
cp .env.example .env

# Iniciar dev server
npm run dev
```

Acesse em: `http://localhost:5173/C4OS/`

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

## Edge Functions (Supabase)

| Função | Descrição |
|--------|-----------|
| `criar-usuario` | Cria usuário no Supabase Auth + public.usuarios |
| `c4-ai` | Proxy para Claude API (requer secret `ANTHROPIC_API_KEY`) |
| `waba-send` | Envia mensagem via WhatsApp Business API |

Para o C4 AI funcionar, adicione o secret no Supabase:
> Project Settings → Edge Functions → Secrets → `ANTHROPIC_API_KEY`

## Deploy (Vercel)

O projeto usa `base: '/C4OS/'` e o `vercel.json` configura o roteamento para servir a SPA corretamente no caminho `/C4OS`.

```bash
npm run build
# Deploy via Vercel CLI ou GitHub integration
```

## Estrutura do projeto

```
src/
  components/     # Shell, Login, Logo, Modal, ui.jsx
  pages/          # 16 páginas (Dashboard, Leads, Pipeline, Chat, ...)
  hooks/          # useData.js (useTable, usePlanos, criarUsuario)
  lib/            # supabase.js
  constants/      # theme.js, mockData.js
public/
  logo.png        # Logo C4HUB (transparent background)
supabase/         # Configurações Supabase (referência)
```

---

**C4HUB** © 2025 — Todos os direitos reservados
