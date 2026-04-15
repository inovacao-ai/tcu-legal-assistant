# TCU Legal Assistant — Análise Técnica
**Versão:** V1 · **Data:** Abril 2026  
**Origem do código:** Gerado via [Lovable](https://lovable.dev)

---

## 1. Resumo do Projeto

Sistema de assistência jurídica com IA voltado para o **Tribunal de Contas da União (TCU)**. Permite que profissionais façam consultas em linguagem natural sobre jurisprudência TCU — acórdãos, súmulas, licitações e contratos administrativos — com suporte a **RAG (Retrieval-Augmented Generation)** sobre documentos próprios do usuário, agrupados por número de processo.

---

## 2. Telas e Funcionalidades

### `/login` e `/reset-password`
Autenticação via Supabase Auth com rota protegida (`ProtectedRoute`).

### `/` — Dashboard
- Cards de métricas: consultas realizadas, documentos analisados, alertas de risco, pareceres gerados
- Lista de consultas recentes com navegação direta ao chat
- Painel lateral de alertas de risco por documento

### `/chat` e `/chat/:consultationId` — Chat Jurídico
- Chat com persistência por consulta (`consultation_messages`)
- Dois modos de operação:
  - **RAG ativo** — busca vetorial nos documentos do usuário, com indicação de chunks usados e score de similaridade
  - **Modo geral** — resposta via LLM com conhecimento próprio
- Escopo configurável: todos os documentos ou processo específico
- Painel lateral de fontes com citações clicáveis
- Renderização de Markdown nas respostas

### `/documentos` — Gestão de Documentos
- Upload de PDFs e DOCX com metadados: número do processo e órgão
- Visualização do pipeline de processamento em 5 estágios:
  `Upload → Extração → Chunks → Embeddings → RAG Pronto`
- Documentos agrupados por `processo_id`
- Reprocessamento individual ou em lote
- Exclusão de processo completo (documentos + chunks + embeddings)
- Drag-and-drop com formulário de metadados antes do envio

### `/historico` — Histórico de Consultas
- Lista de consultas anteriores com data e status
- Opção de reabrir ou excluir consultas

### `/admin` — Painel Administrativo
- Gestão de usuários (visualização, exclusão)
- Operações protegidas por role `admin` via Edge Function dedicada

---

## 3. Stack Atual

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI/Estilo** | Tailwind CSS + shadcn/ui + Radix UI |
| **State/Data** | React Query v5 + React Router v6 |
| **Markdown** | react-markdown |
| **Backend** | Supabase Edge Functions (Deno/TypeScript) |
| **Banco de dados** | PostgreSQL via Supabase + pgvector |
| **Auth** | Supabase Auth |
| **Storage** | Supabase Storage (bucket `legal-documents`) |
| **Embeddings** | OpenAI `text-embedding-3-small` |
| **LLM** | OpenAI GPT-4/GPT-4o (inferido) |
| **Origem** | Lovable (geração de código por IA) |

### Edge Functions existentes

| Função | Responsabilidade |
|---|---|
| `chat-juridico` | Busca vetorial + chamada ao LLM + modo geral |
| `process-document` | Extração de texto, chunking e geração de embeddings |
| `document-status` | Verificação de status do pipeline de indexação |
| `delete-user` | Exclusão de usuário (admin only) |

---

## 4. Problemas Críticos Identificados

### Segurança
- CORS com `"Access-Control-Allow-Origin": "*"` em todas as Edge Functions — inaceitável em produção
- A chave anon do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`) é usada diretamente em chamadas `fetch` do cliente para as Edge Functions, sem validação adicional de identidade

### Pipeline de Processamento Frágil
- `process-document` é **fire-and-forget** — o cliente dispara e não tem garantia de execução
- Sem fila, sem retry automático com backoff exponencial, sem dead letter queue
- Falhas silenciosas viram registros com `status: "error"` sem diagnóstico acionável

### Chat sem Streaming
- A resposta do LLM vem completa antes de renderizar
- Degrada a percepção de velocidade em respostas longas (comum em análises jurídicas)

### RAG Rudimentar
- Chunking por parágrafo simples (divisão por `\n\n`), sem estratégia semântica
- Threshold fixo de similaridade (`0.75`), sem reranking
- Uso de `text-embedding-3-small` — domínio jurídico exige maior precisão semântica
- `MAX_CHUNKS = 5` fixo no código, sem ajuste dinâmico por query

### Sem Observabilidade
- `console.error` puro em toda a base
- Sem logging estruturado, sem rastreamento de erros em produção
- Sem métricas de latência, custo de tokens ou taxa de sucesso do RAG

### Componentes Monolíticos
- `Documentos.tsx` com ~450 linhas misturando lógica de negócio, UI e chamadas diretas ao Supabase
- Impossível testar unitariamente no estado atual

---

## 5. Stack Proposta (Produção)

A mudança estrutural principal é **separar o backend de IA do BaaS**. O Supabase é excelente para auth, banco relacional e storage, mas Edge Functions em Deno são o lugar errado para orquestrar pipelines de LLM com processamento de PDF, chunking semântico e embedding.

### Frontend — Manter e Evoluir

```
React 18 + TypeScript + Vite      ← manter
Tailwind CSS + shadcn/ui          ← manter (excelente escolha)
React Query v5                    ← manter
Zustand                           ← adicionar: estado global (substituir useState espalhado)
SSE / EventSource                 ← adicionar: streaming no chat
Supabase Realtime                 ← adicionar: status do pipeline ao vivo
```

### Backend de IA — Novo Serviço Python

```
FastAPI (Python 3.12)             ← API REST async com tipagem forte
LangChain ou LlamaIndex           ← orquestração RAG com chunking semântico
PyMuPDF + pdfplumber              ← extração de texto com suporte a tabelas e layout
text-embedding-3-large            ← embeddings de maior precisão (dim 3072 vs 1536)
Cohere Rerank ou BGE Reranker     ← reranking antes de enviar ao LLM
GPT-4o ou Claude claude-sonnet-4-6          ← geração com streaming via SSE
Celery + Redis                    ← fila assíncrona para processamento de documentos
structlog / loguru                ← logging estruturado
Sentry                            ← rastreamento de erros em produção
```

### Infraestrutura

```
Supabase                          ← manter: Auth, PostgreSQL + pgvector, Storage
Redis                             ← adicionar: fila de jobs + cache de embeddings
Docker Compose                    ← desenvolvimento local padronizado
GitHub Actions                    ← CI/CD com testes e deploy automatizado
```

---

## 6. Estrutura Proposta do Backend

```
backend/
├── app/
│   ├── api/
│   │   ├── chat.py             # SSE streaming endpoint
│   │   └── documents.py        # upload, status, reprocessamento
│   ├── core/
│   │   ├── config.py           # pydantic-settings (env vars tipadas)
│   │   └── security.py         # validação JWT Supabase
│   ├── services/
│   │   ├── rag.py              # pipeline RAG com reranking
│   │   ├── chunker.py          # chunking semântico por sentença/parágrafo
│   │   └── embedder.py         # geração e cache de embeddings
│   ├── workers/
│   │   └── process_doc.py      # Celery task com retry e DLQ
│   └── repositories/
│       └── supabase.py         # abstração do cliente Supabase
├── tests/
│   ├── unit/
│   └── integration/
├── docker-compose.yml
└── pyproject.toml
```

---

## 7. Comparativo de Decisões

| Aspecto | Atual | Proposto | Justificativa |
|---|---|---|---|
| **Backend IA** | Deno Edge Functions | FastAPI (Python) | Ecossistema LLM nativo em Python |
| **Chunking** | Split por `\n\n` | Chunking semântico (LlamaIndex) | Maior coerência contextual |
| **Embeddings** | `text-embedding-3-small` | `text-embedding-3-large` | Maior precisão em domínio jurídico |
| **Reranking** | Nenhum | Cohere Rerank / BGE | Reduz ruído antes do LLM |
| **Chat** | Resposta completa | SSE streaming | UX muito superior |
| **Fila** | Fire-and-forget | Celery + Redis | Confiabilidade e retry |
| **Status pipeline** | Polling manual | Supabase Realtime | Atualização ao vivo sem polling |
| **Observabilidade** | `console.error` | structlog + Sentry | Diagnóstico de produção |
| **CORS** | `"*"` | Whitelist por origem | Segurança básica |

---

## 8. Plano de Migração (Incremental)

Não é necessário reescrever tudo de uma vez. O caminho menos arriscado substitui as Edge Functions uma a uma, sem quebrar o que está em produção:

**Fase 1 — Infraestrutura (sem impacto ao usuário)**
- Criar projeto FastAPI com Docker Compose
- Configurar Celery + Redis
- Implementar validação JWT do Supabase no novo backend

**Fase 2 — Pipeline de documentos (maior dor atual)**
- Substituir `process-document` Edge Function pelo worker Celery em Python
- Adicionar Supabase Realtime no frontend para status ao vivo
- Melhorar extração com PyMuPDF + chunking semântico

**Fase 3 — Chat com streaming**
- Substituir `chat-juridico` Edge Function pelo endpoint FastAPI com SSE
- Implementar reranking antes do envio ao LLM
- Migrar para `text-embedding-3-large`

**Fase 4 — Qualidade e operação**
- Refatorar componentes monolíticos do frontend
- Adicionar testes unitários e de integração
- Configurar observabilidade completa (Sentry + métricas)
- Corrigir CORS e revisar políticas de segurança

---

## 9. Por que Python para o Backend de IA?

O ecossistema Python tem vantagem estrutural para LLM. LangChain, LlamaIndex, PyMuPDF, pdfplumber, sentence-transformers e praticamente toda biblioteca de ML/NLP de referência existe nativamente em Python — matura, testada e com comunidade ativa.

Replicar isso em Deno/TypeScript é tecnicamente possível, mas significa usar wrappers incompletos, lidar com incompatibilidades de módulos e abrir mão de anos de maturidade do ecossistema de PLN em Python. Para um produto cujo diferencial competitivo **é** a qualidade do RAG jurídico, essa escolha de stack tem impacto direto na entrega de valor.

---

*Análise gerada em 15/04/2026 · TCU Legal Assistant V1*
