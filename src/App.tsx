/* PLAI App */
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SavedTracksProvider } from "@/contexts/SavedTracksContext";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { SpotifyPlayerProvider } from "@/contexts/SpotifyPlayerContext";
import Starfield from "@/components/Starfield";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import MiniPlayer from "@/components/MiniPlayer";
import Landing from "./pages/Landing";
const Feed = lazy(() => import("./pages/Feed"));
const Profile = lazy(() => import("./pages/Profile"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Demo = lazy(() => import("./pages/Demo"));
const Admin = lazy(() => import("./pages/Admin"));
const TidalCallback = lazy(() => import("./pages/TidalCallback"));
const YouTubeCallback = lazy(() => import("./pages/YouTubeCallback"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Artist = lazy(() => import("./pages/Artist"));
const Radar = lazy(() => import("./pages/Radar"));
const RadarArtist = lazy(() => import("./pages/RadarArtist"));
const RadarNew = lazy(() => import("./pages/RadarNew"));
import SongShare from "./pages/SongShare";
const ShareTarget = lazy(() => import("./pages/ShareTarget"));
import ShortLink from "./pages/ShortLink";
import Join from "./pages/Join";
import SpotifyAccessSheet from "./components/SpotifyAccessSheet";
const SharePage = lazy(() => import("./pages/SharePage"));

const queryClient = new QueryClient();

// Pages load on demand so the first download is small; the landing and shared-song pages
// (what new visitors see first) stay in the main bundle.
const PageLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

// Toasts follow the app theme (Night = dark, Dawn = light)
const ThemedToaster = () => {
  const { theme } = useTheme();
  return <Sonner position="bottom-center" duration={3500} theme={theme === "dawn" ? "light" : "dark"} />;
};

const App = () => (
  <ErrorBoundary>
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemedToaster />
      <BrowserRouter>
        <AuthProvider>
          <PlatformProvider>
            <SavedTracksProvider>
              <Starfield />
              <SpotifyPlayerProvider>
                <MiniPlayer />
              </SpotifyPlayerProvider>
              <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/song/:trackId" element={<SongShare />} />
                <Route path="/s/:shortId" element={<ShortLink />} />
                <Route path="/join/:username" element={<Join />} />
                <Route path="/artist/:name" element={<Artist />} />
                <Route path="/share" element={<SharePage />} />
                <Route path="/share-target" element={<ShareTarget />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/discover" element={<Feed />} />
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
              <SpotifyAccessSheet />
              </Suspense>
            </SavedTracksProvider>
          </PlatformProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
