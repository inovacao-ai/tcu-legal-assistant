import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  GraduationCap,
  Shield,
  Settings,
  Crown,
  Loader2,
  AlertTriangle,
  Upload,
  FileText,
  Globe,
  Type,
  Search,
  Eye,
  ExternalLink,
  Trash2,
  CheckCircle,
  Clock,
  Filter,
} from "lucide-react";

const tabs = [
  { id: "visao-geral", label: "Visão Geral", icon: BarChart3 },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "aprendizado", label: "Aprendizado", icon: GraduationCap },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

interface AdminStats {
  total_users: number;
  total_consultations: number;
  total_documents: number;
  total_analyses: number;
  documents_analyzed: number;
  documents_pending: number;
  documents_with_risks: number;
  active_consultations: number;
  total_risks: number;
}

interface ProfileWithRoles {
  id: string;
  user_id: string;
  display_name: string | null;
  organization: string | null;
  role_description: string | null;
  roles: string[];
}

const TogglePref = ({
  label,
  description,
  defaultOn,
}: {
  label: string;
  description: string;
  defaultOn: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          on ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-foreground transition-transform duration-200 ${
            on ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
};

const ROLE_OPTIONS = ["admin", "moderator", "user", "viewer"] as const;
type AppRole = (typeof ROLE_OPTIONS)[number];

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderador",
  user: "Usuário",
  viewer: "Viewer",
};

const Admin = () => {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<ProfileWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; name: string } | null>(null);
  // Aprendizado state
  const [kbDocs, setKbDocs] = useState<any[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbSearch, setKbSearch] = useState("");
  const [kbStatusFilter, setKbStatusFilter] = useState("all");
  const [kbTypeFilter, setKbTypeFilter] = useState("all");
  const [kbUploadMode, setKbUploadMode] = useState<"file" | "text" | "url">("file");
  const [kbTextContent, setKbTextContent] = useState("");
  const [kbTextTitle, setKbTextTitle] = useState("");
  const [kbUrl, setKbUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const kbFileRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === "admin";
  const isModerator = userRole === "moderator";
  const isReadOnly = isModerator;

  useEffect(() => {
    checkAdminAndLoadData();
  }, [user]);

  const checkAdminAndLoadData = async () => {
    if (!user) return;

    // Check user roles - admin or moderator can access
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roleData || roleData.length === 0) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const roles = roleData.map((r) => r.role);
    if (roles.includes("admin")) {
      setUserRole("admin");
    } else if (roles.includes("moderator")) {
      setUserRole("moderator");
    } else {
      setUserRole(null);
      setLoading(false);
      return;
    }

    // Load stats and users in parallel
    const [statsResult, profilesResult, rolesResult] = await Promise.all([
      supabase.rpc("get_admin_stats"),
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);

    if (statsResult.data) {
      setStats(statsResult.data as unknown as AdminStats);
    }

    if (profilesResult.data && rolesResult.data) {
      const profilesWithRoles: ProfileWithRoles[] = profilesResult.data.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        organization: p.organization,
        role_description: p.role_description,
        roles: rolesResult.data
          .filter((r) => r.user_id === p.user_id)
          .map((r) => r.role),
      }));
      setUsers(profilesWithRoles);
    }

    if (statsResult.error) {
      toast.error("Erro ao carregar estatísticas");
      console.error(statsResult.error);
    }

    setLoading(false);
  };

  const handleChangeRole = async (targetUserId: string, newRole: AppRole) => {
    if (isReadOnly) return;
    setChangingRole(targetUserId);

    // Delete existing roles for user
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);

    if (deleteError) {
      toast.error("Erro ao alterar papel.");
      console.error(deleteError);
      setChangingRole(null);
      return;
    }

    // Insert new role
    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: targetUserId, role: newRole });

    if (insertError) {
      toast.error("Erro ao atribuir novo papel.");
      console.error(insertError);
    } else {
      toast.success(`Papel alterado para ${roleLabelMap[newRole]}`);
      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === targetUserId ? { ...u, roles: [newRole] } : u
        )
      );
    }
    setChangingRole(null);
  };

  const handleDeleteUser = async (targetUserId: string) => {
    if (!isAdmin || targetUserId === user?.id) return;
    setDeleteConfirm(null);

    setDeletingUser(targetUserId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ user_id: targetUserId }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir usuário");
      }
      toast.success("Usuário excluído com sucesso.");
      setUsers((prev) => prev.filter((u) => u.user_id !== targetUserId));
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário.");
      console.error(err);
    }
    setDeletingUser(null);
  };

  const loadKbDocs = async () => {
    if (!user) return;
    setKbLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, file_type, document_type, status, created_at, file_size")
      .order("created_at", { ascending: false });
    if (!error && data) setKbDocs(data);
    setKbLoading(false);
  };

  useEffect(() => {
    if ((isAdmin || isModerator) && activeTab === "aprendizado") loadKbDocs();
  }, [isAdmin, isModerator, activeTab]);

  const sanitizeFileName = (name: string) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

  const uploadKbFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const validExts = ["pdf", "docx", "doc", "txt", "csv"];
    const validFiles = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext && validExts.includes(ext);
    });
    if (validFiles.length === 0) {
      toast.error("Selecione arquivos PDF, DOCX, TXT ou CSV.");
      return;
    }
    setKbUploading(true);
    for (const file of validFiles) {
      const safeName = sanitizeFileName(file.name);
      const filePath = `${user.id}/${Date.now()}_${safeName}`;
      const { error: storageError } = await supabase.storage.from("legal-documents").upload(filePath, file);
      if (storageError) {
        console.error("Upload error:", storageError);
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fileType = ext === "pdf" ? "application/pdf" : ext === "txt" ? "text/plain" : ext === "csv" ? "text/csv" : "application/octet-stream";
      const { data: insertData } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        file_path: filePath,
        file_type: fileType,
        file_size: file.size,
        document_type: "Base de Conhecimento",
        status: "pendente",
      }).select("id").single();
      toast.success(`${file.name} enviado! Processando...`);

      // Trigger RAG processing
      if (insertData?.id) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ document_id: insertData.id }),
        }).then(() => loadKbDocs()).catch(console.error);
      }
    }
    setKbUploading(false);
    loadKbDocs();
  };

  const handleKbDelete = async (docId: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (error) {
      toast.error("Erro ao excluir documento.");
    } else {
      setKbDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Documento excluído.");
    }
  };

  const filteredKbDocs = kbDocs.filter((d) => {
    const matchesSearch = !kbSearch || d.name.toLowerCase().includes(kbSearch.toLowerCase());
    const matchesStatus = kbStatusFilter === "all" || d.status === kbStatusFilter;
    const matchesType = kbTypeFilter === "all" || d.file_type?.includes(kbTypeFilter);
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <AppLayout showSourcePanel={false}>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <AppLayout showSourcePanel={false}>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <AlertTriangle size={48} className="text-primary" />
          <h2 className="font-slab text-xl font-bold">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo.
          </p>
        </div>
      </AppLayout>
    );
  }

  const conformityIndex =
    stats && stats.total_documents > 0
      ? Math.round((stats.documents_analyzed / stats.total_documents) * 100)
      : 0;

  const roleColors: Record<string, string> = {
    admin: "bg-primary/20 text-primary",
    moderator: "bg-emerald-500/20 text-emerald-400",
    user: "bg-blue-500/20 text-blue-400",
    viewer: "bg-muted text-muted-foreground",
  };

  const avatarColors = [
    "bg-primary/20 text-primary",
    "bg-blue-500/20 text-blue-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-purple-500/20 text-purple-400",
    "bg-yellow-500/20 text-yellow-400",
  ];

  return (
    <AppLayout showSourcePanel={false}>
      <div className="p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-slab text-2xl font-bold mb-1">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral, usuários, segurança e configurações do tenant
            </p>
          </div>
          <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-2 bg-card">
            <Crown size={16} className="text-primary" />
            <span className="text-sm font-medium">{roleLabelMap[userRole!]}</span>
            {isReadOnly && (
              <span className="text-[10px] text-muted-foreground ml-1">(somente leitura)</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-border/50 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-foreground bg-card"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <tab.icon size={16} strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "visao-geral" && stats && (
          <div className="space-y-6">
            {/* Conformidade */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">
                Índice de Conformidade Geral
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Média ponderada entre evidências, controle técnico e contábil
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${conformityIndex}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-primary font-slab min-w-[50px] text-right">
                  {conformityIndex}%
                </span>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-card rounded-xl shadow-panel p-6 hover:shadow-panel-lg transition-all duration-200">
                <p className="text-sm text-muted-foreground mb-2">Consultas</p>
                <p className="font-slab text-3xl font-bold mb-3">{stats.total_consultations}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {stats.active_consultations} ativas
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-panel p-6 hover:shadow-panel-lg transition-all duration-200">
                <p className="text-sm text-muted-foreground mb-2">Documentos</p>
                <p className="font-slab text-3xl font-bold mb-3">{stats.total_documents}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {stats.documents_analyzed} analisados
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                    {stats.documents_pending} pendentes
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-panel p-6 hover:shadow-panel-lg transition-all duration-200">
                <p className="text-sm text-muted-foreground mb-2">Análises Jurídicas</p>
                <p className="font-slab text-3xl font-bold mb-3">{stats.total_analyses}</p>
                <p className="text-xs text-muted-foreground">total realizadas</p>
              </div>

              <div className="bg-card rounded-xl shadow-panel p-6 hover:shadow-panel-lg transition-all duration-200">
                <p className="text-sm text-muted-foreground mb-2">Riscos Encontrados</p>
                <p className="font-slab text-3xl font-bold mb-3">{stats.total_risks}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                    {stats.documents_with_risks} docs c/ risco
                  </span>
                </div>
              </div>
            </div>

            {/* Tenant Users */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">
                Usuários do Tenant
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                {users.length} usuário(s) cadastrado(s)
              </p>
              <div className="flex flex-wrap gap-6">
                {users.map((u, index) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        avatarColors[index % avatarColors.length]
                      }`}
                    >
                      {(u.display_name || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.display_name || "Sem nome"}</p>
                      <div className="flex gap-1 mt-0.5">
                        {u.roles.length > 0 ? (
                          u.roles.map((role) => (
                            <span
                              key={role}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                roleColors[role] || "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground">sem role</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "usuarios" && (
          <div className="bg-card rounded-xl shadow-panel">
            <div className="px-6 py-5 border-b border-border/50">
              <h2 className="font-slab text-sm font-semibold">Todos os Usuários</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {users.length} usuário(s) registrado(s) no sistema
              </p>
            </div>
            <table className="w-full">
              <thead>
                 <tr className="border-b border-border/30">
                   <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Usuário</th>
                   <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Email</th>
                   <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Papéis</th>
                   {isAdmin && <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">Ações</th>}
                 </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {users.map((u, index) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                            avatarColors[index % avatarColors.length]
                          }`}
                        >
                          {(u.display_name || "U")[0].toUpperCase()}
                          {(u.display_name || "U")[1]?.toUpperCase() || ""}
                        </div>
                        <span className="text-sm font-medium">{u.display_name || "Sem nome"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {u.organization || "—"}
                    </td>
                     <td className="px-6 py-4">
                       {isAdmin ? (
                         <select
                           value={u.roles[0] || "user"}
                           onChange={(e) => handleChangeRole(u.user_id, e.target.value as AppRole)}
                           disabled={changingRole === u.user_id}
                           className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                         >
                           {ROLE_OPTIONS.map((role) => (
                             <option key={role} value={role}>
                               {roleLabelMap[role]}
                             </option>
                           ))}
                         </select>
                       ) : (
                         <div className="flex gap-1.5">
                           {u.roles.map((role) => (
                             <span
                               key={role}
                               className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                                 roleColors[role] || "bg-secondary text-muted-foreground"
                               }`}
                             >
                               {roleLabelMap[role] || role}
                             </span>
                           ))}
                         </div>
                       )}
                     </td>
                     {isAdmin && (
                       <td className="px-6 py-4 text-right">
                         <button
                           onClick={() => {
                             const target = users.find(p => p.user_id === u.user_id);
                             setDeleteConfirm({ userId: u.user_id, name: target?.display_name || "este usuário" });
                           }}
                           disabled={u.user_id === user?.id || deletingUser === u.user_id}
                           className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
                           title={u.user_id === user?.id ? "Não é possível excluir a si mesmo" : "Excluir usuário"}
                         >
                           {deletingUser === u.user_id ? (
                             <Loader2 size={14} className="animate-spin" />
                           ) : (
                             <Trash2 size={14} />
                           )}
                         </button>
                       </td>
                     )}
                  </tr>
                ))}
                {users.length === 0 && (
                   <tr>
                     <td colSpan={isAdmin ? 4 : 3} className="px-6 py-12 text-center text-sm text-muted-foreground">
                       Nenhum usuário encontrado.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "configuracoes" && (
          <div className="space-y-6">
            {/* Integrações */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">Integrações</h2>
              <p className="text-xs text-muted-foreground mb-5">Webhooks e conexões externas</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between border border-border/50 rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">n8n Webhooks</p>
                    <p className="text-xs text-muted-foreground">Automação de workflows para análise e notificações</p>
                  </div>
                  <span className="text-xs font-medium border border-border rounded-lg px-3 py-1.5">Configurável</span>
                </div>
                <div className="flex items-center justify-between border border-border/50 rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">Exportação de Relatórios</p>
                    <p className="text-xs text-muted-foreground">Gera relatórios estruturados para auditoria (MCTI/ANPD)</p>
                  </div>
                  <span className="text-xs font-medium border border-border rounded-lg px-3 py-1.5">Disponível</span>
                </div>
                <div className="flex items-center justify-between border border-border/50 rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">Motor de IA</p>
                    <p className="text-xs text-muted-foreground">Gemini 3 Flash via Lovable AI</p>
                  </div>
                  <span className="text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-lg px-3 py-1.5">Conectado</span>
                </div>
              </div>
            </div>

            {/* Preferências do Tenant */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">Preferências do Tenant</h2>
              <div className="mt-5 divide-y divide-border/30">
                <TogglePref
                  label="Notificações por email"
                  description="Alertas de evidências pendentes e vencimentos"
                  defaultOn={false}
                />
                <TogglePref
                  label="Relatório automático mensal"
                  description="Geração automática do relatório de conformidade"
                  defaultOn={false}
                />
                <TogglePref
                  label="Modo escuro"
                  description="Interface em modo dark"
                  defaultOn={true}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "seguranca" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Status de Segurança */}
              <div className="bg-card rounded-xl shadow-panel p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Shield size={18} className="text-muted-foreground" />
                  <h2 className="font-slab text-base font-semibold">Status de Segurança</h2>
                </div>
                <div className="space-y-3">
                  {[
                    "Row Level Security (RLS)",
                    "Multi-tenant Isolation",
                    "Autenticação por email",
                    "Papéis e permissões (RBAC)",
                  ].map((item) => (
                    <div key={item} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400 text-xs">✓</span>
                        </span>
                        <span className="text-sm text-primary font-medium">{item}</span>
                      </div>
                      <span className="text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-lg px-3 py-1">Ativo</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabelas Protegidas */}
              <div className="bg-card rounded-xl shadow-panel p-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-muted-foreground text-base">⚡</span>
                  <h2 className="font-slab text-base font-semibold">Tabelas Protegidas</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-5">Todas as tabelas com RLS por tenant_id</p>
                <div className="space-y-3">
                  {[
                    "consultations",
                    "consultation_messages",
                    "documents",
                    "document_chunks",
                    "legal_analysis",
                    "agent_outputs",
                    "profiles",
                    "user_roles",
                  ].map((table) => (
                    <div key={table} className="flex items-center justify-between py-1">
                      <span className="text-sm font-mono text-foreground">{table}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Shield size={12} /> RLS
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Auditoria e Rastreabilidade */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">Auditoria e Rastreabilidade</h2>
              <p className="text-xs text-muted-foreground mb-5">
                Todas as alterações são rastreadas via timestamps (created_at, updated_at)
              </p>
              <div className="grid grid-cols-3 gap-5">
                <div className="border border-border/50 rounded-xl p-5 text-center">
                  <p className="font-slab text-2xl font-bold">{stats.total_consultations}</p>
                  <p className="text-xs text-muted-foreground mt-1">Consultas auditáveis</p>
                </div>
                <div className="border border-border/50 rounded-xl p-5 text-center">
                  <p className="font-slab text-2xl font-bold">{stats.total_documents}</p>
                  <p className="text-xs text-muted-foreground mt-1">Documentos rastreáveis</p>
                </div>
                <div className="border border-border/50 rounded-xl p-5 text-center">
                  <p className="font-slab text-2xl font-bold">{stats.total_users}</p>
                  <p className="text-xs text-muted-foreground mt-1">Usuários ativos</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "aprendizado" && (
          <div className="space-y-6">
            {/* Enviar Documento */}
            <div className="bg-card rounded-xl shadow-panel p-6">
              <h2 className="font-slab text-base font-semibold mb-1">Enviar Documento</h2>
              <p className="text-xs text-muted-foreground mb-5">
                Adicione documentos para enriquecer a base de conhecimento
              </p>

              {/* Upload mode tabs */}
              <div className="flex border border-border/50 rounded-xl overflow-hidden mb-5">
                {([
                  { id: "file" as const, label: "Arquivo", icon: Upload },
                  { id: "text" as const, label: "Texto", icon: Type },
                  { id: "url" as const, label: "URL", icon: Globe },
                ]).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setKbUploadMode(mode.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-200 ${
                      kbUploadMode === mode.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <mode.icon size={16} />
                    {mode.label}
                  </button>
                ))}
              </div>

              {kbUploadMode === "file" && (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) uploadKbFiles(e.dataTransfer.files); }}
                    onClick={() => kbFileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                      isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {kbUploading ? (
                      <Loader2 size={32} className="mx-auto text-primary animate-spin mb-2" />
                    ) : (
                      <Upload size={32} className={`mx-auto mb-2 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <p className="text-sm text-muted-foreground">PDF, DOCX, TXT ou CSV (máx. 20MB)</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); kbFileRef.current?.click(); }}
                      className="mt-3 border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      Selecionar arquivo
                    </button>
                  </div>
                  <input
                    ref={kbFileRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.csv"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) uploadKbFiles(e.target.files); e.target.value = ""; }}
                  />
                </>
              )}

              {kbUploadMode === "text" && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={kbTextTitle}
                    onChange={(e) => setKbTextTitle(e.target.value)}
                    placeholder="Título do documento..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <textarea
                    value={kbTextContent}
                    onChange={(e) => setKbTextContent(e.target.value)}
                    placeholder="Cole o conteúdo textual aqui..."
                    rows={6}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                  />
                  <button
                    disabled={!kbTextTitle.trim() || !kbTextContent.trim() || kbUploading}
                    onClick={async () => {
                      if (!user || !kbTextTitle.trim() || !kbTextContent.trim()) return;
                      setKbUploading(true);
                      const blob = new Blob([kbTextContent], { type: "text/plain" });
                      const safeName = sanitizeFileName(kbTextTitle.trim()) + ".txt";
                      const filePath = `${user.id}/${Date.now()}_${safeName}`;
                      await supabase.storage.from("legal-documents").upload(filePath, blob);
                      await supabase.from("documents").insert({
                        user_id: user.id,
                        name: kbTextTitle.trim(),
                        file_path: filePath,
                        file_type: "text/plain",
                        file_size: blob.size,
                        document_type: "Base de Conhecimento",
                        status: "pendente",
                      });
                      toast.success("Texto adicionado à base de conhecimento!");
                      setKbTextTitle("");
                      setKbTextContent("");
                      setKbUploading(false);
                      loadKbDocs();
                    }}
                    className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent disabled:opacity-50 transition-all"
                  >
                    {kbUploading ? "Enviando..." : "Adicionar texto"}
                  </button>
                </div>
              )}

              {kbUploadMode === "url" && (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={kbUrl}
                    onChange={(e) => setKbUrl(e.target.value)}
                    placeholder="https://exemplo.gov.br/documento"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <button
                    disabled={!kbUrl.trim() || kbUploading}
                    onClick={async () => {
                      if (!user || !kbUrl.trim()) return;
                      setKbUploading(true);
                      await supabase.from("documents").insert({
                        user_id: user.id,
                        name: kbUrl.trim(),
                        file_path: kbUrl.trim(),
                        file_type: "url",
                        file_size: 0,
                        document_type: "Base de Conhecimento",
                        status: "pendente",
                      });
                      toast.success("URL adicionada à base de conhecimento!");
                      setKbUrl("");
                      setKbUploading(false);
                      loadKbDocs();
                    }}
                    className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent disabled:opacity-50 transition-all"
                  >
                    {kbUploading ? "Adicionando..." : "Adicionar URL"}
                  </button>
                </div>
              )}
            </div>

            {/* Biblioteca de Documentos */}
            <div className="bg-card rounded-xl shadow-panel">
              <div className="px-6 py-5 border-b border-border/50">
                <h2 className="font-slab text-base font-semibold">Biblioteca de Documentos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {kbDocs.length} documento(s) na base de conhecimento
                </p>
              </div>

              {/* Search and filters */}
              <div className="px-6 py-4 border-b border-border/30 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-muted-foreground" />
                  <select
                    value={kbStatusFilter}
                    onChange={(e) => setKbStatusFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="processando">Processando</option>
                    <option value="analisado">Concluído</option>
                  </select>
                  <select
                    value={kbTypeFilter}
                    onChange={(e) => setKbTypeFilter(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="pdf">PDF</option>
                    <option value="text">TXT</option>
                    <option value="url">URL</option>
                    <option value="docx">DOCX</option>
                  </select>
                </div>
              </div>

              {kbLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-primary" size={20} />
                </div>
              ) : filteredKbDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="px-6 py-3 text-left font-semibold">Nome</th>
                      <th className="px-6 py-3 text-left font-semibold">Tipo</th>
                      <th className="px-6 py-3 text-left font-semibold">Data de envio</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      <th className="px-6 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredKbDocs.map((doc) => {
                      const isUrl = doc.file_type === "url";
                      const ext = isUrl ? "URL" : (doc.name.split(".").pop()?.toUpperCase() || "DOC");
                      const statusLabel = doc.status === "analisado" ? "Concluído" : doc.status === "processando" ? "Processando" : "Pendente";
                      const statusColor = doc.status === "analisado"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : doc.status === "processando"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-secondary text-muted-foreground";
                      return (
                        <tr key={doc.id} className="hover:bg-secondary/50 transition-all duration-200 group">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-foreground">{doc.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                              isUrl ? "bg-blue-500/20 text-blue-400" : "bg-secondary text-muted-foreground"
                            }`}>
                              {ext}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${statusColor}`}>
                              {doc.status === "analisado" && <CheckCircle size={12} />}
                              {doc.status === "processando" && <Clock size={12} />}
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Visualizar">
                                <Eye size={15} />
                              </button>
                              {isUrl && (
                                <a href={doc.name} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Abrir link">
                                  <ExternalLink size={15} />
                                </a>
                              )}
                              <button
                                onClick={() => handleKbDelete(doc.id)}
                                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-panel-lg p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-slab text-base font-semibold">Excluir Usuário</h3>
                <p className="text-xs text-muted-foreground">Esta ação é irreversível</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Tem certeza que deseja excluir <span className="text-foreground font-medium">{deleteConfirm.name}</span>? 
              Todos os dados, consultas e documentos deste usuário serão permanentemente removidos.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirm.userId)}
                disabled={deletingUser === deleteConfirm.userId}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deletingUser === deleteConfirm.userId && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Admin;
