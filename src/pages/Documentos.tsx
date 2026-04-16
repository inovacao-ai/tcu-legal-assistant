import { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Upload, FileText, AlertTriangle, Loader2,
  Trash2, RotateCcw, ChevronDown, ChevronUp, Database,
  FileCode, Cpu, Zap, FolderOpen, Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Doc {
  id: string;
  name: string;
  document_type: string | null;
  status: string;
  created_at: string;
  risks_found: number | null;
  file_size: number | null;
  total_chunks: number | null;
  total_embeddings: number | null;
  indexed_at: string | null;
  error_message: string | null;
  processo_id: string | null;
  orgao: string | null;
  numero_processo: string | null;
  chunks_in_db?: number;
  embeddings_in_db?: number;
  has_embeddings?: boolean;
  rag_ready?: boolean;
}

const PIPELINE_STAGES = [
  { key: "uploaded", label: "Upload", icon: Upload },
  { key: "extracting", label: "Extração", icon: FileCode },
  { key: "chunking", label: "Chunks", icon: Database },
  { key: "embedding", label: "Embeddings", icon: Cpu },
  { key: "ready", label: "RAG Pronto", icon: Zap },
] as const;

const statusOrder: Record<string, number> = {
  uploaded: 0, extracting: 1, chunking: 2, embedding: 3, indexed: 4, ready: 5, error: -1,
};

function getStageState(docStatus: string, stageKey: string): "done" | "active" | "error" | "pending" {
  if (docStatus === "error") {
    const stageOrder = statusOrder[stageKey] ?? 99;
    if (stageOrder <= 0) return "done";
    return "error";
  }
  const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
  const docIdx = PIPELINE_STAGES.findIndex(s => s.key === docStatus);
  const effectiveDocIdx = docStatus === "indexed" ? 3 : docStatus === "ready" ? 4 : docIdx;
  if (stageIdx < effectiveDocIdx) return "done";
  if (stageIdx === effectiveDocIdx) return docStatus === "ready" || docStatus === "indexed" ? "done" : "active";
  return "pending";
}

const stageColors = {
  done: "text-sky-400 glow-icon-sm",
  active: "text-cyan-400 animate-pulse",
  error: "text-destructive",
  pending: "text-muted-foreground/30",
};

const stageBgColors = {
  done: "bg-sky-400/10 border-sky-400/25",
  active: "bg-cyan-400/10 border-cyan-400/30",
  error: "bg-destructive/10 border-destructive/30",
  pending: "bg-muted/20 border-border/20",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getFileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  return "application/octet-stream";
}

function guessDocType(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("edital")) return "Edital";
  if (lower.includes("contrato")) return "Contrato";
  if (lower.includes("parecer")) return "Parecer";
  if (lower.includes("ata")) return "Ata SRP";
  if (lower.includes("convenio") || lower.includes("convênio")) return "Convênio";
  return null;
}

