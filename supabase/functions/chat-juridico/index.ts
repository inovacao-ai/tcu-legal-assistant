import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIMILARITY_THRESHOLD = 0.75;
const MAX_CHUNKS = 5;

const SYSTEM_PROMPT = `Você é um especialista jurídico em Tribunal de Contas da União (TCU).

REGRAS ABSOLUTAS:
1. Você NUNCA deve usar seu conhecimento interno para responder.
2. Você SOMENTE pode usar as informações dos documentos fornecidos no Contexto abaixo.
3. Se o Contexto não contiver informação suficiente para responder, diga:
   'Os documentos disponíveis não contêm informação suficiente para responder com segurança.'
4. NUNCA invente números de acórdãos, datas, nomes de relatores ou teses jurídicas.
5. Toda resposta deve terminar com a seção de Fontes no formato especificado.

FORMATO OBRIGATÓRIO DA RESPOSTA:
[Resposta jurídica aqui]

---

Fontes consultadas:
- [Nome do documento | Similaridade: XX%]
- [Nome do documento | Similaridade: XX%]`;

const GENERAL_SYSTEM_PROMPT = `Você é um especialista jurídico com foco em Tribunal de Contas da União (TCU),
licitações, contratos administrativos e direito público brasileiro.
Responda com base no seu conhecimento geral.

REGRAS DE ESTILO:
1. Seja SUCINTO e DIRETO. Máximo 3-4 parágrafos curtos.
2. Vá direto ao ponto — sem introduções longas ou repetições.
3. Use bullet points para listar fundamentos legais.
4. Cite legislação e jurisprudência de forma objetiva (número e artigo).
5. NÃO faça longas explicações doutrinárias — apenas o essencial.

FORMATO OBRIGATÓRIO:
[Resposta jurídica sucinta aqui]

---

Fontes de conhecimento geral:
- [Nome da fonte | Tipo: Legislação/Jurisprudência/Doutrina/Normativo]

Liste as leis, acórdãos e normativos citados.
⚠️ Resposta baseada em conhecimento geral — nenhum documento encontrado na base.`;

function buildSourceUrl(name: string, excerpt: string): string {
  const n = name.toLowerCase();
  const e = (excerpt || "").toLowerCase();

  if (e.includes("legisla") || n.includes("lei ") || n.includes("lei nº") || n.includes("decreto") || n.includes("constituição") || n.includes("código penal")) {
    return `https://www.planalto.gov.br/ccivil_03/Pesquisa/pesquisa.htm?termo=${encodeURIComponent(name)}`;
  }
  if (e.includes("jurisprud") || n.includes("acórdão") || n.includes("acordão") || n.includes("súmula") || n.includes("tcu")) {
    return `https://pesquisa.apps.tcu.gov.br/#/pesquisa/jurisprudencia?query=${encodeURIComponent(name)}`;
  }
  if (n.includes("stf") || n.includes("tema ")) {
    return `https://portal.stf.jus.br/pesquisarJurisprudencia/?query=${encodeURIComponent(name)}`;
  }
  if (e.includes("normativ") || n.includes("instrução") || n.includes("resolução") || n.includes("portaria")) {
    return `https://pesquisa.apps.tcu.gov.br/#/pesquisa/normativos?query=${encodeURIComponent(name)}`;
  }
  if (e.includes("judicial") || n.includes("processo") || n.includes("sentença")) {
    return `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(name)}`;
  }
  return `https://www.jusbrasil.com.br/busca?q=${encodeURIComponent(name)}`;
}

