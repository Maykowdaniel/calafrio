import { useState, useEffect } from "react";
import { ArrowLeft, Send, Ghost, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const GENRES = ["Terror", "Suspense", "Aventura", "Maledite", "Terror no interior", "Sobrenatural"];

const WriteStory = () => {
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [genre, setGenre] = useState("Terror"); 
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [storiesToday, setStoriesToday] = useState(0);
  const [isLoadingLimit, setIsLoadingLimit] = useState(true);
  const [limitError, setLimitError] = useState(false);
  const LIMIT_PER_DAY = 1;

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    
    const handlePopState = () => {
      navigate("/", { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  useEffect(() => {
    const checkDailyLimit = async () => {
      setIsLoadingLimit(true);
      setLimitError(false);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        // A data usada no limite deve ser a mesma do trigger do banco.
        const dateParts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const part = (type: string) => dateParts.find((p) => p.type === type)?.value;
        const brazilDate = `${part("year")}-${part("month")}-${part("day")}`;

        // O registro permanece nesta tabela mesmo se o relato for excluído.
        const { count, error } = await supabase
          .from("daily_story_limits")
          .select("story_date", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("story_date", brazilDate);

        if (error) throw error;
        setStoriesToday(count || 0);
      } catch (error) {
        console.error("Erro ao verificar limite:", error);
        setLimitError(true); // Não liberar publicação sem validar o limite.
      } finally {
        setIsLoadingLimit(false);
      }
    };

    void checkDailyLimit();
  }, [navigate]);

  const generateAudioInBackground = async (storyId: string, textContent: string, userId: string) => {
    try {
      console.log("Iniciando geração de áudio em background...");
      const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      const voiceId = "hpp4J3VqNfWAUOO0d1Us"; 
      
      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textContent,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (!ttsResponse.ok) throw new Error("A IA de voz falhou.");

      const audioBlob = await ttsResponse.blob();
      const fileName = `${userId}-${Date.now()}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from("audios")
        .upload(fileName, audioBlob, { contentType: "audio/mpeg" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from("audios")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('stories')
        .update({ audio_url: audioUrl })
        .eq('id', storyId);
        
      if (updateError) throw updateError;
      console.log("Áudio gerado e anexado com sucesso!");

    } catch (error) {
      console.error("Erro no background de áudio:", error);
    }
  };

  
  // A geração da imagem agora acontece somente no servidor (Edge Function).
  // Nunca envie a chave da OpenAI no JavaScript do navegador.
  const generateImageInBackground = async (storyId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-story-cover", {
        body: { storyId },
      });
      if (error) throw error;
      console.log("Geração da capa solicitada:", data);
    } catch (error) {
      // A publicação permanece válida e exibe a capa padrão.
      console.error("Não foi possível solicitar a capa:", error);
    }
  };

  const handlePublish = async () => {
    if (isLoadingLimit || limitError || storiesToday >= LIMIT_PER_DAY) {
      if (isLoadingLimit || limitError) {
        alert("Não foi possível verificar seu limite diário. Recarregue a página.");
        return;
      }
      alert("Você já atingiu o limite de publicações por hoje.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      alert("Por favor, preencha o título e a história antes de enviar!");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Sessão expirada. Faça login novamente.");
        navigate("/login", { replace: true });
        return;
      }

      // Adicionamos explicitamente image_url: null na criação para garantir o fallback
      const { data: newStory, error } = await supabase.from('stories').insert({
        user_id: user.id,
        title: title,
        content: content,
        genre: genre,
        is_anonymous: isAnonymous,
        voice_type: "Voz Assustadora",
        audio_url: null,
        image_url: null 
      }).select().single(); 

      if (error) throw error;

      // Inicia as duas gerações simultaneamente em segundo plano
      void generateAudioInBackground(newStory.id, content, user.id);
      // Aguarda apenas a confirmação de que o trabalho foi aceito no servidor.
      // A geração da imagem continua no Supabase sem depender da página aberta.
      await generateImageInBackground(newStory.id);
      
      navigate("/", { replace: true }); 
      
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert(error.message || "Ocorreu um erro ao postar seu relato.");
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-background/90 backdrop-blur-md border-b border-border">
        <button 
          onClick={() => navigate("/", { replace: true })} 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold tracking-wider text-sm uppercase">Novo Relato</span>
        <button 
          onClick={handlePublish}
          disabled={isSubmitting || isLoadingLimit || limitError || storiesToday >= LIMIT_PER_DAY}
          className="text-primary hover:text-primary/80 flex items-center gap-2 font-bold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </header>

      <main className="flex-1 flex flex-col p-5 gap-4 max-w-lg mx-auto w-full">
        {isLoadingLimit ? (
          <div className="flex-1 flex flex-col items-center justify-center text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="mt-4 text-sm font-bold uppercase">Verificando limite...</p>
          </div>
        ) : limitError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Ghost className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold">Não foi possível verificar seu limite</h2>
            <p className="text-muted-foreground text-sm">
              Confira a conexão com o Supabase e tente novamente.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold"
            >
              Tentar novamente
            </button>
          </div>
        ) : storiesToday >= LIMIT_PER_DAY ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <Ghost className="w-16 h-16 text-red-500 animate-pulse" />
            <h2 className="text-2xl font-bold text-foreground">Limite Atingido</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Você já contou suas {LIMIT_PER_DAY} histórias de hoje. 
              Os espíritos precisam descansar. Volte amanhã!
            </p>
          </div>
        ) : (
          <>
            <div className="bg-zinc-900/50 border border-border p-3 rounded-xl text-center">
              <p className="text-xs text-muted-foreground">
                Você ainda pode contar <strong className="text-primary">{LIMIT_PER_DAY - storiesToday}</strong> relato(s) hoje.
              </p>
            </div>

            <textarea
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dê um título para a sua história..."
              className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-foreground placeholder:text-muted-foreground/50 outline-none border-none focus:ring-0 resize-none overflow-hidden"
            />

            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -mx-2 px-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                    genre === g 
                      ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                      : 'bg-transparent border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que aconteceu com você? Escreva com o máximo de detalhes..."
              className="w-full flex-1 bg-transparent text-lg text-foreground/90 placeholder:text-muted-foreground/40 outline-none border-none focus:ring-0 resize-none min-h-[30vh] mt-2"
            />

            <div className="mt-auto border-t border-border/50 pt-6 pb-4 flex flex-col gap-4">
              <div 
                className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-border mb-2 cursor-pointer"
                onClick={() => setIsAnonymous(!isAnonymous)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Ghost className={`w-5 h-5 transition-colors ${isAnonymous ? 'text-primary glow-purple' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Modo Anônimo</span>
                    <span className="text-xs text-muted-foreground">Ocultar meu perfil</span>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${isAnonymous ? 'bg-primary shadow-[0_0_12px_rgba(168,85,247,0.5)]' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isAnonymous ? 'right-1' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default WriteStory;