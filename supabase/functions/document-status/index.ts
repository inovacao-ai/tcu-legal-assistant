import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, name, status, total_chunks, total_embeddings, indexed_at, error_message, created_at")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count actual chunks and embeddings in DB
    const { count: chunksInDb } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", document_id);

    const { count: embeddingsInDb } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", document_id)
      .not("embedding", "is", null);

    // Test searchability
    let testQueryHit = false;
    if (embeddingsInDb && embeddingsInDb > 0) {
      try {
        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (OPENAI_API_KEY) {
          const resp = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "text-embedding-3-small",
              input: doc.name.slice(0, 8000),
            }),
          });
          if (resp.ok) {
            const embData = await resp.json();
            const embedding = embData.data[0].embedding;
            const embStr = `[${embedding.join(",")}]`;
            const { data: results } = await supabase.rpc("match_all_chunks", {
              query_embedding: embStr,
              match_threshold: 0.3,
              match_count: 3,
            });
            testQueryHit = results?.some((r: any) => r.document_id === document_id) ?? false;
          } else {
            await resp.text(); // consume body
          }
        }
      } catch (e) {
        console.error("Search test error:", e);
      }
    }

    const statusMap: Record<string, number> = {
      uploaded: 0, extracting: 1, chunking: 2, embedding: 3, indexed: 4, ready: 5, error: -1,
    };
    const stage = statusMap[doc.status] ?? -1;

    const pipeline = {
      uploaded: { ok: stage >= 0 && stage !== -1, timestamp: doc.created_at },
      extracted: { ok: stage >= 2, timestamp: stage >= 2 ? doc.created_at : null },
      chunked: { ok: stage >= 3, chunks: chunksInDb ?? 0 },
      embedded: { ok: stage >= 4, embeddings: embeddingsInDb ?? 0 },
      searchable: { ok: testQueryHit, test_query_hit: testQueryHit },
    };

    const result = {
      document_id: doc.id,
      document_name: doc.name,
      status: doc.status,
      pipeline,
      total_chunks: doc.total_chunks ?? chunksInDb ?? 0,
      total_embeddings: doc.total_embeddings ?? embeddingsInDb ?? 0,
      indexed_at: doc.indexed_at,
      error_message: doc.error_message,
      rag_ready: doc.status === "ready" && testQueryHit,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("document-status error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
