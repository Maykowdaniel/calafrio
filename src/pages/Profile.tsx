import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Trash2, Loader2, AlertTriangle, Camera, Ghost, Bookmark } from "lucide-react";
import { supabase } from "../supabase";

const Profile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Nossas duas listas de histórias
  const [myStories, setMyStories] = useState<any[]>([]);
  const [savedStories, setSavedStories] = useState<any[]>([]);
  
  // Controle de Abas (Tabs)
  const [activeTab, setActiveTab] = useState<"meus" | "salvos">("meus");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storyToDelete, setStoryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // 1. Busca os dados do perfil
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(profileData);

      // 2. Busca "Meus Relatos" (os que o usuário escreveu)
      const { data: storiesData } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (storiesData) setMyStories(storiesData);

      // 3. Busca os "Relatos Salvos" (A MÁGICA ACONTECE AQUI!)
      // Puxamos a tabela de salvos e "expandimos" (join) para trazer a história e o autor dela
      const { data: savedData } = await supabase
        .from("saved_stories")
        .select(`
          story_id,
          stories (
            *,
            profiles (username)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (savedData) {
        // Limpa a estrutura dos dados para ficar igual à lista normal de histórias
        const formattedSaved = savedData.map((item: any) => item.stories).filter(Boolean);
        setSavedStories(formattedSaved);
      }

    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (error: any) {
      alert("Erro ao enviar a imagem. Tente uma imagem menor.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      if (error) throw error;

      setProfile({ ...profile, avatar_url: null });
    } catch (error) {
      alert("Erro ao remover a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerDelete = (storyId: string) => setStoryToDelete(storyId);

  const confirmDelete = async () => {
    if (!storyToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("stories").delete().eq("id", storyToDelete);
      if (error) throw error;
      setMyStories((prev) => prev.filter((story) => story.id !== storyToDelete));
      setStoryToDelete(null);
    } catch (error) {
      alert("Erro ao apagar o relato.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-background/90 backdrop-blur-md border-b border-border">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold tracking-wider text-sm text-foreground uppercase">Meu Perfil</span>
        <button onClick={handleLogout} className="bg-primary text-primary-foreground flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 transition-transform active:scale-95">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block uppercase tracking-wider text-xs">Sair</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full p-5 gap-6">
        
        {/* Foto de Perfil */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
          <div onClick={() => fileInputRef.current?.click()} className="group relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary glow-purple cursor-pointer bg-zinc-900 flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <Camera className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />}
            {profile?.avatar_url && <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>}
          </div>
          {profile?.avatar_url && <button onClick={handleRemoveAvatar} disabled={isUploading} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 font-bold transition-colors"><Trash2 className="w-3 h-3" />Remover foto</button>}
          <div className="text-center mt-2">
            <h2 className="text-2xl font-extrabold text-foreground">{profile?.username || "Usuário Sombrio"}</h2>
          </div>
        </div>

        {/* ========================================== */}
        {/* BARRA DE ABAS (TABS)                       */}
        {/* ========================================== */}
        <div className="flex border-b border-border mt-4">
          <button 
            onClick={() => setActiveTab("meus")}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === "meus" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Meus Relatos
          </button>
          <button 
            onClick={() => setActiveTab("salvos")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === "salvos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Bookmark className="w-4 h-4" /> Salvos
          </button>
        </div>

        {/* ========================================== */}
        {/* CONTEÚDO DAS ABAS                          */}
        {/* ========================================== */}
        <div className="flex flex-col gap-4">
          
          {/* VISÃO: MEUS RELATOS */}
          {activeTab === "meus" && (
            myStories.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10 bg-zinc-900/30 rounded-2xl border border-border/50">Você ainda não publicou nenhum pesadelo.</p>
            ) : (
              myStories.map((story) => (
                <div key={story.id} className="bg-zinc-900/50 border border-border rounded-2xl p-4 flex flex-col gap-3 hover:bg-zinc-900/80 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <h4 onClick={() => navigate(`/relato/${story.id}`)} className="text-foreground font-bold leading-tight cursor-pointer hover:text-primary transition-colors flex-1">{story.title}</h4>
                    {/* A lixeira só aparece nas histórias que SÃO do usuário */}
                    <button onClick={() => triggerDelete(story.id)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors p-2.5 rounded-xl -mr-2 -mt-2">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{new Date(story.created_at).toLocaleDateString("pt-BR")}</span>
                    <span className={story.is_anonymous ? "text-primary font-bold" : ""}>{story.is_anonymous ? "Anônimo" : "Público"}</span>
                  </div>
                </div>
              ))
            )
          )}

          {/* VISÃO: RELATOS SALVOS */}
          {activeTab === "salvos" && (
            savedStories.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10 bg-zinc-900/30 rounded-2xl border border-border/50">Você ainda não salvou nenhuma história.</p>
            ) : (
              savedStories.map((story) => (
                <div key={story.id} className="bg-zinc-900/50 border border-border rounded-2xl p-4 flex flex-col gap-3 hover:bg-zinc-900/80 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <h4 onClick={() => navigate(`/relato/${story.id}`)} className="text-foreground font-bold leading-tight cursor-pointer hover:text-primary transition-colors flex-1">{story.title}</h4>
                    <Bookmark className="w-5 h-5 fill-primary text-primary" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Autor: <strong className="text-foreground">@{story.is_anonymous ? "Anônimo" : (story.profiles?.username || "Usuário")}</strong></span>
                    <span>{new Date(story.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))
            )
          )}

        </div>
      </main>

      {/* Modal Customizado de Deletar (Mantido igual) */}
      {storyToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in duration-200 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-xl font-bold">Apagar Relato?</h3>
            </div>
            <p className="text-foreground/80 text-sm leading-relaxed">Tem certeza que deseja apagar este pesadelo para sempre?</p>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setStoryToDelete(null)} disabled={isDeleting} className="px-4 py-2.5 rounded-xl text-sm font-bold text-foreground hover:bg-zinc-900 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600/10 text-red-500 border border-red-500/50 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center min-w-[100px]">
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sim, Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;