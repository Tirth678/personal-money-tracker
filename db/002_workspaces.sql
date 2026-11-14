BEGIN;
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(60) NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO workspaces (id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'Personal') ON CONFLICT (id) DO NOTHING;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES workspaces(id);
CREATE INDEX IF NOT EXISTS expenses_workspace_date_idx ON expenses (workspace_id, spent_on DESC, created_at DESC);
COMMIT;
