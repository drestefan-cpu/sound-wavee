import { useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"

const ShortLink = () => {
  const { shortId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    const resolve = async () => {
      if (!shortId) { navigate("/"); return }
      const { data } = await supabase
        .from("tracks")
        .select("id")
        .eq("short_id", shortId)
        .maybeSingle()
      if (data?.id) navigate(`/song/${data.id}`, { replace: true })
      else navigate("/", { replace: true })
    }
    resolve()
  }, [shortId])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default ShortLink
