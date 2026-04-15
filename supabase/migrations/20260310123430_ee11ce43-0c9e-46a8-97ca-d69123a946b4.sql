
-- =============================================
-- AGENTE JURÍDICO TCU — Database Schema
-- =============================================

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization TEXT,
  role_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- DOCUMENTS
-- =============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  document_type TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  file_size BIGINT,
  page_count INT,
  risks_found INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DOCUMENT_CHUNKS (with vector embeddings)
-- =============================================
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks of own documents" ON public.document_chunks
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.documents WHERE id = document_chunks.document_id AND user_id = auth.uid())
);

CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);

-- =============================================
-- TCU_ACORDAOS
-- =============================================
CREATE TABLE public.tcu_acordaos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  ano INT NOT NULL,
  colegiado TEXT,
  relator TEXT,
  ementa TEXT,
  conteudo_completo TEXT,
  temas TEXT[],
  embedding vector(1536),
  data_sessao DATE,
  url_original TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tcu_acordaos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acordaos are publicly readable" ON public.tcu_acordaos FOR SELECT USING (true);

CREATE INDEX idx_tcu_acordaos_numero_ano ON public.tcu_acordaos(numero, ano);
CREATE INDEX idx_tcu_acordaos_temas ON public.tcu_acordaos USING GIN(temas);

-- =============================================
-- CONSULTATIONS
-- =============================================
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consultations" ON public.consultations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consultations" ON public.consultations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own consultations" ON public.consultations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own consultations" ON public.consultations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CONSULTATION_MESSAGES
-- =============================================
CREATE TABLE public.consultation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  agent_name TEXT,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of own consultations" ON public.consultation_messages
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.consultations WHERE id = consultation_messages.consultation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert messages in own consultations" ON public.consultation_messages
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.consultations WHERE id = consultation_messages.consultation_id AND user_id = auth.uid())
);

CREATE INDEX idx_consultation_messages_consultation ON public.consultation_messages(consultation_id);

-- =============================================
-- LEGAL_ANALYSIS
-- =============================================
CREATE TABLE public.legal_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL,
  summary TEXT,
  risks JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  legal_basis JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'processando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.legal_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON public.legal_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_legal_analysis_updated_at BEFORE UPDATE ON public.legal_analysis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AGENT_OUTPUTS
-- =============================================
CREATE TABLE public.agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  acordaos_referenced UUID[] DEFAULT '{}',
  processing_time_ms INT,
  status TEXT NOT NULL DEFAULT 'processando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outputs of own consultations" ON public.agent_outputs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.consultations WHERE id = agent_outputs.consultation_id AND user_id = auth.uid())
);

CREATE INDEX idx_agent_outputs_consultation ON public.agent_outputs(consultation_id);

-- =============================================
-- STORAGE BUCKET for legal documents
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('legal-documents', 'legal-documents', false);

CREATE POLICY "Users can upload own legal documents" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own legal documents" ON storage.objects
FOR SELECT USING (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own legal documents" ON storage.objects
FOR DELETE USING (bucket_id = 'legal-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- SEMANTIC SEARCH FUNCTIONS
-- =============================================
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
