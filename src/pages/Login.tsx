import { Ghost, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase"; // Ajuste o caminho dependendo de onde salvou o supabase.ts

const Login = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    // Essa é a função mágica do Supabase que chama o Google
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Depois de logar, o Google devolve o usuário direto para a tela de escrever
        redirectTo: `${window.location.origin}/escrever`,
      },
    });
    
    if (error) console.error("Erro ao fazer login:", error);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 relative">
      
      {/* Botão de Voltar */}
      <button 
        onClick={() => navigate("/")} 
        className="absolute top-6 left-6 p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label="Voltar"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">
        
        {/* Logo Animada */}
        <div className="flex flex-col items-center gap-3">
          <Ghost className="w-20 h-20 text-primary animate-pulse-glow" />
          <h1 className="text-4xl font-extrabold text-foreground tracking-widest">
            CALAFR<span className="text-primary text-glow-purple">IO</span>
          </h1>
        </div>
        
        <p className="text-muted-foreground text-sm leading-relaxed">
          Para contar a sua história, precisamos saber quem você é. 
          <br/><br/>
          Não se preocupe, você poderá ocultar sua identidade no <strong className="text-foreground">Modo Anônimo</strong> antes de postar.
        </p>

        {/* Botão do Google */}
        <button 
          onClick={handleGoogleLogin}
          className="w-full mt-4 bg-white text-black font-extrabold text-sm py-4 px-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
        >
          {/* Ícone oficial do Google em SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continuar com o Google
        </button>
      </div>
    </div>
  );
};

export default Login;