const Documentos = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form fields
  const [uploadProcessoId, setUploadProcessoId] = useState("");
  const [uploadOrgao, setUploadOrgao] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, document_type, status, created_at, risks_found, file_size, total_chunks, total_embeddings, indexed_at, error_message, processo_id, orgao, numero_processo")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setDocuments((data as Doc[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const notReadyCount = documents.filter(d => d.status !== "ready" && d.status !== "indexed").length;

  // Group documents by processo_id
  const groupedDocuments = documents.reduce<Record<string, Doc[]>>((acc, doc) => {
    const key = doc.processo_id || "__sem_processo__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const processoKeys = Object.keys(groupedDocuments).sort((a, b) => {
    if (a === "__sem_processo__") return 1;
    if (b === "__sem_processo__") return -1;
    return a.localeCompare(b);
  });

  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext === "pdf" || ext === "docx" || ext === "doc";
    });
    if (validFiles.length === 0) {
      toast.error("Selecione arquivos PDF ou DOCX.");
      return;
    }
    setPendingFiles(validFiles);
    setShowUploadForm(true);
  };

  const uploadFiles = async () => {
    if (!user || pendingFiles.length === 0) return;
    setShowUploadForm(false);
    setUploading(true);

    const processoId = uploadProcessoId.trim() || null;
    const orgao = uploadOrgao.trim() || null;

    for (const file of pendingFiles) {
      const sanitizedName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${sanitizedName}`;

      const { error: storageError } = await supabase.storage
        .from("legal-documents").upload(filePath, file);

      if (storageError) {
        console.error("Upload error:", storageError);
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { data: insertData, error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        file_path: filePath,
        file_type: getFileType(file.name),
        file_size: file.size,
        document_type: guessDocType(file.name),
        status: "uploaded",
        processo_id: processoId,
        orgao: orgao,
      }).select("id").single();

      if (dbError) {
        console.error("DB error:", dbError);
        toast.error(`Erro ao registrar ${file.name}`);
      } else {
        toast.success(`${file.name} enviado! Processando...`);
        if (insertData?.id) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                document_id: insertData.id,
                processo_id: processoId,
                orgao: orgao,
              }),
            });
          } catch (err) {
            console.error("Process error:", err);
          }
          await fetchDocuments();
        }
      }
    }

    setPendingFiles([]);
    setUploadProcessoId("");
    setUploadOrgao("");
    setUploading(false);
    fetchDocuments();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelected(e.target.files);
      e.target.value = "";
    }
  };

  const handleDelete = async (e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation();
    if (!user) return;
    await supabase.storage.from("legal-documents").remove([`${user.id}/${doc.name}`]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Erro ao excluir documento.");
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Documento excluído.");
    }
  };

  const handleDeleteProcesso = async (processoId: string) => {
    if (!user) return;
    const docsInProcesso = documents.filter(d => d.processo_id === processoId);
    
    // Delete from DB (chunks cascade automatically)
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("processo_id", processoId)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao excluir processo.");
    } else {
      // Try to remove storage files
      for (const doc of docsInProcesso) {
        await supabase.storage.from("legal-documents").remove([doc.name]);
      }
      setDocuments((prev) => prev.filter((d) => d.processo_id !== processoId));
      toast.success(`Processo ${processoId} e ${docsInProcesso.length} documento(s) excluídos.`);
    }
  };

  const handleReprocess = async (e: React.MouseEvent, doc: Doc) => {
    e.stopPropagation();
    if (!user) return;

    setReprocessingIds((prev) => new Set(prev).add(doc.id));
    await supabase.from("documents").update({ status: "uploaded", error_message: null, total_chunks: 0, total_embeddings: 0, indexed_at: null }).eq("id", doc.id);
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "uploaded" } : d)));

    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
      toast.success(`${doc.name} reprocessado!`);
    } catch (err) {
      console.error("Reprocess error:", err);
      toast.error(`Erro ao reprocessar ${doc.name}`);
    } finally {
      setReprocessingIds((prev) => { const n = new Set(prev); n.delete(doc.id); return n; });
      fetchDocuments();
    }
  };

  const handleReprocessAll = async () => {
    const pending = documents.filter(d => d.status !== "ready" && d.status !== "indexed");
    if (pending.length === 0) return;
    toast.info(`Reprocessando ${pending.length} documento(s)...`);
    for (const doc of pending) {
      await handleReprocess({ stopPropagation: () => {} } as React.MouseEvent, doc);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
  };

  const canReprocess = (status: string) =>
    ["error", "uploaded", "pendente"].includes(status);

  const renderDocRow = (doc: Doc) => {
    const isExpanded = expandedDoc === doc.id;
    return (
      <div key={doc.id} className="group">
        <div
          className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/50 transition-all duration-200 cursor-pointer"
          onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
        >
          <FileText size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">{doc.document_type || "Documento"}</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
              {doc.orgao && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 size={10} /> {doc.orgao}
                </span>
              )}
            </div>
          </div>

          {/* Mini pipeline indicators */}
          <div className="flex items-center gap-1">
            {PIPELINE_STAGES.map((stage) => {
              const state = getStageState(doc.status, stage.key);
              const Icon = stage.icon;
              return (
                <div
                  key={stage.key}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center ${stageBgColors[state]}`}
                  title={`${stage.label}: ${state === "done" ? "✅" : state === "active" ? "🔄" : state === "error" ? "❌" : "⏳"}`}
                >
                  <Icon size={12} className={stageColors[state]} />
                </div>
              );
            })}
          </div>

          <Badge
            variant={doc.status === "ready" || doc.status === "indexed" ? "default" : doc.status === "error" ? "destructive" : "secondary"}
            className="text-xs shrink-0"
          >
            {doc.status === "ready" ? "RAG Pronto" : doc.status === "indexed" ? "Indexado" : doc.status === "error" ? "Erro" : doc.status}
          </Badge>

          <div className="flex items-center gap-1 shrink-0">
            {canReprocess(doc.status) && (
              <button
                onClick={(e) => handleReprocess(e, doc)}
                disabled={reprocessingIds.has(doc.id)}
                className="text-muted-foreground hover:text-primary transition-all p-1 disabled:opacity-50"
                title="Reprocessar"
              >
                {reprocessingIds.has(doc.id) ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              </button>
            )}
            <button
              onClick={(e) => handleDelete(e, doc)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
              title="Excluir"
            >
              <Trash2 size={14} />
            </button>
            {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-6 pb-5 bg-secondary/20">
            <div className="flex items-center gap-2 py-4">
              {PIPELINE_STAGES.map((stage, idx) => {
                const state = getStageState(doc.status, stage.key);
                const Icon = stage.icon;
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center ${stageBgColors[state]}`}>
                        {state === "active" ? (
                          <Loader2 size={18} className="text-cyan-400 animate-spin" />
                        ) : (
                          <Icon size={18} className={stageColors[state]} />
                        )}
                      </div>
                      <span className={`text-[10px] font-medium ${state === "done" ? "text-sky-400" : state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                        {stage.label}
                      </span>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className={`w-6 h-0.5 mb-4 ${state === "done" ? "bg-sky-400/35" : "bg-border/40"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-4 mt-2">
              <div className="bg-card rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Chunks</p>
                <p className="text-lg font-bold text-foreground">{doc.total_chunks ?? 0}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Embeddings</p>
                <p className="text-lg font-bold text-foreground">{doc.total_embeddings ?? 0}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Indexado em</p>
                <p className="text-xs font-medium text-foreground">{formatDateTime(doc.indexed_at)}</p>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">RAG</p>
                <Badge variant={doc.status === "ready" ? "default" : "secondary"} className="text-xs">
                  {doc.status === "ready" ? "✅ Pronto" : "⏳ Pendente"}
                </Badge>
              </div>
            </div>

            {doc.error_message && (
              <div className="mt-3 bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <p className="text-xs font-medium text-destructive mb-1">Mensagem de erro:</p>
                <p className="text-xs text-destructive/80 font-mono">{doc.error_message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout showSourcePanel={false}>
      <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-slab text-2xl font-bold mb-1">Documentos</h1>
            <p className="text-sm text-muted-foreground">
              Upload e análise de documentos jurídicos — pipeline RAG completo.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent transition-all duration-200 shadow-glow-sm hover:shadow-glow disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "Enviando..." : "Upload"}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" multiple className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Upload form modal */}
        {showUploadForm && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-panel">
            <h3 className="font-slab text-sm font-semibold mb-4">
              Enviar {pendingFiles.length} arquivo(s)
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="processo_id" className="text-xs text-muted-foreground">
                  Número do Processo (opcional)
                </Label>
                <Input
                  id="processo_id"
                  value={uploadProcessoId}
                  onChange={(e) => setUploadProcessoId(e.target.value)}
                  placeholder="Ex: TC 001.234/2024-5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="orgao" className="text-xs text-muted-foreground">
                  Órgão (opcional)
                </Label>
                <Input
                  id="orgao"
                  value={uploadOrgao}
                  onChange={(e) => setUploadOrgao(e.target.value)}
                  placeholder="Ex: Ministério da Saúde"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              Arquivos: {pendingFiles.map(f => f.name).join(", ")}
            </div>
            <div className="flex gap-2">
              <button
                onClick={uploadFiles}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent transition-all"
              >
                <Upload size={14} /> Enviar
              </button>
              <button
                onClick={() => { setShowUploadForm(false); setPendingFiles([]); }}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Alert for not-ready documents */}
        {!loading && notReadyCount > 0 && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-accent" />
              <span className="text-sm font-medium text-foreground">
                {notReadyCount} documento(s) ainda não estão prontos para busca RAG.
              </span>
            </div>
            <button
              onClick={handleReprocessAll}
              className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-accent-foreground px-3 py-1.5 rounded-lg hover:bg-accent/80 transition-colors"
            >
              <RotateCcw size={12} />
              Reprocessar pendentes
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-card rounded-xl border-2 border-dashed transition-all duration-200 p-10 text-center mb-6 cursor-pointer group ${
            isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40"
          }`}
        >
          {uploading ? (
            <Loader2 size={32} className="mx-auto text-primary mb-2 animate-spin" />
          ) : (
            <Upload size={32} strokeWidth={1} className={`mx-auto mb-2 transition-all duration-200 ${
              isDragging ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary"
            }`} />
          )}
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragging ? "Solte os arquivos aqui" : "Arraste documentos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground">PDF, DOCX — máx. 20MB por arquivo</p>
        </div>

        {/* Document list grouped by processo */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-card rounded-xl shadow-panel flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={20} />
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-card rounded-xl shadow-panel text-center py-12">
              <FileText size={32} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
            </div>
          ) : (
            processoKeys.map((key) => {
              const docs = groupedDocuments[key];
              const isNoProcesso = key === "__sem_processo__";
              const readyCount = docs.filter(d => d.status === "ready" || d.status === "indexed").length;
              const orgao = !isNoProcesso ? docs[0]?.orgao : null;

              return (
                <div key={key} className="bg-card rounded-xl shadow-panel overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderOpen size={16} className={isNoProcesso ? "text-muted-foreground" : "text-primary"} />
                      <div>
                        <h2 className="font-slab text-sm font-semibold">
                          {isNoProcesso ? "Sem processo vinculado" : key}
                        </h2>
                        {orgao && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 size={10} /> {orgao}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {docs.length} doc{docs.length > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Zap size={10} className="mr-1 text-emerald-500" />
                        {readyCount} pronto{readyCount !== 1 ? "s" : ""}
                      </Badge>
                      {!isNoProcesso && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="text-muted-foreground hover:text-destructive transition-all p-1"
                              title="Excluir processo completo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir processo completo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso excluirá permanentemente o processo <strong>{key}</strong> e todos os seus{" "}
                                <strong>{docs.length} documento(s)</strong>, incluindo chunks e embeddings.
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteProcesso(key)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir tudo
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-border/30">
                    {docs.map(renderDocRow)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Documentos;