interface RagChunk {
  document_name: string;
  similarity: number;
  content: string;
  type: "document" | "acordao";
  id: string;
  url?: string | null;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Embedding error:", err);
    return [];
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

async function searchRAG(userQuery: string, supabase: any, openaiKey: string, processoId?: string): Promise<RagChunk[]> {
  if (!openaiKey) return [];

  const embedding = await generateEmbedding(userQuery, openaiKey);
  if (embedding.length === 0) return [];

  const embeddingStr = `[${embedding.join(",")}]`;

  // If processo_id provided, use filtered search; otherwise search all
  const chunksPromise = processoId
    ? supabase.rpc("match_chunks_by_processo", {
        query_embedding: embeddingStr,
        processo_id: processoId,
        match_threshold: 0.5,
        match_count: 10,
      })
    : supabase.rpc("match_all_chunks", {
        query_embedding: embeddingStr,
        match_threshold: 0.5,
        match_count: 10,
      });

  const [chunksResult, acordaosResult] = await Promise.all([
    chunksPromise,
    supabase.rpc("match_acordaos", {
      query_embedding: embeddingStr,
      match_threshold: 0.5,
      match_count: 10,
    }),
  ]);

  const allChunks: RagChunk[] = [];

  if (chunksResult.data?.length > 0) {
    for (const chunk of chunksResult.data) {
      allChunks.push({
        document_name: chunk.document_name,
        similarity: chunk.similarity,
        content: chunk.content,
        type: "document",
        id: chunk.id,
      });
    }
  }

  if (acordaosResult.data?.length > 0) {
    const acordaoIds = acordaosResult.data.map((ac: any) => ac.id);
    const { data: acordaoUrls } = await supabase
      .from("tcu_acordaos")
      .select("id, url_original")
      .in("id", acordaoIds);
    const urlMap = new Map((acordaoUrls || []).map((a: any) => [a.id, a.url_original]));

    for (const ac of acordaosResult.data) {
      allChunks.push({
        document_name: `Acórdão ${ac.numero}/${ac.ano} - ${ac.colegiado || "N/A"}`,
        similarity: ac.similarity,
        content: ac.ementa || "Sem ementa",
        type: "acordao",
        id: ac.id,
        url: urlMap.get(ac.id) || null,
      });
    }
  }

  const filtered = allChunks
    .filter((c) => c.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CHUNKS);

  return filtered;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, processo_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    if (!lastUserMsg) {
      return new Response(
        JSON.stringify({ error: "Nenhuma mensagem de usuário encontrada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("RAG search for:", lastUserMsg.content.slice(0, 100), processo_id ? `(processo: ${processo_id})` : "(all docs)");
    const ragChunks = await searchRAG(lastUserMsg.content, supabase, OPENAI_API_KEY, processo_id || undefined);

    console.log(`RAG results: ${ragChunks.length} chunks above threshold ${SIMILARITY_THRESHOLD}`);

    const isRagMode = ragChunks.length > 0;
    let systemPrompt: string;

    if (isRagMode) {
      const contextParts: string[] = ["CONTEXTO RECUPERADO DOS DOCUMENTOS:"];
      for (const chunk of ragChunks) {
        contextParts.push(
          `[${chunk.document_name} | Similaridade: ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.content}`
        );
      }
      systemPrompt = `${SYSTEM_PROMPT}\n\n${contextParts.join("\n\n")}`;
      console.log("Mode: RAG with", ragChunks.length, "chunks");
    } else {
      systemPrompt = GENERAL_SYSTEM_PROMPT;
      console.log("Mode: GENERAL (no chunks above threshold)");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com o serviço de IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const answer = aiResult.choices?.[0]?.message?.content || "Erro ao gerar resposta.";

    let generalSources: { document_name: string; similarity: number; excerpt: string }[] = [];
    let cleanAnswer = answer;

    if (!isRagMode) {
      const sourcesRegex = /(?:---\s*\n\s*)?(?:\*{0,2})(?:Fontes?\s*(?:de\s+conhecimento\s+geral|consultadas?|citadas?)?)\s*(?:\*{0,2})\s*:?\s*\n([\s\S]*?)(?:\n\s*⚠️|$)/i;
      const sourcesMatch = answer.match(sourcesRegex);
      if (sourcesMatch) {
        const sourceLines = sourcesMatch[1].trim().split("\n");
        for (const line of sourceLines) {
          const cleaned = line.replace(/\*\*/g, "").replace(/\*/g, "").trim();
          if (!cleaned || cleaned === "---") continue;
          
          const matchPipe = cleaned.match(/[-•*]\s*\[?\s*(.+?)\s*\|\s*(?:Tipo:\s*)?(.+?)\s*\]?\s*$/);
          if (matchPipe) {
            generalSources.push({
              document_name: matchPipe[1].trim(),
              similarity: 0,
              excerpt: matchPipe[2].trim().startsWith("Tipo:") ? matchPipe[2].trim() : `Tipo: ${matchPipe[2].trim()}`,
            });
            continue;
          }
          
          const matchSimple = cleaned.match(/[-•*]\s*\[?\s*(.+?)\s*\]?\s*$/);
          if (matchSimple && matchSimple[1].length > 3) {
            const name = matchSimple[1].trim();
            let tipo = "Fonte";
            if (/lei |decreto|código|constituição/i.test(name)) tipo = "Legislação";
            else if (/acórdão|acordão|súmula|sumula|tcu/i.test(name)) tipo = "Jurisprudência";
            else if (/instrução|resolução|portaria|normativ/i.test(name)) tipo = "Normativo";
            else if (/stf|stj|tema /i.test(name)) tipo = "Jurisprudência";
            generalSources.push({
              document_name: name,
              similarity: 0,
              excerpt: `Tipo: ${tipo}`,
            });
          }
        }
        cleanAnswer = answer
          .replace(/(?:---\s*\n\s*)?(?:\*{0,2})(?:Fontes?\s*(?:de\s+conhecimento\s+geral|consultadas?|citadas?)?)\s*(?:\*{0,2})\s*:?\s*\n[\s\S]*$/i, "")
          .replace(/\n\s*⚠️[\s\S]*$/, "")
          .trim();
      }
    }

    const structuredResponse = {
      answer: cleanAnswer,
      sources: isRagMode
        ? ragChunks.map((c) => ({
            document_name: c.document_name,
            similarity: parseFloat(c.similarity.toFixed(4)),
            excerpt: c.content.slice(0, 200),
            url: c.url || null,
          }))
        : generalSources.map((s) => ({
            ...s,
            url: buildSourceUrl(s.document_name, s.excerpt),
          })),
      rag_used: isRagMode,
      mode: isRagMode ? "rag" : "general",
      chunks_found: ragChunks.length,
      chunks_used: ragChunks.length,
      similarity_scores: isRagMode
        ? ragChunks.map((c) => parseFloat(c.similarity.toFixed(4)))
        : [],
    };

    console.log("Response mode:", structuredResponse.mode, "| chunks:", structuredResponse.chunks_used);

    return new Response(
      JSON.stringify(structuredResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("chat-juridico error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
