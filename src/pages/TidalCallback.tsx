import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TidalCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("connecting to Tidal...");

  useEffect(() => {
    const exchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const codeVerifier = sessionStorage.getItem("tidal_code_verifier");

      if (!code || !codeVerifier) {
        setStatus("missing authorization code");
        toast.error("Tidal login failed — missing code");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      try {
        // First attempt
        let { data: { session } } = await supabase.auth.getSession();

        // If no session, wait 2 seconds and retry — Supabase needs time
        // to restore session from localStorage after external OAuth redirect
        if (!session?.user?.id) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          session = retrySession;
        }

        // If still no session after retry, wait another 2 seconds and try once more
        if (!session?.user?.id) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { data: { session: finalSession } } = await supabase.auth.getSession();
          session = finalSession;
        }

        const user