import { X, ExternalLink, Scale, Gavel, BookOpen, FileText, ScrollText, Landmark } from "lucide-react";

interface Source {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  reference: string;
  url?: string;
}

interface SourcePanelProps {
  sources: Source[];
  activeSourceId?: string | null;
  onClose?: () => void;
}

function getSourceMeta(type: string, title: string) {
  const t = type.toLowerCase();
  const tl = title.toLowerCase();

  if (t.includes("jurisprud") || tl.includes("acórdão") || tl.includes("acordão") || tl.includes("súmula") || tl.includes("sumula")) {
    return { icon: Gavel, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30", label: "Jurisprudência" };
  }
  if (t.includes("legisla") || tl.includes("lei ") || tl.includes("lei nº") || tl.includes("decreto") || tl.includes("constituição")) {
    return { icon: Scale, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30", label: "Legislação" };
  }
  if (t.includes("normativ") || tl.includes("instrução") || tl.includes("instrucao") || tl.includes("resolução") || tl.includes("portaria")) {
    return { icon: ScrollText, color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30", label: "Normativo" };
  }
  if (t.includes("doutrin") || t.includes("livro") || t.includes("artigo")) {
    return { icon: BookOpen, color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/30", label: "Doutrina" };
  }
  if (t.includes("documento") || t.includes("rag")) {
    return { icon: FileText, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", label: "Documento" };
  }
  return { icon: Landmark, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", label: type || "Fonte" };
}

const SourcePanel = ({ sources, activeSourceId, onClose }: SourcePanelProps) => {
  if (sources.length === 0) {
    return (
      <aside className="w-80 flex-shrink-0 glass-strong h-screen sticky top-0 flex flex-col">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-slab text-sm font-semibold">Fontes</h2>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            As fontes e citações das respostas aparecerão aqui automaticamente.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 glass-strong h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-slab text-sm font-semibold">Fontes e Fundamentação</h2>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-primary transition-all duration-200">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-0">
        {sources.map((source) => {
          const meta = getSourceMeta(source.type, source.title);
          const Icon = meta.icon;
          const Wrapper = source.url ? "a" : "div";
          const wrapperProps = source.url
            ? { href: source.url, target: "_blank", rel: "noopener noreferrer" }
            : {};

          return (
            <Wrapper
              key={source.id}
              {...wrapperProps}
              id={`source-${source.id}`}
              className={`block px-5 py-4 border-b border-border/30 transition-all duration-200 group ${
                source.url ? "cursor-pointer hover:bg-primary/5" : ""
              } ${activeSourceId === source.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon size={16} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${meta.color} ${meta.bg} px-1.5 py-0.5 rounded border ${meta.border}`}>
                      {meta.label}
                    </span>
                    {source.url && (
                      <ExternalLink size={10} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <h3 className="font-slab text-sm font-medium mb-1 group-hover:text-primary transition-colors leading-snug">
                    {source.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{source.excerpt}</p>
                  {source.reference && source.reference !== "Conhecimento Geral" && (
                    <p className="text-[10px] text-primary font-medium mt-1.5">{source.reference}</p>
                  )}
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground text-center">
          {sources.length} fonte{sources.length > 1 ? "s" : ""} identificada{sources.length > 1 ? "s" : ""}
        </p>
      </div>
    </aside>
  );
};

export default SourcePanel;
