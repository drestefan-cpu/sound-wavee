/* PLAI App */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SavedTracksProvider } from "@/contexts/SavedTracksContext";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { SpotifyPlayerProvider } from "@/contexts/SpotifyPlayerContext";
import Starfield from "@/components/Starfield";
import MiniPlayer from "@/components/MiniPlayer";
import Landing from "./pages/Landing";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/Settings";
import Demo from "./pages/Demo";
import Admin from "./pages/Admin";
import TidalCallback from "./pages/TidalCallback";
import YouTubeCallback from "./pages/YouTubeCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PlatformProvider>
            <SavedTracksProvider>
              <SpotifyPlayerProvider>
                <Starfield />
                <MiniPlayer />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/demo" element={<Demo />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/auth/tidal/callback" element={<TidalCallback />} />
                  <Route path="/auth/youtube/callback" element={<YouTubeCallback />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </SpotifyPlayerProvider>
            </SavedTracksProvider>
          </PlatformProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
