
CREATE OR REPLACE FUNCTION public.match_acordaos(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  numero TEXT,
  ano INT,
  colegiado TEXT,
  relator TEXT,
  ementa TEXT,
  temas TEXT[],
  data_sessao DATE,
  similarity FLOAT
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    a.id, a.numero, a.ano, a.colegiado, a.relator, a.ementa, a.temas, a.data_sessao,
    1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.tcu_acordaos a
  WHERE 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  p_document_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  chunk_index INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    c.id, c.chunk_index, c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks c
  WHERE c.document_id = p_document_id
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
