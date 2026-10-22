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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // AGORA CONSULTA A NOVA TABELA "daily_story_limits"
        const { count, error } = await supabase
          .from('daily_story_limits')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', todayISO);

        if (error) throw error;
        setStoriesToday(count || 0);
      } catch (error) {
        console.error("Erro ao verificar limite:", error);
      } finally {
        setIsLoadingLimit(false);
      }
    };

    checkDailyLimit();
  }, []);

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

  
const generateImageInBackground = async (
  storyId: string,
  storyTitle: string,
  userId: string
) => {
  try {
    console.log("Iniciando geração da capa...");

    const openAiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!openAiKey) {
      throw new Error("Chave da OpenAI não configurada.");
    }

    const prompt = `
Crie uma capa ilustrada para um relato sobrenatural de terror.
Título do relato: "${storyTitle}".

Estilo cinematográfico, sombrio, misterioso e assustador.
Use sombras profundas, neblina, casas abandonadas,
silhuetas misteriosas e iluminação dramática.
A imagem deve transmitir suspense e medo psicológico,
sem sangue, ferimentos, mutilação ou violência gráfica.
Não inclua palavras, letras ou títulos na imagem.
`;
    // 1. Solicita a geração da imagem
    const aiResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-image-2.5-sunburst",
          prompt,
          n: 1,
          size: "1024x1024",
          output_format: "png",
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorDetails = await aiResponse.text();
      throw new Error(
        `Erro na OpenAI (${aiResponse.status}): ${errorDetails}`
      );
    }

    const data = await aiResponse.json();

    // 2. Obtém a imagem codificada em Base64
    const base64Image = data.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new Error(
        "A API não retornou a imagem no campo b64_json."
      );
    }

    // 3. Decodifica o Base64 para os bytes reais da imagem
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imageBlob = new Blob([bytes], {
      type: "image/png",
    });

    // 4. Verifica se os bytes correspondem a um PNG
    const signature = new Uint8Array(await imageBlob.slice(0, 8).arrayBuffer());
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    if (!pngSignature.every((value, i) => signature[i] === value)) {
      throw new Error("Os dados recebidos não constituem um PNG válido.");
    }

    console.log("Imagem decodificada:", imageBlob.size, "bytes");

    // 5. Faz o upload dos bytes da imagem para o Supabase
    const fileName = `${userId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(fileName, imageBlob, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 6. Obtém a URL pública da imagem armazenada
    const {
      data: { publicUrl: finalImageUrl },
    } = supabase.storage.from("covers").getPublicUrl(fileName);

    // 7. Salva a URL na tabela stories
    const { error: updateError } = await supabase
      .from("stories")
      .update({ image_url: finalImageUrl })
      .eq("id", storyId);

    if (updateError) {
      throw updateError;
    }

    console.log("Capa gerada e anexada com sucesso!", finalImageUrl);
  } catch (error) {
    console.error("Erro ao gerar ou salvar a capa:", error);
  }
};

  const handlePublish = async () => {
    if (storiesToday >= LIMIT_PER_DAY) {
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
      generateAudioInBackground(newStory.id, content, user.id);
      generateImageInBackground(newStory.id, title, user.id);
      
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
          disabled={isSubmitting || storiesToday >= LIMIT_PER_DAY}
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