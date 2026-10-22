import { PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase"; // Ajuste o caminho se necessário

const FloatingActionButton = () => {
  const navigate = useNavigate();

  const handleWriteClick = async () => {
    // Pergunta para o Supabase se tem alguém logado neste navegador
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      navigate("/escrever"); // Se estiver logado, vai direto escrever o relato
    } else {
      navigate("/login");    // Se não estiver, vai para a tela de login
    }
  };

  return (
    <button 
      onClick={handleWriteClick}
      className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-purple transition-transform hover:scale-110 active:scale-95"
    >
      <PenLine className="w-6 h-6 text-primary-foreground" />
    </button>
  );
};

export default FloatingActionButton;