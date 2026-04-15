
-- Add processo fields to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS processo_id TEXT,
  ADD COLUMN IF NOT EXISTS orgao TEXT,
  ADD COLUMN IF NOT EXISTS numero_processo TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_processo_id ON public.documents(processo_id);

-- Create RPC for processo-filtered vector search
CREATE OR REPLACE FUNCTION public.match_chunks_by_processo(
  query_embedding extensions.vector,
  processo_id TEXT,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  document_name text,
  chunk_index integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    c.id,
    c.document_id,
    d.name AS document_name,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND d.processo_id = match_chunks_by_processo.processo_id
    AND d.user_id = auth.uid()
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
