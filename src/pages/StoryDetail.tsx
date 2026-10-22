import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, Ghost, MessageCircle, Bookmark, Loader2, Send, RotateCcw, RotateCw } from "lucide-react";
import { supabase } from "../supabase";
import Waveform from "../components/Waveform";
import defaultBg from "@/assets/story-bg-1.jpg";

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [story, setStory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [localLikesCount, setLocalLikesCount] = useState(0);
  const [localCommentsCount, setLocalCommentsCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasSaved, setHasSaved] = useState(false); 

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);

  const commentsSectionRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Estados para o progresso do áudio
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [audioDuration, setAudioDuration] = useState<string | null>(null);

  const wordsCount = story?.content?.trim().split(/\s+/).length || 0;
  const readTime = Math.max(1, Math.ceil(wordsCount / 200));

  // Formata os segundos para o padrão MM:SS
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      let seconds = audioRef.current.duration;
      if (seconds === Infinity || isNaN(seconds)) {
        seconds = Math.ceil((wordsCount / 130) * 60);
      }
      setDurationSec(seconds);
      setAudioDuration(formatTime(seconds));
    }
  };

  // Atualiza o tempo conforme o áudio toca
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Avança e volta 10 segundos
  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(durationSec, audioRef.current.currentTime + 10);
    }
  };

  // Permite arrastar a barra de progresso
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: storyData, error: storyError } = await supabase
        .from("stories")
        .select(`*, profiles(username)`)
        .eq("id", id)
        .single();

      if (storyError) throw storyError;
      setStory(storyData);
      setLocalLikesCount(storyData.likes_count || 0);
      setLocalCommentsCount(storyData.comments_count || 0);

      const { data: commentsData } = await supabase
        .from("comments")
        .select(`*, profiles(username, avatar_url)`)
        .eq("story_id", id)
        .order("created_at", { ascending: true });

      if (commentsData) setComments(commentsData);

      if (user) {
        const { data: likeData } = await supabase.from("likes").select("id").eq("story_id", id).eq("user_id", user.id).maybeSingle();
        if (likeData) setHasLiked(true);

        const { data: savedData } = await supabase.from("saved_stories").select("id").eq("story_id", id).eq("user_id", user.id).maybeSingle();
        if (savedData) setHasSaved(true);
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      alert("Relato não encontrado.");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    if (hasLiked) return; 

    setHasLiked(true);
    setLocalLikesCount(prev => prev + 1);

    const { error } = await supabase.from("likes").insert({ story_id: id, user_id: currentUser.id });
    if (error) {
      setHasLiked(false);
      setLocalLikesCount(prev => prev - 1);
    }
  };

  const handleSaveClick = async () => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    if (hasSaved) {
      setHasSaved(false); 
      await supabase.from("saved_stories").delete().eq("story_id", id).eq("user_id", currentUser.id);
    } else {
      setHasSaved(true); 
      await supabase.from("saved_stories").insert({ story_id: id, user_id: currentUser.id });
    }
  };

  const handleCommentClick = () => {
    commentsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from("comments").insert({ story_id: id, user_id: currentUser.id, content: newComment }).select(`*, profiles(username, avatar_url)`).single();
      if (error) throw error;
      setComments(prev => [...prev, data]);
      setLocalCommentsCount(prev => prev + 1);
      setNewComment(""); 
    } catch (error) {
      alert("Erro ao enviar comentário.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorClick = () => {
    if (!story.is_anonymous && story.user_id) {
      navigate(`/autor/${story.user_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-primary">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="tracking-widest text-sm uppercase font-bold">Invocando Espíritos...</p>
      </div>
    );
  }

  if (!story) return null;

  const authorName = story.is_anonymous ? "Anônimo" : (story.profiles?.username || "Usuário");
  const postDate = new Date(story.created_at).toLocaleDateString("pt-BR");

  // Cálculo da percentagem de progresso para a barra customizada
  const progressPercentage = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 relative">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-background/90 backdrop-blur-md border-b border-border">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold tracking-wider text-sm text-foreground uppercase">Relato</span>
        <div className="w-6" /> 
      </header>

      <div className="relative w-full h-64 sm:h-80">
        <img src={story.image_url || defaultBg} alt="Capa" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-5">
          <h1 className="text-3xl font-extrabold text-foreground leading-tight uppercase tracking-wide">{story.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Por <span 
                  onClick={handleAuthorClick}
                  className={`font-bold transition-colors ${story.is_anonymous ? 'text-primary' : 'text-primary hover:text-secondary hover:underline cursor-pointer'}`}
                >
                  @{authorName}
                </span> • {postDate} • {readTime} min de leitura
          </p>
        </div>
      </div>

      <main className="flex-1 flex flex-col px-5 py-6 max-w-2xl mx-auto w-full gap-8">
        {/* Player de áudio oculto */}
        {story.audio_url && (
          <audio 
            ref={audioRef} 
            src={story.audio_url} 
            onEnded={() => setIsPlaying(false)} 
            onLoadedMetadata={handleLoadedMetadata} 
            onTimeUpdate={handleTimeUpdate}
            preload="metadata" 
          />
        )}

        {story.audio_url && (
          <div className="bg-zinc-900/50 border border-border rounded-2xl p-4 flex flex-col gap-4">
            
            {/* Linha superior: Botão de play, Waveform animada e Título */}
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-primary glow-purple flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                {isPlaying ? <Pause className="w-6 h-6 text-primary" /> : <Play className="w-6 h-6 text-primary ml-1" />}
              </button>
              
              <Waveform isPlaying={isPlaying} />
              
              <div className="flex flex-col ml-2 flex-1 overflow-hidden">
                <span className="text-sm font-bold text-foreground truncate">Ouvir Relato</span>
                <span className="text-xs text-secondary text-glow-green uppercase tracking-wider mt-1 truncate">{story.voice_type || "Voz Sombria"}</span>
              </div>
            </div>

            {/* Linha inferior: Controles de progresso e voltar/avançar */}
            <div className="flex items-center gap-3">
              <button onClick={skipBackward} className="text-muted-foreground hover:text-primary transition-colors cursor-pointer p-1">
                <RotateCcw className="w-5 h-5" />
              </button>

              <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="min-w-[40px] text-right">{formatTime(currentTime)}</span>
                
                {/* 
                  Barra de progresso customizada: 
                  - Ocultamos a 'bolinha' nativa usando classes arbitrárias do Tailwind ([&::-webkit-slider-thumb])
                  - Substituímos por uma pequena barra vertical (w-2 h-4) e usamos um linear-gradient para pintar o fundo.
                */}
                <input
                  type="range"
                  min={0}
                  max={durationSec || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-sm [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-sm transition-all"
                  style={{
                    background: `linear-gradient(to right, #a855f7 ${progressPercentage}%, #3f3f46 ${progressPercentage}%)`
                  }}
                />
                
                <span className="min-w-[40px]">{audioDuration || "0:00"}</span>
              </div>

              <button onClick={skipForward} className="text-muted-foreground hover:text-primary transition-colors cursor-pointer p-1">
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

          </div>
        )}

        <article className="text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap pb-8 border-b border-border/50">{story.content}</article>

        <section className="flex flex-col gap-6" ref={commentsSectionRef}>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" /> Comentários ({localCommentsCount})</h3>
          <div className="flex flex-col gap-4">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">O silêncio é absoluto. Seja o primeiro a comentar...</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-zinc-900/30 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center"><Ghost className="w-3 h-3 text-primary" /></div>
                    <span className="text-sm font-bold text-foreground">@{comment.profiles?.username || "Usuário"}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(comment.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="text-foreground/80 text-sm whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex items-end gap-2 mt-2">
            <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicione um comentário sombrio..." className="w-full bg-zinc-900/50 border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none min-h-[60px]" />
            <button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmitting} className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition-transform active:scale-95">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-lg border-t border-border p-4 z-40">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button onClick={handleLike} className={`flex flex-col items-center gap-1 transition-colors ${hasLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
            <Ghost className={`w-6 h-6 ${hasLiked ? 'glow-purple' : ''}`} />
            <span className="text-xs font-bold">{localLikesCount}</span>
          </button>
          
          <button onClick={handleCommentClick} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs font-bold">{localCommentsCount}</span>
          </button>

          <button onClick={handleSaveClick} className={`flex flex-col items-center gap-1 transition-colors ${hasSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Bookmark className={`w-6 h-6 ${hasSaved ? 'fill-primary' : ''}`} />
            <span className="text-xs font-bold">{hasSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-200 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
            
            <div className="flex items-center gap-3 text-primary">
              <Ghost className="w-6 h-6 animate-pulse" />
              <h3 className="text-xl font-bold uppercase tracking-wider">Acesso Restrito</h3>
            </div>
            
            <p className="text-foreground/80 text-sm leading-relaxed">
              Você precisa revelar sua identidade para curtir, comentar ou salvar os pesadelos desta dimensão.
            </p>
            
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setShowLoginModal(false)} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-foreground hover:bg-zinc-900 transition-colors"
              >
                Voltar
              </button>
              
              <button 
                onClick={() => navigate("/login")} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center min-w-[120px]"
              >
                Fazer Login
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default StoryDetail;