import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { FileText, MessageSquare, AlertTriangle, Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  totalConsultations: number;
  totalDocuments: number;
  totalRisks: number;
  totalAnalyses: number;
}

interface RecentConsultation {
  id: string;
  title: string;
  created_at: string;
  status: string;
}

interface RiskDocument {
  id: string;
  name: string;
  risks_found: number;
  status: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalConsultations: 0, totalDocuments: 0, totalRisks: 0, totalAnalyses: 0 });
  const [recentConsultations, setRecentConsultations] = useState<RecentConsultation[]>([]);
  const [riskDocuments, setRiskDocuments] = useState<RiskDocument[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [consultsRes, docsRes, analysesRes, recentRes, risksRes] = await Promise.all([
          supabase.from("consultations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("legal_analysis").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("consultations").select("id, title, created_at, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("documents").select("id, name, risks_found, status").eq("user_id", user.id).gt("risks_found", 0).order("created_at", { ascending: false }).limit(5),
        ]);

        const totalRisks = risksRes.data?.reduce((sum, d) => sum + (d.risks_found || 0), 0) || 0;

        setStats({
          totalConsultations: consultsRes.count || 0,
          totalDocuments: docsRes.count || 0,
          totalRisks,
          totalAnalyses: analysesRes.count || 0,
        });
        setRecentConsultations(recentRes.data || []);
        setRiskDocuments(risksRes.data || []);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const statCards = [
    { label: "Consultas Realizadas", value: stats.totalConsultations, icon: MessageSquare },
    { label: "Documentos Analisados", value: stats.totalDocuments, icon: FileText },
    { label: "Alertas de Risco", value: stats.totalRisks, icon: AlertTriangle, isWarning: true },
    { label: "Pareceres Gerados", value: stats.totalAnalyses, icon: Scale },
  ];

  if (loading) {
    return (
      <AppLayout showSourcePanel={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showSourcePanel={false}>
      <div className="p-8 max-w-5xl">
        <div className="mb-10">
          <h1 className="font-slab text-2xl font-bold mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das atividades e análises jurídicas.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl shadow-panel p-6 hover:shadow-panel-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <stat.icon
                  size={22}
                  strokeWidth={1.5}
                  className={stat.isWarning ? "text-accent" : "text-primary"}
                />
              </div>
              <p className="font-slab text-3xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent Consultations */}
          <div className="col-span-1 md:col-span-2 bg-card rounded-xl shadow-panel">
            <div className="px-6 py-5 border-b border-border/50">
              <h2 className="font-slab text-sm font-semibold">Consultas Recentes</h2>
            </div>
            <div className="divide-y divide-border/30">
              {recentConsultations.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma consulta realizada ainda.
                </div>
              ) : (
                recentConsultations.map((c) => (
                  <div
                    key={c.id}
                    className="px-6 py-5 hover:bg-secondary/50 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/chat/${c.id}`)}
                  >
                    <p className="text-sm text-foreground font-medium leading-snug mb-2">{c.title}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "ativa" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {c.status === "ativa" ? "Ativa" : "Concluída"}
                      </span>
                      <span>{format(new Date(c.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Risk Alerts */}
          <div className="bg-card rounded-xl shadow-panel">
            <div className="px-6 py-5 border-b border-border/50">
              <h2 className="font-slab text-sm font-semibold">Alertas de Risco</h2>
            </div>
            <div className="divide-y divide-border/30">
              {riskDocuments.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Nenhum alerta de risco encontrado.
                </div>
              ) : (
                riskDocuments.map((doc) => (
                  <div key={doc.id} className="px-6 py-5">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                          (doc.risks_found || 0) >= 3 ? "bg-primary shadow-glow-sm" : "bg-accent"
                        }`}
                      />
                      <div>
                        <p className="text-sm text-foreground font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.risks_found} {doc.risks_found === 1 ? "risco identificado" : "riscos identificados"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
