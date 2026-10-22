import { Ghost, Search, UserCircle2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

// Avisamos ao TypeScript que o Header agora pode receber o texto da pesquisa
interface HeaderProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

const Header = ({ searchQuery = "", setSearchQuery }: HeaderProps) => {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    // Se estiver fechando a pesquisa, limpa o texto para mostrar todos os relatos de volta
    if (isSearchOpen && setSearchQuery) {
      setSearchQuery("");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-lg border-b border-border min-h-[60px]">
      
      {isSearchOpen ? (
        // MODO PESQUISA: Ocupa a barra inteira
        <div className="flex items-center w-full gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            placeholder="Pesquisar relato..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-medium"
          />
          <button onClick={toggleSearch} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        // MODO NORMAL: Logo e Ícones
        <>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Ghost className="w-6 h-6 text-primary animate-pulse-glow" />
            <span className="text-lg font-extrabold tracking-wider text-foreground">
              CALAFR<span className="text-primary text-glow-purple">IO</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Lupa para abrir a pesquisa */}
            <button onClick={toggleSearch} className="text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate("/perfil")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserCircle2 className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;