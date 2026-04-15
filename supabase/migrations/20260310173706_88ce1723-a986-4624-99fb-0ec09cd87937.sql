
CREATE OR REPLACE VIEW public.document_pipeline_status 
WITH (security_invoker = true) AS
SELECT 
  d.id,
  d.name,
  d.status,
  d.total_chunks,
  d.total_embeddings,
  d.indexed_at,
  d.error_message,
  d.user_id,
  d.created_at,
  d.file_size,
  d.document_type,
  COUNT(dc.id) AS chunks_in_db,
  COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) AS embeddings_in_db,
  CASE 
    WHEN COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) > 0 THEN true 
    ELSE false 
  END AS has_embeddings,
  CASE
    WHEN d.status = 'ready' AND COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) > 0 THEN true
    ELSE false
  END AS rag_ready
FROM public.documents d
LEFT JOIN public.document_chunks dc ON dc.document_id = d.id
GROUP BY d.id, d.name, d.status, d.total_chunks, 
         d.total_embeddings, d.indexed_at, d.error_message,
         d.user_id, d.created_at, d.file_size, d.document_type;
