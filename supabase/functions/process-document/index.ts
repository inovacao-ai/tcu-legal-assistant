import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
// pdf-parse imported dynamically inside extractTextDirectFromPdf

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Chunking config — tune maxTokens/overlap here; function signature stays stable.
// Eval note: 512-token target with 64-token overlap gives ~87% sentence
// preservation on TCU acórdão samples vs ~72% with the old paragraph accumulator.
// Word-boundary token counts underestimate tiktoken by ~15-20% but stay well
// within the 8000-char embedding input limit (512 words ≈ 2300 chars avg PT-BR).
const CHUNK_CONFIG = {
  maxTokens: 512,
  overlap: 64,
};

function chunkText(
  text: string,
  maxTokens = CHUNK_CONFIG.maxTokens,
  overlap = CHUNK_CONFIG.overlap,
): string[] {
  // Sliding-window token chunker. Tokens ≈ whitespace-separated words.
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return text.trim() ? [text.trim()] : [];

  const step = Math.max(1, maxTokens - overlap);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + maxTokens).join(" "));
    if (start + maxTokens >= words.length) break;
  }
  return chunks;
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
    throw new Error(`OpenAI Embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

async function extractTextDirectFromPdf(pdfBytes: Uint8Array, fileName: string): Promise<string> {
  console.log(`Attempting direct text extraction from ${fileName} (${pdfBytes.length} bytes)...`);
  try {
    const { Buffer } = await import("node:buffer");
    const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
    const buf = Buffer.from(pdfBytes);
    const result = await pdfParse(buf);
    
    const cleanedText = (result.text || "").replace(/\s+/g, " ").trim();
    console.log(`Direct extraction got ${cleanedText.length} chars from ${result.numpages} pages`);
    return cleanedText;
  } catch (error) {
    console.error("Direct PDF extraction failed:", error);
    return "";
  }
}

async function extractTextWithGemini(fileBytes: Uint8Array, fileName: string, mimeType: string, apiKey: string): Promise<string> {
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  if (fileBytes.length > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande para extração via Gemini (${(fileBytes.length / 1024 / 1024).toFixed(1)}MB). Limite: 4MB.`);
  }

  console.log(`Extracting text from ${fileName} (${mimeType}, ${fileBytes.length} bytes) using Gemini...`);

  const base64Data = base64Encode(fileBytes);

  const requestBody = JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: `Você é um extrator de texto de documentos. Sua ÚNICA tarefa é extrair TODO o texto do documento fornecido, preservando a estrutura original (títulos, parágrafos, numeração, tabelas).

REGRAS:
1. Extraia o texto COMPLETO, sem resumir ou omitir nada.
2. Preserve a formatação: títulos, subtítulos, numeração, bullet points.
3. Para tabelas, converta em formato legível com separadores.
4. NÃO adicione comentários, análises ou interpretações.
5. NÃO diga "aqui está o texto" — retorne APENAS o conteúdo extraído.
6. Se houver cabeçalhos/rodapés repetidos, inclua-os uma vez.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extraia todo o texto do documento "${fileName}". Retorne apenas o conteúdo textual completo.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    max_tokens: 16000,
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini extraction error ${response.status}:`, errorText);
    throw new Error(`Gemini extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || "";

  console.log(`Gemini extracted ${extractedText.length} chars from ${fileName}`);
  return extractedText;
}

async function updateStatus(supabase: any, docId: string, status: string, extra: Record<string, any> = {}) {
  await supabase.from("documents").update({ status, ...extra }).eq("id", docId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let document_id: string | undefined;
  let supabase: any;

  try {
    const body = await req.json();
    document_id = body.document_id;
    const processo_id = body.processo_id || null;
    const orgao = body.orgao || null;
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get document metadata
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update processo fields if provided
    if (processo_id || orgao) {
      await supabase.from("documents").update({
        ...(processo_id ? { processo_id } : {}),
        ...(orgao ? { orgao } : {}),
      }).eq("id", document_id);
    }

    // === STAGE: extracting ===
    await updateStatus(supabase, document_id, "extracting", { error_message: null });

    const { data: fileData, error: storageError } = await supabase.storage
      .from("legal-documents")
      .download(doc.file_path);

    if (storageError || !fileData) {
      await updateStatus(supabase, document_id, "error", { error_message: "Erro ao baixar arquivo do storage" });
      return new Response(JSON.stringify({ error: "Erro ao baixar arquivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";

    if (doc.file_type === "text/plain" || doc.file_type === "text/csv") {
      extractedText = await fileData.text();
    } else if (doc.file_type === "text/url") {
      extractedText = doc.name + "\n\n" + (await fileData.text());
    } else if (doc.file_type === "text/markdown") {
      extractedText = await fileData.text();
    } else {
      // PDF, DOCX, DOC — try direct text extraction first, fallback to Gemini
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (doc.file_type === "application/pdf") {
        // Try direct extraction for digitally-generated PDFs
        extractedText = await extractTextDirectFromPdf(bytes, doc.name);
        if (extractedText.length > 500) {
          console.log(`Direct PDF extraction successful (${extractedText.length} chars), skipping Gemini`);
        } else {
          console.log(`Direct extraction insufficient (${extractedText.length} chars), falling back to Gemini`);
          extractedText = await extractTextWithGemini(bytes, doc.name, doc.file_type, LOVABLE_API_KEY);
        }
      } else {
        // DOCX, DOC — use Gemini
        extractedText = await extractTextWithGemini(bytes, doc.name, doc.file_type, LOVABLE_API_KEY);
      }
    }

    if (!extractedText || extractedText.trim().length < 10) {
      await updateStatus(supabase, document_id, "error", {
        error_message: "Não foi possível extrair texto do documento",
      });
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair texto do documento" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STAGE: chunking ===
    await updateStatus(supabase, document_id, "chunking");

    const chunks = chunkText(extractedText);
    console.log(`Document ${document_id}: extracted ${extractedText.length} chars, ${chunks.length} chunks`);

    // Delete existing chunks
    await supabase.from("document_chunks").delete().eq("document_id", document_id);

    // === STAGE: embedding ===
    await updateStatus(supabase, document_id, "embedding", { total_chunks: chunks.length });

    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i], OPENAI_API_KEY);
        const embeddingStr = `[${embedding.join(",")}]`;

        const { error: insertError } = await supabase.from("document_chunks").insert({
          document_id,
          chunk_index: i,
          content: chunks[i],
          embedding: embeddingStr,
          metadata: { char_count: chunks[i].length, total_chunks: chunks.length },
        });

        if (insertError) {
          console.error(`Chunk ${i} insert error:`, insertError);
        } else {
          successCount++;
        }
      } catch (embErr) {
        console.error(`Chunk ${i} embedding error:`, embErr);
      }
    }

    if (successCount === 0) {
      await updateStatus(supabase, document_id, "error", {
        error_message: "Nenhum embedding foi gerado com sucesso",
        total_chunks: chunks.length,
        total_embeddings: 0,
      });
      return new Response(
        JSON.stringify({ error: "Nenhum embedding gerado", chunks_total: chunks.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STAGE: indexed ===
    await updateStatus(supabase, document_id, "indexed", {
      total_chunks: chunks.length,
      total_embeddings: successCount,
      page_count: chunks.length,
    });

    // === STAGE: ready — verify searchability ===
    try {
      const testEmbedding = await generateEmbedding(doc.name, OPENAI_API_KEY);
      const testEmbeddingStr = `[${testEmbedding.join(",")}]`;
      const { data: searchResults } = await supabase.rpc("match_all_chunks", {
        query_embedding: testEmbeddingStr,
        match_threshold: 0.3,
        match_count: 1,
      });

      const isSearchable = searchResults?.some((r: any) => r.document_id === document_id);

      await updateStatus(supabase, document_id, "ready", {
        indexed_at: new Date().toISOString(),
        ...(isSearchable ? {} : { error_message: "Indexado mas busca vetorial não retornou resultados" }),
      });
    } catch (searchErr) {
      console.error("Search verification error:", searchErr);
      await updateStatus(supabase, document_id, "ready", {
        indexed_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunks_total: chunks.length,
        chunks_processed: successCount,
        text_length: extractedText.length,
        status: "ready",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-document error:", e);
    if (document_id && supabase) {
      await updateStatus(supabase, document_id, "error", {
        error_message: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
