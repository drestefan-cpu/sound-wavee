
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  actor_id UUID,
  track_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, created_at DESC);

-- User notification settings
CREATE TABLE public.user_notification_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  push_follows BOOLEAN NOT NULL DEFAULT true,
  push_reactions BOOLEAN NOT NULL DEFAULT true,
  push_saves BOOLEAN NOT NULL DEFAULT true,
  push_recommendations BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Per-user notify subscriptions (bell icon)
CREATE TABLE public.user_notify_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, target_user_id)
);

ALTER TABLE public.user_notify_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notify follows"
  ON public.user_notify_follows FOR SELECT
  USING (auth.uid() = follower_id);

CREATE POLICY "Users can insert own notify follows"
  ON public.user_notify_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own notify follows"
  ON public.user_notify_follows FOR DELETE
  USING (auth.uid() = follower_id);
