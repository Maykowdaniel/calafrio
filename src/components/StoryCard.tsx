import { Play, Pause, Ghost, MessageCircle, Bookmark, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase"; 
import Waveform from "./Waveform";

interface StoryCardProps {
  story: any;
}

const StoryCard = ({ story }: StoryCardProps) => {
  const navigate = useNavigate();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [hasSaved, setHasSaved] = useState(false);
  const [showAnonymousModal, setShowAnonymousModal] = useState(false);

  // Compatível também com versões antigas do Index que não passavam is_anonymous.
  const isAnonymous = story.is_anonymous === true || story.author === "Anônimo";
  const [currentUser, setCurrentUser] = useState<any>(null);

  const wordsCount = story.content?.trim().split(/\s+/).length || 0;
  const readTime = Math.max(1, Math.ceil(wordsCount / 200)); 

  useEffect(() => {
    checkSavedStatus();
  }, []);

  const checkSavedStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);

    const { data } = await supabase
      .from("saved_stories")
      .select("id")
      .eq("story_id", story.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) setHasSaved(true);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      let seconds = audioRef.current.duration;
      if (seconds === Infinity || isNaN(seconds)) {
        seconds = Math.ceil((wordsCount / 130) * 60); 
      }
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      setAudioDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
  };

  const handleOpenStory = () => {
    navigate(`/relato/${story.id}`);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); 

    if (!currentUser) {
      alert("Faça login para salvar relatos!");
      return;
    }

    if (hasSaved) {
      setHasSaved(false);
      await supabase.from("saved_stories").delete().eq("story_id", story.id).eq("user_id", currentUser.id);
    } else {
      setHasSaved(true);
      await supabase.from("saved_stories").insert({ story_id: story.id, user_id: currentUser.id });
    }
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    // Não abrir o relato quando o usuário clicar apenas no nome do autor.
    e.stopPropagation();

    if (isAnonymous) {
      setShowAnonymousModal(true);
      return;
    }

    if (story.user_id) {
      navigate(`/autor/${story.user_id}`);
    }
  };

  return (
    <>
    <div 
      onClick={handleOpenStory} 
      className="relative w-full rounded-2xl overflow-hidden cursor-pointer transition-transform active:scale-[0.98]" 
      style={{ minHeight: "70vh" }}
    >
      <img src={story.image} alt={story.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

      {story.audio_url && (
        <audio ref={audioRef} src={story.audio_url} onEnded={() => setIsPlaying(false)} onLoadedMetadata={handleLoadedMetadata} preload="metadata" />
      )}

      <div className="relative z-10 flex flex-col justify-end h-full p-5" style={{ minHeight: "70vh" }}>
        <h2 className="text-2xl font-extrabold text-foreground leading-tight mb-2 uppercase tracking-wide">{story.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Por <button
                type="button"
                onClick={handleAuthorClick}
                className={`font-bold text-primary transition-colors cursor-pointer ${
                  isAnonymous ? 'hover:text-primary/80' : 'hover:text-secondary hover:underline'
                }`}
                aria-label={isAnonymous ? 'Sobre o autor anônimo' : `Abrir perfil de ${story.author}`}
              >
                @{isAnonymous ? "Anônimo" : story.author}
              </button> • {story.timeAgo}
        </p>

        {/* PLAYER DE ÁUDIO (SÓ APARECE SE TIVER ÁUDIO) */}
        {story.audio_url && (
          <div className="flex items-center gap-4 mb-3">
            <button onClick={togglePlay} className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-primary glow-purple flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer">
              {isPlaying ? <Pause className="w-6 h-6 text-primary" /> : <Play className="w-6 h-6 text-primary ml-1" />}
            </button>
            <Waveform isPlaying={isPlaying} />
          </div>
        )}

        {/* DETALHES DE TEMPO E VOZ */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest mb-6 font-bold">
          {story.audio_url && (
            <>
              <span className="flex items-center gap-1"><Play className="w-3 h-3"/> ÁUDIO ({audioDuration || '...'})</span>
              <span>•</span>
            </>
          )}
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> LER ({readTime} MIN)</span>
          {story.audio_url && (
            <>
              <span>•</span>
              <span className="text-secondary text-glow-green">{story.voiceType}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Ghost className="w-5 h-5" />
              <span className="text-sm">{story.likes}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">{story.comments}</span>
            </div>
          </div>
          <button onClick={handleSaveClick} className={`p-2 -mr-2 text-muted-foreground transition-colors ${hasSaved ? 'text-primary' : 'hover:text-foreground'}`}>
            <Bookmark className={`w-6 h-6 ${hasSaved ? 'fill-primary text-primary' : ''}`} />
          </button>
        </div>
      </div>
    </div>

    {/* Modal fora do card para o clique não abrir o relato. */}
    {showAnonymousModal && (
      <div
        role="presentation"
        onClick={(event) => {
          event.stopPropagation();
          setShowAnonymousModal(false);
        }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`anonymous-dialog-${story.id}`}
          onClick={(event) => event.stopPropagation()}
          className="bg-zinc-950 border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-200 shadow-[0_0_40px_rgba(168,85,247,0.15)]"
        >
          <div className="flex items-center gap-3 text-primary">
            <Ghost className="w-6 h-6 animate-pulse" />
            <h3 id={`anonymous-dialog-${story.id}`} className="text-xl font-bold uppercase tracking-wider">
              Identidade Oculta
            </h3>
          </div>
          <p className="text-foreground/80 text-sm leading-relaxed">
            A identidade deste autor está oculta nas sombras. Trata-se de um relato completamente anônimo.
          </p>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={() => setShowAnonymousModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center min-w-[120px]"
            >
              Compreendido
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default StoryCard;