CREATE TABLE IF NOT EXISTS investments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 scheme_code integer NOT NULL DEFAULT 105758 CHECK (scheme_code = 105758),
 amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 99999999999),
 invested_on date NOT NULL,
 kind text NOT NULL CHECK (kind IN ('contribution','opening')),
 units numeric(24,8) CHECK (units > 0),
 unit_source text NOT NULL CHECK (unit_source IN ('statement','unavailable')),
 note varchar(160) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((units IS NULL AND unit_source = 'unavailable') OR (units IS NOT NULL AND unit_source = 'statement'))
);
CREATE INDEX IF NOT EXISTS investments_workspace_date_idx ON investments(workspace_id, invested_on DESC);
