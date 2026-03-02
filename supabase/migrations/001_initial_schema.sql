-- ============================================================================
-- SoundSense Initial Schema Migration
-- ============================================================================

-- --------------------------------------------------------------------------
-- Function & Trigger: auto-update updated_at columns
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 1. profiles
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT,
  display_name            TEXT,
  avatar_url              TEXT,
  youtube_music_connected BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 2. yt_music_credentials
-- --------------------------------------------------------------------------
CREATE TABLE yt_music_credentials (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  auth_headers JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE yt_music_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own yt credentials"
  ON yt_music_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own yt credentials"
  ON yt_music_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own yt credentials"
  ON yt_music_credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own yt credentials"
  ON yt_music_credentials FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER yt_music_credentials_updated_at
  BEFORE UPDATE ON yt_music_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 3. listening_history
-- --------------------------------------------------------------------------
CREATE TABLE listening_history (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id         TEXT NOT NULL,
  title            TEXT NOT NULL,
  artist           TEXT,
  album            TEXT,
  thumbnail_url    TEXT,
  duration_seconds INTEGER,
  played_at        TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, video_id, played_at)
);

ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own listening history"
  ON listening_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listening history"
  ON listening_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listening history"
  ON listening_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_listening_history_user_id   ON listening_history (user_id);
CREATE INDEX idx_listening_history_video_id  ON listening_history (video_id);
CREATE INDEX idx_listening_history_played_at ON listening_history (played_at);

-- --------------------------------------------------------------------------
-- 4. user_preferences
-- --------------------------------------------------------------------------
CREATE TABLE user_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  favorite_genres TEXT[] DEFAULT '{}',
  mood            TEXT DEFAULT 'balanced',
  discovery_level INTEGER DEFAULT 50,
  exclude_artists TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 5. recommendations
-- --------------------------------------------------------------------------
CREATE TABLE recommendations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  artist           TEXT NOT NULL,
  album            TEXT,
  video_id         TEXT,
  thumbnail_url    TEXT,
  reason           TEXT,
  confidence_score FLOAT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'liked', 'disliked', 'saved')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recommendations"
  ON recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
  ON recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
  ON recommendations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations"
  ON recommendations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_recommendations_user_id ON recommendations (user_id);
CREATE INDEX idx_recommendations_status  ON recommendations (status);

-- --------------------------------------------------------------------------
-- 6. subscriptions
-- --------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status                 TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Subscription writes are handled exclusively by the service role via Stripe webhooks.

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);

-- --------------------------------------------------------------------------
-- 7. sync_log
-- --------------------------------------------------------------------------
CREATE TABLE sync_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  tracks_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync logs"
  ON sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync logs"
  ON sync_log FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sync_log_user_id ON sync_log (user_id);
CREATE INDEX idx_sync_log_status  ON sync_log (status);
