import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, MessageSquare, FileText, Clock, LogOut, ShieldCheck, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Chat Jurídico", icon: MessageSquare, path: "/chat" },
  { label: "Documentos", icon: FileText, path: "/documentos" },
  { label: "Histórico", icon: Clock, path: "/historico" },
  { label: "Administração", icon: ShieldCheck, path: "/admin" },
];

interface RecentConsultation {
  id: string;
  title: string;
}

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [recents, setRecents] = useState<RecentConsultation[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchRecents = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (data) setRecents(data);
    };

    fetchRecents();

    // Re-fetch when route changes (new consultation created)
    const channel = supabase
      .channel("sidebar-consultations")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => {
        fetchRecents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="w-60 flex-shrink-0 glass-strong flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border/50">
        <h1 className="font-slab text-sm font-bold tracking-tight leading-tight text-foreground">
          AGENTE JURÍDICO
        </h1>
        <span className="font-sans text-xs font-medium text-sky-400 tracking-widest glow-icon-sm">TCU</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const isActive = item.path === "/chat"
            ? location.pathname.startsWith("/chat")
            : location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-sky-500/90 text-white shadow-[0_0_14px_rgba(56,189,248,0.30)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-sky-300"
              }`}
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* New Chat Button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => navigate("/chat")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg bg-sky-500/90 text-white hover:bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.25)] hover:shadow-[0_0_18px_rgba(56,189,248,0.40)] transition-all duration-200"
        >
          <Plus size={16} strokeWidth={2} />
          Novo Chat
        </button>
      </div>

      {/* Recent queries */}
      <div className="px-4 py-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Consultas Recentes
          </p>
          <button
            onClick={() => navigate("/chat")}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Nova consulta"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="space-y-1.5">
          {recents.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic">Nenhuma consulta ainda</p>
          )}
          {recents.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chat/${c.id}`)}
              className={`w-full text-left text-xs truncate py-1 transition-all duration-200 ${
                location.pathname === `/chat/${c.id}`
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Footer with user info */}
      <div className="px-3 py-3 border-t border-border/50">
        {user && (
          <p className="px-3 mb-2 text-[11px] text-muted-foreground truncate">
            {user.email}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-all duration-200"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
