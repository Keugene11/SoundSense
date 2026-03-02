ALTER TABLE yt_music_credentials RENAME COLUMN auth_headers TO oauth_tokens;

UPDATE profiles SET youtube_music_connected = false WHERE youtube_music_connected = true;
