/*
# Agent memory — conversation history & user preferences

1. New Tables
- `agent_memory`
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner; defaults to the authenticated user)
  - `role` (text: 'user' | 'assistant' — who said it)
  - `content` (text, the message)
  - `metadata` (jsonb, nullable — structured action payloads, insights, etc.)
  - `created_at` (timestamptz, default now())
- `agent_preferences`
  - `user_id` (uuid, primary key, one row per user)
  - `work_hours_start` (text, default '09:00')
  - `work_hours_end` (text, default '17:00')
  - `break_preference` (text: 'frequent'|'balanced'|'minimal', default 'balanced')
  - `focus_style` (text: 'morning'|'afternoon'|'evening'|'flexible', default 'flexible')
  - `notes` (text, nullable — free-form preferences the agent learns)
  - `updated_at` (timestamptz, default now())

2. Indexes
- `agent_memory_user_id_idx` on `user_id`
- `agent_memory_created_at_idx` on `(user_id, created_at)`

3. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
- 4 separate policies per table (select/insert/update/delete), scoped TO authenticated.
- `user_id` defaults to `auth.uid()` so inserts that omit it still pass WITH CHECK.

4. Notes
- `agent_memory` stores the rolling conversation so the agent "remembers" prior
  questions and recommendations across sessions (memory requirement).
- `agent_preferences` is a singleton-per-user upsert table for learned preferences
  (work hours, break style, focus time). One row per user via primary key on user_id.
*/

CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_memory_user_id_idx ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS agent_memory_created_at_idx ON agent_memory(user_id, created_at);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_memory" ON agent_memory;
CREATE POLICY "select_own_agent_memory" ON agent_memory FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agent_memory" ON agent_memory;
CREATE POLICY "insert_own_agent_memory" ON agent_memory FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agent_memory" ON agent_memory;
CREATE POLICY "delete_own_agent_memory" ON agent_memory FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- No update policy on agent_memory — memory is append-only.

CREATE TABLE IF NOT EXISTS agent_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  work_hours_start text NOT NULL DEFAULT '09:00',
  work_hours_end text NOT NULL DEFAULT '17:00',
  break_preference text NOT NULL DEFAULT 'balanced' CHECK (break_preference IN ('frequent','balanced','minimal')),
  focus_style text NOT NULL DEFAULT 'flexible' CHECK (focus_style IN ('morning','afternoon','evening','flexible')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_prefs" ON agent_preferences;
CREATE POLICY "select_own_agent_prefs" ON agent_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agent_prefs" ON agent_preferences;
CREATE POLICY "insert_own_agent_prefs" ON agent_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_agent_prefs" ON agent_preferences;
CREATE POLICY "update_own_agent_prefs" ON agent_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agent_prefs" ON agent_preferences;
CREATE POLICY "delete_own_agent_prefs" ON agent_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS agent_prefs_set_updated_at ON agent_preferences;
CREATE TRIGGER agent_prefs_set_updated_at
  BEFORE UPDATE ON agent_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();