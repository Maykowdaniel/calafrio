import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Ghost, Loader2, CheckCircle2, AlertTriangle, Headphones, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const GENRES = ["Terror", "Suspense", "Aventura", "Maledite", "Terror no interior", "Sobrenatural"];

// Vozes disponíveis para narrar os relatos do Calafrio.
const NARRATOR_VOICES = [
  "4XmhZ74tBbUVCXIYNMMo",
  "m151rjrbWXbBqyq56tly",
  "NFmEzNOony1UsEJGXLth",
  "HOfBIVLhom4mc9WvXfyH",
  "ohZOfA9iwlZ5nOsoY7LB",
  "ORgG8rwdAiMYRug8RJwR",
  "MA970ZNagubdplnfHEiJ",
];

const getRandomNarratorVoice = (): string => {
  const index = Math.floor(Math.random() * NARRATOR_VOICES.length);
  return NARRATOR_VOICES[index];
};

type MediaStatus = "waiting" | "generating" | "done" | "error";
type PublishStep = "idle" | "saving" | "generating" | "success" | "error";

const COVER_POLL_INTERVAL_MS = 3000;
const COVER_MAX_CHECKS = 150; // Aproximadamente 7,5 minutos.
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const WriteStory = () => {
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [genre, setGenre] = useState("Terror"); 
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [publishStep, setPublishStep] = useState<PublishStep>("idle");
  const [audioStatus, setAudioStatus] = useState<MediaStatus>("waiting");
  const [coverStatus, setCoverStatus] = useState<MediaStatus>("waiting");
  const [publishError, setPublishError] = useState("");
  const [publishedStoryId, setPublishedStoryId] = useState<string | null>(null);
  const publishedUserIdRef = useRef<string | null>(null);
  // Mantém a mesma voz escolhida mesmo se for necessário repetir a geração.
  const selectedVoiceRef = useRef<string | null>(null);

  const [storiesToday, setStoriesToday] = useState(0);
  const [isLoadingLimit, setIsLoadingLimit] = useState(true);
  const [limitError, setLimitError] = useState(false);
  const LIMIT_PER_DAY = 1;

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    // Avisa sobre o risco de interromper o áudio, que ainda é gerado no navegador.
    if (!isSubmitting) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isSubmitting]);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      if (isSubmittingRef.current) {
        // Evita o botão Voltar durante a geração, sem criar outro relato.
        window.history.pushState(null, "", window.location.href);
        return;
      }
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

  // Esta função só termina quando o áudio já foi enviado ao Storage
  // e o endereço foi salvo no relato. Erros são propagados para a interface.
  const generateAudio = async (storyId: string, textContent: string, userId: string) => {
    const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!elevenLabsKey) throw new Error("Chave da ElevenLabs não configurada.");

    if (!selectedVoiceRef.current) selectedVoiceRef.current = getRandomNarratorVoice();
    const voiceId = selectedVoiceRef.current;
    const audioController = new AbortController();
    const timeoutId = window.setTimeout(() => audioController.abort(), 12 * 60 * 1000);
    try {
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      signal: audioController.signal,
      headers: {
        Accept: "audio/mpeg",
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textContent,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!ttsResponse.ok) {
      const details = await ttsResponse.text();
      console.error("ElevenLabs:", ttsResponse.status, details);
      throw new Error(`Falha ao gerar áudio (HTTP ${ttsResponse.status}).`);
    }

    const audioBlob = await ttsResponse.blob();
    if (audioBlob.size === 0) throw new Error("A ElevenLabs retornou um áudio vazio.");

    const fileName = `${userId}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("audios")
      .upload(fileName, audioBlob, { contentType: "audio/mpeg" });
    if (uploadError) throw uploadError;

    const { data: { publicUrl: audioUrl } } = supabase.storage
      .from("audios")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("stories")
      .update({ audio_url: audioUrl })
      .eq("id", storyId)
      .eq("user_id", userId);
    if (updateError) throw updateError;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  // A Edge Function confirma o início da geração da capa, não sua conclusão.
  // Por isso consultamos a tabela stories (somente o relato do próprio autor).
  const generateCoverAndWait = async (storyId: string, userId: string) => {
    // A capa pode ter terminado no servidor após uma tentativa anterior.
    const { data: existing, error: existingError } = await supabase
      .from("stories").select("image_url")
      .eq("id", storyId).eq("user_id", userId).single();
    if (existingError) throw existingError;
    if (existing?.image_url) return;

    const { data, error } = await supabase.functions.invoke("generate-story-cover", {
      body: { storyId },
    });
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new Error(String(data.error));
    }

    for (let check = 0; check < COVER_MAX_CHECKS; check++) {
      const { data: story, error: readError } = await supabase
        .from("stories")
        .select("image_url")
        .eq("id", storyId)
        .eq("user_id", userId)
        .single();

      if (readError) throw readError;
      if (story?.image_url) return;
      await sleep(COVER_POLL_INTERVAL_MS);
    }

    throw new Error("A capa não ficou pronta no tempo de verificação. Ela ainda pode estar sendo gerada.");
  };

  // Faz as duas tarefas em paralelo, mas só libera a conclusão quando ambas
  // terminarem com sucesso. Uma falha não cancela o andamento da outra.
  const runMediaGeneration = async (
    storyId: string,
    storyText: string,
    userId: string,
    options: { audio: boolean; cover: boolean }
  ) => {
    setPublishError("");
    setPublishStep("generating");
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const pending: Promise<void>[] = [];
    const tasks: Array<"audio" | "cover"> = [];

    if (options.audio) {
      setAudioStatus("generating");
      tasks.push("audio");
      pending.push(generateAudio(storyId, storyText, userId).then(
        () => setAudioStatus("done"),
        (error) => {
          console.error("Falha no áudio:", error);
          setAudioStatus("error");
          throw error;
        }
      ));
    }

    if (options.cover) {
      setCoverStatus("generating");
      tasks.push("cover");
      pending.push(generateCoverAndWait(storyId, userId).then(
        () => setCoverStatus("done"),
        (error) => {
          console.error("Falha na capa:", error);
          setCoverStatus("error");
          throw error;
        }
      ));
    }

    const results = await Promise.allSettled(pending);
    const failed = results
      .map((result, i) => ({ result, task: tasks[i] }))
      .filter((item) => item.result.status === "rejected");

    if (failed.length > 0) {
      const descriptions = failed.map((item) => item.task === "audio" ? "áudio" : "capa");
      setPublishError(
        `O relato foi salvo, mas não foi possível concluir: ${descriptions.join(" e ")}. ` +
        "Você pode tentar gerar a mídia novamente sem publicar outro relato."
      );
      setPublishStep("error");
    } else {
      setPublishStep("success");
    }
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  };

  const retryFailedMedia = async () => {
    if (!publishedStoryId || !publishedUserIdRef.current || isSubmittingRef.current) return;
    await runMediaGeneration(publishedStoryId, content, publishedUserIdRef.current, {
      audio: audioStatus === "error",
      cover: coverStatus === "error",
    });
  };

  const statusLabel = (status: MediaStatus, kind: "audio" | "cover") => {
    if (status === "done") return kind === "audio" ? "Áudio pronto!" : "Capa pronta!";
    if (status === "error") return kind === "audio" ? "Falha na geração do áudio" : "Falha na geração da capa";
    if (status === "generating") return kind === "audio" ? "Gerando áudio..." : "Gerando capa...";
    return kind === "audio" ? "Áudio aguardando..." : "Capa aguardando...";
  };

  const handlePublish = async () => {
    if (isSubmittingRef.current || publishStep !== "idle") return;
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

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setPublishStep("saving");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        alert("Sessão expirada. Faça login novamente.");
        navigate("/login", { replace: true });
        return;
      }

      const { data: newStory, error } = await supabase.from("stories").insert({
        user_id: user.id,
        title,
        content,
        genre,
        is_anonymous: isAnonymous,
        voice_type: "Voz Assustadora",
        audio_url: null,
        image_url: null,
      }).select().single();

      if (error) throw error;

      setPublishedStoryId(newStory.id);
      publishedUserIdRef.current = user.id;
      setStoriesToday((value) => Math.max(value, LIMIT_PER_DAY));
      await runMediaGeneration(newStory.id, content, user.id, { audio: true, cover: true });
    } catch (error: unknown) {
      console.error("Erro ao salvar relato:", error);
      const message = error instanceof Error ? error.message : "Ocorreu um erro ao postar seu relato.";
      alert(message);
      setPublishStep("idle");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-background/90 backdrop-blur-md border-b border-border">
        <button 
          onClick={() => navigate("/", { replace: true })} 
          disabled={isSubmitting}
          aria-label="Voltar"
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
        {publishStep !== "idle" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12 text-center" role="status" aria-live="polite">
            {publishStep === "success" ? (
              <CheckCircle2 className="w-16 h-16 text-green-400" />
            ) : publishStep === "error" ? (
              <AlertTriangle className="w-16 h-16 text-amber-400" />
            ) : (
              <Ghost className="w-16 h-16 text-primary animate-pulse" />
            )}

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold">
                {publishStep === "saving" && "Salvando seu relato..."}
                {publishStep === "generating" && "Preparando seu relato..."}
                {publishStep === "success" && "Seu relato está pronto!"}
                {publishStep === "error" && "Seu relato foi salvo"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                {publishStep === "saving" && "Registrando sua história no Calafrio."}
                {publishStep === "generating" && "Estamos gerando o áudio e a capa. Mantenha esta página aberta até a conclusão."}
                {publishStep === "success" && "Áudio e capa gerados com sucesso. Sua história já pode ser lida e ouvida!"}
                {publishStep === "error" && publishError}
              </p>
            </div>

            {publishStep !== "saving" && (
              <div className="w-full max-w-sm bg-zinc-900/60 border border-border rounded-2xl p-5 flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{statusLabel(audioStatus, "audio")}</span>
                  {audioStatus === "generating" ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : audioStatus === "done" ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : audioStatus === "error" ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : null}
                </div>
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{statusLabel(coverStatus, "cover")}</span>
                  {coverStatus === "generating" ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : coverStatus === "done" ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : coverStatus === "error" ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : null}
                </div>
              </div>
            )}

            {publishStep === "success" && publishedStoryId && (
              <button
                onClick={() => navigate(`/relato/${publishedStoryId}`, { replace: true })}
                className="w-full max-w-sm bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90"
              >
                Ver meu relato
              </button>
            )}

            {publishStep === "error" && publishedStoryId && (
              <div className="flex flex-col gap-3 w-full max-w-sm">
                <button onClick={() => void retryFailedMedia()} disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50">
                  Tentar gerar novamente
                </button>
                <button onClick={() => navigate(`/relato/${publishedStoryId}`, { replace: true })}
                  className="w-full border border-border text-muted-foreground font-bold py-3 rounded-xl">
                  Ver relato sem a mídia pendente
                </button>
              </div>
            )}
          </div>
        ) : isLoadingLimit ? (
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
