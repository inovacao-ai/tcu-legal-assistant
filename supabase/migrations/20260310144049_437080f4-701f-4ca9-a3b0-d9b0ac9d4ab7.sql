CREATE OR REPLACE FUNCTION public.match_all_chunks(
  query_embedding extensions.vector,
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
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;