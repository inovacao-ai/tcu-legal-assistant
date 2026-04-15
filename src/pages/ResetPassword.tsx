import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-slab text-xl font-bold mb-4">Link inválido</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Este link de recuperação é inválido ou expirou.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-primary hover:text-accent transition-all"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-slab text-2xl font-bold tracking-tight">AGENTE JURÍDICO</h1>
          <span className="font-slab text-sm font-medium text-primary tracking-widest">TCU</span>
        </div>

        <div className="glass-strong rounded-2xl shadow-panel-lg p-8">
          <h2 className="font-slab text-lg font-semibold mb-1">Nova Senha</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Digite sua nova senha abaixo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Nova Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold hover:bg-accent transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-sm hover:shadow-glow"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Atualizar Senha
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
