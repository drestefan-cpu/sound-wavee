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
import GoogleCallback from "./pages/GoogleCallback";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import Radar from "./pages/Radar";
import RadarArtist from "./pages/RadarArtist";
import RadarNew from "./pages/RadarNew";
import SongShare from "./pages/SongShare";
import ShareTarget from "./pages/ShareTarget";
import ShortLink from "./pages/ShortLink";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner
        position="bottom-center"
        duration={3500}
      />
      <BrowserRouter>
        <AuthProvider>
          <PlatformProvider>
            <SavedTracksProvider>
              <Starfield />
              <SpotifyPlayerProvider>
                <MiniPlayer />
              </SpotifyPlayerProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/song/:trackId" element={<SongShare />} />
                <Route path="/s/:shortId" element={<ShortLink />} />
                <Route path="/share-target" element={<ShareTarget />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/radar" element={<Radar />} />
                <Route path="/radar/new" element={<RadarNew />} />
                <Route path="/radar/artist/:id" element={<RadarArtist />} />
                <Route path="/radar/edit/:id" element={<RadarArtist />} />
                <Route path="/auth/tidal/callback" element={<TidalCallback />} />
                <Route path="/auth/youtube/callback" element={<YouTubeCallback />} />
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SavedTracksProvider>
          </PlatformProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
