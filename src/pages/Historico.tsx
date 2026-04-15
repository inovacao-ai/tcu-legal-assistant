import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { MessageSquare, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Consultation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const Historico = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setConsultations(data || []);
      }
      setLoading(false);
    };

    fetch();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from("consultations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir consulta.");
    } else {
      setConsultations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Consulta excluída.");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout showSourcePanel={false}>
      <div className="p-8 max-w-4xl">
        <div className="mb-10">
          <h1 className="font-slab text-2xl font-bold mb-1">Histórico</h1>
          <p className="text-sm text-muted-foreground">Todas as consultas realizadas.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={40} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma consulta encontrada.</p>
            <button
              onClick={() => navigate("/chat")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Iniciar nova consulta
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-panel divide-y divide-border/30">
            {consultations.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/chat/${item.id}`)}
                className="px-6 py-5 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <MessageSquare size={18} className="text-primary mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(item.updated_at)}</span>
                      <span className="text-primary/70 capitalize">{item.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                    title="Excluir consulta"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Historico;
