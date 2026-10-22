import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WriteStory from "./pages/writeStory";
import Login from "./pages/Login";
const queryClient = new QueryClient();
import StoryDetail from "./pages/StoryDetail";
import Profile from "./pages/Profile"; // Importe lá em cima
import PublicProfile from './pages/PublicProfile';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/escrever" element={<WriteStory />} />
          <Route path="/login" element={<Login />} />
          <Route path="/relato/:id" element={<StoryDetail />} /> {/* NOVA ROTA AQUI */}
          <Route path="/perfil" element={<Profile />} />
          <Route path="/autor/:id" element={<PublicProfile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
