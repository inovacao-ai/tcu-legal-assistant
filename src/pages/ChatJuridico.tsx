import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Send, Loader2, Bot, User, ShieldCheck, Globe, Database, Filter } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ragMeta?: RagMeta;
}

interface RagMeta {
  rag_used: boolean;
  mode?: "rag" | "general";
  sources: { document_name: string; similarity: number; excerpt: string; url?: string | null }[];
  chunks_found?: number;
  chunks_used?: number;
  similarity_scores?: number[];
}

interface Source {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  reference: string;
  url?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-juridico`;

function stripSourcesFromContent(content: string): string {
  return content
    .replace(/\n---\s*\n\s*Fontes de conhecimento geral:[\s\S]*/i, "")
    .replace(/\n---\s*\n\s*Fontes consultadas:[\s\S]*/i, "")
    .replace(/\n\s*Fontes de conhecimento geral:[\s\S]*/i, "")
    .replace(/\n\s*Fontes consultadas:[\s\S]*/i, "")
    .replace(/\n\s*⚠️\s*Resposta baseada em conhecimento geral[\s\S]*/i, "")
    .trim();
}

async function sendChat(
  messages: { role: string; content: string }[],
  processoId?: string
): Promise<{
  answer: string;
  sources: { document_name: string; similarity: number; excerpt: string }[];
  rag_used: boolean;
  mode?: "rag" | "general";
  chunks_found?: number;
  chunks_used?: number;
  similarity_scores?: number[];
  error?: string;
}> {
  const body: any = { messages };
  if (processoId) body.processo_id = processoId;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || "Erro ao processar sua mensagem.");
  }

  return data;
}

const ChatJuridico = () => {
  const { session } = useAuth();
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(consultationId || null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Processo scope
  const [scopeMode, setScopeMode] = useState<"all" | "processo">("all");
  const [selectedProcessoId, setSelectedProcessoId] = useState<string>("");
  const [processos, setProcessos] = useState<{ processo_id: string; count: number }[]>([]);

  // Load available processos
  useEffect(() => {
    if (!session?.user?.id) return;
    const loadProcessos = async () => {
      const { data } = await supabase
        .from("documents")
        .select("processo_id")
        .eq("user_id", session.user.id)
        .not("processo_id", "is", null);

      if (data) {
        const countMap: Record<string, number> = {};
        for (const d of data) {
          if (d.processo_id) {
            countMap[d.processo_id] = (countMap[d.processo_id] || 0) + 1;
          }
        }
        setProcessos(
          Object.entries(countMap).map(([processo_id, count]) => ({ processo_id, count }))
        );
      }
    };
    loadProcessos();
  }, [session?.user?.id]);

  // Load existing consultation messages
  useEffect(() => {
    if (!consultationId) {
      setMessages([]);
      setCurrentConsultationId(null);
      return;
    }
    setCurrentConsultationId(consultationId);

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("consultation_messages")
        .select("*")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        return;
      }

      if (data) {
        setMessages(
          data.map((m) => {
            let ragMeta: RagMeta | undefined;
            if (m.role === "assistant" && m.citations) {
              const c = m.citations as any;
              if (typeof c === "object" && "rag_used" in c) {
                ragMeta = {
                  rag_used: c.rag_used,
                  mode: c.mode || (c.rag_used ? "rag" : "general"),
                  sources: c.sources || [],
                  chunks_found: c.chunks_found,
                  chunks_used: c.chunks_used,
                  similarity_scores: c.similarity_scores,
                };
              }
            }
            return {
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              ragMeta,
            };
          })
        );
      }
    };

    loadMessages();
  }, [consultationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const panelSources: Source[] = (() => {
    const targetMsg = selectedMessageId
      ? messages.find((m) => m.id === selectedMessageId)
      : [...messages].reverse().find((m) => m.role === "assistant");
    if (!targetMsg?.ragMeta?.sources?.length) return [];
    const isGeneral = targetMsg.ragMeta.mode === "general";
    return targetMsg.ragMeta.sources.map((s, i) => ({
      id: `src-${i}`,
      type: isGeneral ? s.excerpt || "Conhecimento Geral" : "Documento",
      title: s.document_name,
      excerpt: isGeneral ? "Fonte de conhecimento geral da IA" : s.excerpt,
      reference: isGeneral ? "Conhecimento Geral" : `Similaridade: ${(s.similarity * 100).toFixed(1)}%`,
      url: s.url || undefined,
    }));
  })();

  const saveMessage = useCallback(async (cId: string, role: string, content: string, citations?: any) => {
    await supabase.from("consultation_messages").insert({
      consultation_id: cId,
      role,
      content,
      citations: citations || null,
    });
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !session?.user?.id) return;

    const userContent = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let cId = currentConsultationId;
    if (!cId) {
      const title = userContent.length > 60 ? userContent.slice(0, 60) + "..." : userContent;
      const { data, error } = await supabase
        .from("consultations")
        .insert({ title, user_id: session.user.id })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Erro ao criar consulta.");
        setIsLoading(false);
        return;
      }
      cId = data.id;
      setCurrentConsultationId(cId);
      navigate(`/chat/${cId}`, { replace: true });
    }

    await saveMessage(cId, "user", userContent);

    try {
      const processoId = scopeMode === "processo" && selectedProcessoId ? selectedProcessoId : undefined;
      const result = await sendChat(
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        processoId
      );

      const ragMeta: RagMeta = {
        rag_used: result.rag_used,
        mode: result.mode || (result.rag_used ? "rag" : "general"),
        sources: result.sources || [],
        chunks_found: result.chunks_found,
        chunks_used: result.chunks_used,
        similarity_scores: result.similarity_scores,
      };

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        ragMeta,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSelectedMessageId(assistantMsg.id);
      await saveMessage(cId, "assistant", result.answer, {
        rag_used: result.rag_used,
        mode: result.mode,
        sources: result.sources,
        chunks_found: result.chunks_found,
        chunks_used: result.chunks_used,
        similarity_scores: result.similarity_scores,
      });

      setIsLoading(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro de conexão. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <AppLayout sources={panelSources}>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 glass">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-slab text-lg font-bold">Chat Jurídico</h1>
              <p className="text-xs text-muted-foreground">
                Faça perguntas sobre jurisprudência, acórdãos e decisões do TCU.
              </p>
            </div>
            {/* Scope selector */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <Select
                value={scopeMode}
                onValueChange={(v) => {
                  setScopeMode(v as "all" | "processo");
                  if (v === "all") setSelectedProcessoId("");
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Escopo da consulta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os documentos</SelectItem>
                  <SelectItem value="processo">Processo específico</SelectItem>
                </SelectContent>
              </Select>

              {scopeMode === "processo" && (
                <Select value={selectedProcessoId} onValueChange={setSelectedProcessoId}>
                  <SelectTrigger className="w-[220px] h-8 text-xs">
                    <SelectValue placeholder="Selecione o processo" />
                  </SelectTrigger>
                  <SelectContent>
                    {processos.map((p) => (
                      <SelectItem key={p.processo_id} value={p.processo_id}>
                        {p.processo_id} ({p.count} doc{p.count > 1 ? "s" : ""})
                      </SelectItem>
                    ))}
                    {processos.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        Nenhum processo encontrado
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-60 gap-4">
              <Bot size={48} className="text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Assistente Jurídico TCU</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Pergunte sobre acórdãos, súmulas, licitações, contratos administrativos e controle externo.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "cursor-pointer"} ${
                msg.role === "assistant" && selectedMessageId === msg.id ? "ring-1 ring-primary/40 rounded-xl" : ""
              }`}
              onClick={() => {
                if (msg.role === "assistant" && msg.ragMeta) {
                  setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id);
                }
              }}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={14} className="text-primary" />
                </div>
              )}
              <div className="max-w-2xl">
                <div
                  className={`${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-xl px-5 py-3"
                      : "bg-card shadow-panel rounded-xl px-6 py-5"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none text-foreground [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:text-foreground [&_a]:text-primary">
                      <ReactMarkdown>{stripSourcesFromContent(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                  )}
                </div>

                {msg.role === "assistant" && msg.ragMeta && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {msg.ragMeta.mode === "rag" || (msg.ragMeta.rag_used && msg.ragMeta.mode !== "general") ? (
                      <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10 text-[10px] gap-1">
                        <ShieldCheck size={10} />
                        RAG ATIVO
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 text-[10px] gap-1">
                        <Globe size={10} />
                        MODO GERAL
                      </Badge>
                    )}
                    {msg.ragMeta.chunks_used !== undefined && msg.ragMeta.chunks_used > 0 && (
                      <Badge variant="outline" className="border-border text-muted-foreground text-[10px] gap-1">
                        <Database size={10} />
                        {msg.ragMeta.chunks_used} chunk{msg.ragMeta.chunks_used > 1 ? "s" : ""} consultado{msg.ragMeta.chunks_used > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {msg.ragMeta.mode === "general" && (
                      <p className="w-full text-[10px] text-blue-400/70 mt-1">
                        ⚠️ Fontes listadas no painel à direita.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={14} className="text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span>Consultando base jurídica e analisando...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-5 border-t border-border/50 glass">
          <div className="flex items-center gap-3 max-w-2xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                scopeMode === "processo" && selectedProcessoId
                  ? `Pergunta sobre ${selectedProcessoId}...`
                  : "Digite sua pergunta jurídica..."
              }
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-primary text-primary-foreground p-3 rounded-xl hover:bg-accent disabled:opacity-40 transition-all duration-200 shadow-glow-sm hover:shadow-glow"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChatJuridico;
