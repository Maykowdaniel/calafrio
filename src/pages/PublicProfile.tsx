import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Ghost, Loader2, BookOpen } from "lucide-react";
import { supabase } from "../supabase";

const PublicProfile = () => {
  const { id } = useParams(); // Pega o ID do autor pela URL
  const navigate = useNavigate();
  
  const [author, setAuthor] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);

  const fetchAuthorData = async () => {
    try {
      // 1. Busca as infos do Autor
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      
      if (profileData) setAuthor(profileData);

      // 2. Busca apenas os relatos PÚBLICOS desse autor
      const { data: storiesData } = await supabase
        .from("stories_public")
        .select("*")
        .eq("user_id", id)
        .eq("is_anonymous", false) // Filtro crucial: Só as públicas!
        .order("created_at", { ascending: false });

      if (storiesData) setStories(storiesData);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      </div>
    );
  }

  if (!author) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground">
        <Ghost className="w-12 h-12 mb-4 opacity-50" />
        <p>Este autor se perdeu na neblina...</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <header className="sticky top-0 z-50 flex items-center px-4 py-4 bg-background/90 backdrop-blur-md border-b border-border">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold tracking-wider text-sm text-foreground uppercase">Perfil do Autor</span>
      </header>

      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full p-5 gap-8">
        {/* Cabeçalho do Perfil */}
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary glow-purple bg-zinc-900 flex items-center justify-center">
            {author.avatar_url ? (
              <img src={author.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Ghost className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-foreground">@{author.username || "Usuário Sombrio"}</h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4" /> {stories.length} relatos públicos
            </p>
          </div>
        </div>

        <hr className="border-border/50" />

        {/* Lista de Histórias do Autor */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-foreground">Acervo Sombrio</h3>
          
          {stories.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10 bg-zinc-900/30 rounded-2xl border border-border/50">
              Nenhum relato público encontrado.
            </p>
          ) : (
            stories.map((story) => (
              <div 
                key={story.id} 
                onClick={() => navigate(`/relato/${story.id}`)}
                className="bg-zinc-900/50 border border-border rounded-2xl p-4 flex flex-col gap-2 cursor-pointer hover:bg-zinc-900/80 hover:border-primary/50 transition-all"
              >
                <h4 className="text-foreground font-bold leading-tight">{story.title}</h4>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{new Date(story.created_at).toLocaleDateString("pt-BR")}</span>
                  <span className="text-secondary text-glow-green">{story.voice_type || "Voz"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default PublicProfile;