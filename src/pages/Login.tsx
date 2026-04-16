import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Digite seu e-mail para recuperar a senha.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("E-mail de recuperação enviado. Verifique sua caixa de entrada.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, displayName || undefined);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/");
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-slab text-[36px] font-bold leading-tight tracking-tight">Agente Jurídico</h1>
          <span className="font-sans text-[17px] font-medium text-primary tracking-[0.2em]">TCU</span>
        </div>

        <div className="glass-strong rounded-2xl shadow-panel-lg p-8">
          <h2 className="font-slab text-lg font-semibold mb-1">
            {isSignUp ? "Criar Conta" : "Acesso"}
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {isSignUp
              ? "Preencha os dados para criar sua conta."
              : "Entre com suas credenciais para acessar a plataforma."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-normal text-foreground mb-1.5">Nome</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground placeholder:font-light focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                  placeholder="Seu nome completo"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-normal text-foreground mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground placeholder:font-light focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                placeholder="seu@email.gov.br"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-normal text-foreground mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground placeholder:font-light focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-base font-semibold hover:bg-accent transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow-sm hover:shadow-glow"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {isSignUp ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 mt-5">
            {!isSignUp && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[13px] font-normal text-muted-foreground hover:text-primary transition-all duration-200"
              >
                Esqueci minha senha
              </button>
            )}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[13px] font-normal text-primary hover:text-accent transition-all duration-200"
            >
              {isSignUp ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Plataforma restrita a usuários autorizados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
