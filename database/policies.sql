-- LITERATURE STUDIO v2.0 - Row Level Security (RLS) Policies
-- For PostgreSQL / Supabase deployment environments

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read and update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (uid = current_setting('app.current_user_uid', true));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (uid = current_setting('app.current_user_uid', true));

-- Conversations isolation per account
CREATE POLICY "Users manage own conversations"
  ON conversations FOR ALL
  USING (user_id = current_setting('app.current_user_uid', true));

-- Messages isolation via conversation ownership
CREATE POLICY "Users manage own messages"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = current_setting('app.current_user_uid', true)
    )
  );

-- Daily AI quota tracking isolation
CREATE POLICY "Users view own AI usage"
  ON ai_usage_daily FOR SELECT
  USING (user_id = current_setting('app.current_user_uid', true));

-- Playlists isolation
CREATE POLICY "Users manage own playlists"
  ON playlists FOR ALL
  USING (user_id = current_setting('app.current_user_uid', true));

-- Settings isolation
CREATE POLICY "Users manage own settings"
  ON user_settings FOR ALL
  USING (user_id = current_setting('app.current_user_uid', true));
