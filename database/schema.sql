-- LITERATURE STUDIO v2.0 - PostgreSQL Schema
-- Compatible with Google Cloud SQL for PostgreSQL & Supabase PostgreSQL

CREATE TABLE IF NOT EXISTS profiles (
  uid TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  daily_quota INTEGER DEFAULT 15 NOT NULL,
  last_login TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mode TEXT DEFAULT 'work_analysis' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY NOT NULL,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  request_count INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  track_ids TEXT DEFAULT '[]' NOT NULL,
  is_favorite INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark' NOT NULL,
  language TEXT DEFAULT 'vi' NOT NULL,
  player_settings TEXT DEFAULT '{}' NOT NULL,
  ai_settings TEXT DEFAULT '{}' NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
