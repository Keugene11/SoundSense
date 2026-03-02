-- Seed songs: persist user's discovery seed songs across sessions
CREATE TABLE seed_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE seed_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own seed songs"
  ON seed_songs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own seed songs"
  ON seed_songs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own seed songs"
  ON seed_songs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_seed_songs_user_id ON seed_songs(user_id);
