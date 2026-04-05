import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import PlaiLogo from "@/components/PlaiLogo";
import Starfield from "@/components/Starfield";

const Landing = () => {
  const { user, loading, signInWithSpotify } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Starfield />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-10 text-center">
        {/* Etymology line */}
        <p className="text-[11px] font-light uppercase tracking-[0.3em] text-primary">
          from old provençal — it pleases me
        </p>

        {/* Logo */}
        <PlaiLogo className="text-7xl" />

        {/* Tagline */}
        <p className="max-w-xs font-light text-muted-foreground" style={{ fontSize: '1.05rem' }}>
          see what your friends are loving right now
        </p>

        {/* Auth buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={signInWithSpotify}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-4 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Continue with Spotify
          </button>

          <button
            onClick={() => toast("Apple Music coming soon")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M23.997 6.124a9.23 9.23 0 00-.24-2.19 5.42 5.42 0 00-1.32-2.206A5.07 5.07 0 0020.23.408a9.22 9.22 0 00-2.19-.24C16.944.12 16.548.106 12 .106s-4.944.015-6.04.062a9.22 9.22 0 00-2.19.24A5.07 5.07 0 001.564 1.73 5.42 5.42 0 00.244 3.936a9.23 9.23 0 00-.24 2.19C-.044 7.222-.06 7.618-.06 12.166s.015 4.944.062 6.04a9.23 9.23 0 00.24 2.19 5.42 5.42 0 001.32 2.206 5.07 5.07 0 002.206 1.322 9.22 9.22 0 002.19.24c1.096.048 1.492.062 6.04.062s4.944-.015 6.04-.062a9.22 9.22 0 002.19-.24 5.58 5.58 0 003.528-3.528 9.23 9.23 0 00.24-2.19c.048-1.096.062-1.492.062-6.04s-.023-4.944-.07-6.04zm-3.4 12.238a6.97 6.97 0 01-.434 2.342 3.85 3.85 0 01-2.204 2.204 6.97 6.97 0 01-2.342.434c-1.082.049-1.407.06-4.142.06s-3.06-.011-4.142-.06a6.97 6.97 0 01-2.342-.434 3.85 3.85 0 01-2.204-2.204 6.97 6.97 0 01-.434-2.342c-.049-1.082-.06-1.407-.06-4.142s.011-3.06.06-4.142a6.97 6.97 0 01.434-2.342A3.63 3.63 0 014.966 5.39a3.63 3.63 0 011.383-.937 6.97 6.97 0 012.342-.434c1.082-.049 1.407-.06 4.142-.06s3.06.011 4.142.06a6.97 6.97 0 012.342.434 3.85 3.85 0 012.204 2.204 6.97 6.97 0 01.434 2.342c.049 1.082.06 1.407.06 4.142s-.018 3.06-.067 4.142zM16.633 5.792h.012v10.63l-2.25-1.312V7.104z" />
            </svg>
            Continue with Apple Music
          </button>

          <button
            onClick={() => toast("YouTube Music coming soon")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-border px-6 py-4 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm4.872 16.32H7.128a2.448 2.448 0 01-2.448-2.448V10.128a2.448 2.448 0 012.448-2.448h9.744a2.448 2.448 0 012.448 2.448v3.744a2.448 2.448 0 01-2.448 2.448zM10.2 14.4l4.08-2.4-4.08-2.4v4.8z" />
            </svg>
            Continue with YouTube Music
          </button>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground/40">
          we only read your likes. nothing else.
        </p>
      </div>
    </div>
  );
};

export default Landing;
