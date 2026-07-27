/*
# Task Scheduler — tasks table

1. New Tables
- `tasks`
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner; defaults to the authenticated user)
  - `title` (text, not null)
  - `description` (text, nullable)
  - `status` (text: 'todo' | 'in_progress' | 'completed', default 'todo')
  - `priority` (text: 'high' | 'medium' | 'low', default 'medium')
  - `category` (text, nullable, e.g. 'Work', 'Personal', 'Study')
  - `tags` (text[], default '{}')
  - `due_date` (timestamptz, nullable)
  - `completed_at` (timestamptz, nullable)
  - `estimated_minutes` (int, nullable, AI workload estimate)
  - `recurrence` (text, nullable, ISO-ish rule: 'daily','weekly','monthly','none')
  - `sort_order` (int, default 0, for drag-and-drop ordering within a user)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now(), updated on change)

2. Indexes
- `tasks_user_id_idx` on `user_id`
- `tasks_due_date_idx` on `due_date`
- `tasks_status_idx` on `status`
- `tasks_sort_order_idx` on `(user_id, sort_order)`

3. Security
- Enable RLS on `tasks`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- 4 separate policies (select/insert/update/delete), scoped TO authenticated.
- `user_id` defaults to `auth.uid()` so inserts that omit it still pass WITH CHECK.

4. Notes
- This is a multi-user app with a sign-in screen, so policies use `auth.uid() = user_id`.
- `updated_at` is auto-maintained via a trigger for accurate realtime sync metadata.
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  due_date timestamptz,
  completed_at timestamptz,
  estimated_minutes int,
  recurrence text DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_sort_order_idx ON tasks(user_id, sort_order);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Auto-maintain updated_at so realtime clients can detect fresh edits.
DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();