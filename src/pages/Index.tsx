import { useEffect, useState } from "react";
import Header from "@/components/Header";
import StoryCard from "@/components/StoryCard";
import FloatingActionButton from "@/components/FloatingActionButton";
import { supabase } from "../supabase"; 
import { Loader2 } from "lucide-react";
import defaultBg from "@/assets/story-bg-1.jpg";

const CATEGORIES = ["Todos", "Terror", "Suspense", "Aventura", "Maledite", "Terror no interior", "Sobrenatural"];

const Index = () => {
  const [stories, setStories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  // Estados para rastrear o deslize do dedo
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
// NOVO: Estado para rastrear a direção da animação
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "none">("none");
  // ---> ADICIONE ESTA LINHA:
  const [searchQuery, setSearchQuery] = useState("");
  // Distância mínima (em pixels) para considerar que foi um "arraste" e não um clique sem querer
  const minSwipeDistance = 50;

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from("stories")
        .select(`
          user_id,
          id, title,image_url,content, voice_type, audio_url, is_anonymous, likes_count, comments_count, created_at, genre, profiles ( username )
        `)
        .order("created_at", { ascending: false }); 

      if (error) throw error;

      const formattedStories = data.map((story: any) => ({
        user_id: story.user_id,
        id: story.id,
        title: story.title,
        author: story.is_anonymous ? "Anônimo" : (story.profiles?.username || "Usuário"),
        content: story.content,
        timeAgo: new Date(story.created_at).toLocaleDateString("pt-BR"), 
        duration: "1min", 
        voiceType: story.voice_type || "Voz Sombria",
        genre: story.genre || "Terror",
        likes: story.likes_count.toString(),
        comments: story.comments_count.toString(),
        image: story.image_url || defaultBg,
        audio_url: story.audio_url,
      }));

      setStories(formattedStories);
    } catch (error) {
      console.error("Erro ao buscar relatos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // MÁGICA DO SWIPE (Deslizar o dedo)
  // ==========================================
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reseta o final do toque
    setTouchStart(e.targetTouches[0].clientX); // Salva onde o dedo encostou
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX); // Atualiza por onde o dedo está passando
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = CATEGORIES.indexOf(selectedCategory);

    let nextIndex = currentIndex;

    if (isLeftSwipe && currentIndex < CATEGORIES.length - 1) {
      // Arrastou pra ESQUERDA -> Vai pra PRÓXIMA aba (direita)
      nextIndex = currentIndex + 1;
    } else if (isRightSwipe && currentIndex > 0) {
      // Arrastou pra DIREITA -> Vai pra aba ANTERIOR (esquerda)
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
      const newCategory = CATEGORIES[nextIndex];
      setSelectedCategory(newCategory);
      
      // Detalhe Premium: Faz a barra superior rolar sozinha para focar na aba nova!
      document.getElementById(`tab-${newCategory}`)?.scrollIntoView({ 
        behavior: "smooth", inline: "center", block: "nearest" 
      });
    }
  };

  // MÁGICA DO FILTRO DUPLO: Verifica a Categoria E o Texto digitado
  const displayedStories = stories.filter((story) => {
    // 1. Passa no filtro de categoria?
    const matchesCategory = selectedCategory === "Todos" || story.genre === selectedCategory;
    
    // 2. Passa no filtro de texto? (Transforma tudo em minúsculo para a busca não ser "chata")
    const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });
  return (
    <div className="min-h-screen bg-background">
      <Header  searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* A tag main agora tem onTouchStart, onTouchMove e onTouchEnd.
        Qualquer lugar da tela que o usuário deslizar, o código vai rastrear! 
      */}
      <main 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd} 
        className="pt-20 pb-20 flex flex-col max-w-lg mx-auto min-h-screen"
      >
        
        {/* BARRA DE NAVEGAÇÃO SUPERIOR */}
        <div className="sticky top-[60px] z-40 bg-background/95 backdrop-blur-md pb-4 pt-2 border-b border-border mb-4">
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 scroll-smooth">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`tab-${cat}`} // Adicionamos um ID para o Auto-Scroll achar ele
                onClick={() => {
                  const currentIdx = CATEGORIES.indexOf(selectedCategory);
                  const newIdx = CATEGORIES.indexOf(cat);
                 if (newIdx > currentIdx) setSwipeDirection("left");
                  else if (newIdx < currentIdx) setSwipeDirection("right");
                  else setSwipeDirection("none");

                  setSelectedCategory(cat);
                  document.getElementById(`tab-${cat}`)?.scrollIntoView({ behavior: "smooth", inline: "center" });
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                  selectedCategory === cat 
                    ? 'bg-foreground text-background shadow-md scale-105' 
                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA DE RELATOS FILTRADOS */}
        <div className="flex flex-col gap-4 px-3 no-scrollbar">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 mt-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="font-bold tracking-widest text-sm uppercase">Buscando Relatos...</p>
            </div>
          ) : displayedStories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center px-4 mt-10">
              {searchQuery.trim() !== "" ? (
                <>
                  <p>Nenhuma correspondência encontrada para <strong className="text-primary">"{searchQuery}"</strong>.</p>
                  <p className="text-sm mt-2">Tente pesquisar com outras palavras.</p>
                </>
              ) : (
                <>
                  <p>Nenhum relato na categoria <strong className="text-primary">{selectedCategory}</strong>.</p>
                  <p className="text-sm mt-2">Seja o primeiro a postar!</p>
                </>
              )}
            </div>
          ) : (
            displayedStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))
          )}
        </div>
      </main>

      <FloatingActionButton />
    </div>
  );
};

export default Index;